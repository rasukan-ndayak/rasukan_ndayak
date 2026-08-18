import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, differenceInCalendarDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SiteLayout } from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  availableInRange, toKey, saveBookingGroup, useBookings,
  getTerlarisGlobal, getRentalCountMap,
} from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";
import { waOrderLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/booking")({
  validateSearch: (s: Record<string, unknown>) => ({ produk: typeof s["produk"] === "string"? s["produk"] as string : undefined }),
  component: Booking,
});

const CATS = ["Kostum", "Kuluk Lancur", "Kuluk Mentok", "Klinting", "Aksesoris"] as const;

function Booking() {
  const { produk } = Route.useSearch();
  const { bookings, refresh } = useBookings();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const [items, setItems] = useState<{ productId: string; qty: number; activeCategory: typeof CATS[number] }[]>([]);

  const countMap = getRentalCountMap(bookings);
  const terlaris = getTerlarisGlobal(bookings, 6);

  const getVisible = useCallback((cat: typeof CATS[number]) => {
    const base = products.filter((p) => p.category === cat);
    return [...base].sort((a, b) => (countMap[b.id]??0) - (countMap[a.id]??0));
  }, [products, countMap]);

  const setItemCategory = useCallback((index: number, cat: typeof CATS[number]) => {
    const visible = products.filter((p) => p.category === cat).sort((a,b) => (countMap[b.id]??0)-(countMap[a.id]??0));
    if (!visible.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      if (!cur) return prev;
      copy[index] = {...cur, activeCategory: cat, productId: visible[0]!.id, qty: 1 };
      return copy;
    });
  }, [products, countMap]);

  useEffect(() => {
    if (!products.length || items.length) return;
    if (produk) {
      const p = products.find((x) => x.id === produk);
      if (p) { setItems([{ productId: p.id, qty: 1, activeCategory: p.category as any }]); return; }
    }
    const first = getVisible("Kostum")[0]?.id?? products[0]!.id;
    setItems([{ productId: first, qty: 1, activeCategory: "Kostum" }]);
  }, [products, produk, getVisible]);

  useEffect(() => {
    if (produk) return;
    if (!terlaris.length) return;
    if (items.length!==1) return;
    const top = terlaris[0]!;
    const cur = items[0]!;
    if (top.id!==cur.productId) {
      if ((countMap[top.id]??0) >= (countMap[cur.productId]??0)) {
        setItems([{ productId: top.id, qty: 1, activeCategory: top.category as any }]);
      }
    }
  }, [terlaris, countMap, produk, items]);

  const [start, setStart] = useState<Date | undefined>(new Date());
  const [end, setEnd] = useState<Date | undefined>(addDays(new Date(), 1));
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);
  const days = useMemo(() => (!start ||!end? 1 : Math.max(differenceInCalendarDays(end, start)||1, 1)), [start, end]);

  const rows = useMemo(() => items.map((it) => {
    const prod = products.find((p) => p.id === it.productId)?? products[0]!;
    const range = start && end? availableInRange(bookings, prod.id, toKey(start), toKey(end)) : { available: prod.stock, conflicts: [] as any };
    const max = Math.max(range.available,0);
    const qty = Math.min(it.qty, Math.max(max,1));
    return { product: prod, maxQty: max, qty, subtotal: prod.price * qty * days, visibleProducts: getVisible(it.activeCategory) };
  }), [items, products, bookings, start, end, days, getVisible]);

  const total = rows.reduce((s,r)=>s+r.subtotal,0);
  const setItem = (i:number, patch:any) => setItems((pr)=>pr.map((it,idx)=>idx===i?{...it,...patch}:it));

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="surface-card p-5 sm:p-8">
          <h2 className="text-4xl font-black">1. Pilih Koleksi</h2>
          <div className="mt-5 space-y-4">
            {rows.map((row, index)=>(
              <div key={index} className="border rounded-2xl p-5 bg-white space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {CATS.map((cat)=>(
                    <button key={cat} type="button" onClick={()=>setItemCategory(index, cat)} className={cn("shrink-0 px-4 py-2 rounded-full text-sm border font-medium", items[index]!.activeCategory===cat?"bg-[#E8488A] text-white border-[#E8488A]":"bg-gray-100 border-gray-200")}>{cat}</button>
                  ))}
                </div>
                <div className="border rounded-xl grid md:grid-cols-2 overflow-hidden">
                  <button type="button" onClick={()=>setZoom({src:row.product.image,name:row.product.name})}><ProductImage src={row.product.image} alt={row.product.name} className="h-full w-full aspect-square object-cover"/></button>
                  <div className="p-3 space-y-3">
                    <Select value={row.product.id} onValueChange={(v)=>setItem(index,{productId:v,qty:1})}>
                      <SelectTrigger className="bg-white"><SelectValue/></SelectTrigger>
                      <SelectContent>{row.visibleProducts.map((p)=>(<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                    </Select>
                    <StatusBadge status={row.maxQty===0?"Habis":"Tersedia"} className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs"/>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" type="button" className="rounded-full" onClick={()=>setItem(index,{qty:Math.max(1,row.qty-1)})}><Minus className="h-4 w-4"/></Button>
                      <span className="w-6 text-center font-semibold">{row.qty}</span>
                      <Button variant="outline" size="icon" type="button" className="rounded-full" onClick={()=>setItem(index,{qty:Math.min(row.maxQty,row.qty+1)})}><Plus className="h-4 w-4"/></Button>
                      <span className="text-sm text-gray-500">maks. {row.maxQty} · {formatIDR(row.subtotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="surface-card p-6 sm:p-8 mt-6"><h2 className="text-2xl">2. Tanggal Ambil & Kembali</h2><div className="mt-5 flex gap-6 overflow-x-auto"><div className="w-[48%]"><Calendar mode="single" selected={start} onSelect={setStart} locale={localeId} className="border rounded-2xl p-3"/></div><div className="w-[48%]"><Calendar mode="single" selected={end} onSelect={setEnd} locale={localeId} disabled={start?{before:start}:undefined} className="border rounded-2xl p-3"/></div></div></div>
        <div className="surface-card p-6 sm:p-8 mt-6"><h2 className="text-2xl">3. Data Penyewa</h2><div className="mt-5 grid sm:grid-cols-2 gap-5"><div><Label>Nama</Label><Input value={nama} onChange={(e)=>setNama(e.target.value)} className="rounded-xl"/></div><div><Label>WA</Label><Input value={wa} onChange={(e)=>setWa(e.target.value)} className="rounded-xl"/></div></div>
          <Button size="lg" className="mt-6 w-full rounded-full" disabled={rows.some(r=>r.maxQty===0)} onClick={()=>{ if(!start||!end) return; void saveBookingGroup({start:toKey(start),end:toKey(end),name:nama.trim(),phone:wa.trim()}, rows.map(r=>({productId:r.product.id, qty:r.qty}))).then((c)=>{ refresh(); window.open(waOrderLink({code:c.code, items:rows.map(r=>({productName:r.product.name,qty:r.qty,unit:r.product.unit,subtotal:formatIDR(r.subtotal)})), start:toKey(start), end:toKey(end), days, total:formatIDR(total), name:nama.trim(), phone:wa.trim()}),"_blank"); void navigate({to:"/konfirmasi", search:{kode:c.code}}); }); }}>Konfirmasi Booking</Button>
        </div>
      </div>
      <Dialog open={Boolean(zoom)} onOpenChange={(o)=>!o&&setZoom(null)}><DialogContent className="max-w-lg p-0 overflow-hidden">{zoom?<ProductImage src={zoom.src} alt={zoom.name} className="min-h-80 w-full" imgClassName="w-full object-contain"/>:null}</DialogContent></Dialog>
    </SiteLayout>
  );
}