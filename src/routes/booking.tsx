import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, differenceInCalendarDays, format, getDaysInMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  availableInRange, bookedQtyOn, saveBookingGroup, stockOf, toKey,
  useBookings, getTerlarisGlobal, getRentalCountMap,
} from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";
import { waOrderLink } from "@/lib/whatsapp";

type BookingSearch = { produk?: string | undefined };

export const Route = createFileRoute("/booking")({
  validateSearch: (search: Record<string, unknown>): BookingSearch => ({
    produk: typeof search["produk"] === "string"? (search["produk"] as string) : undefined,
  }),
  component: Booking,
});

function ScrollDatePicker({ date, onChange }: { date: Date | undefined, onChange: (d: Date) => void }) {
  const [day, setDay] = useState(date?.getDate()?? 18);
  const [month, setMonth] = useState(date?.getMonth()?? 7);
  const [year, setYear] = useState(date?.getFullYear()?? 2026);
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const years = Array.from({ length: 6 }, (_, i) => 2026 + i);
  const maxDay = getDaysInMonth(new Date(year, month));
  useEffect(() => { onChange(new Date(year, month, Math.min(day, maxDay))); }, [day, month, year]);
  useEffect(() => { if (date) { setDay(date.getDate()); setMonth(date.getMonth()); setYear(date.getFullYear()); } }, [date]);
  return (
    <div className="grid grid-cols-3 gap-3 py-4">
      <div><Label className="text-xs">Tanggal</Label><Select value={String(day)} onValueChange={(v) => setDay(Number(v))}><SelectTrigger className="mt-1 rounded-xl h-12 text-base"><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{Array.from({ length: maxDay }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Bulan</Label><Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}><SelectTrigger className="mt-1 rounded-xl h-12 text-base"><SelectValue /></SelectTrigger><SelectContent>{months.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Tahun</Label><Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="mt-1 rounded-xl h-12 text-base"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
    </div>
  );
}

function Booking() {
  const { produk } = Route.useSearch();
  const { bookings, refresh } = useBookings();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const [items, setItems] = useState<{ productId: string; qty: number; activeCategory: "Semua" | (typeof products)[number]["category"] }[]>([]);
  const countMap = getRentalCountMap(bookings);
  const terlaris = getTerlarisGlobal(bookings, 6);
  const getVisibleProducts = (category: "Semua" | (typeof products)[number]["category"]) => {
    const base = category === "Semua"? products : products.filter((p) => p.category === category);
    return [...base].sort((a, b) => (countMap[b.id]?? 0) - (countMap[a.id]?? 0));
  };
  const setItemCategory = (index: number, category: (typeof products)[number]["category"]) => {
    setItems((prev) => {
      const updated = [...prev]; const currentItem = updated[index]; if (!currentItem) return prev;
      const visible = getVisibleProducts(category); const isStillVisible = visible.some((p) => p.id === currentItem.productId);
      const fallbackId = visible[0]?.id?? products[0]?.id?? currentItem.productId;
      updated[index] = {...currentItem, activeCategory: category, productId: isStillVisible? currentItem.productId : fallbackId }; return updated;
    });
  };
  useEffect(() => { if (!products.length) return; if (!items.length) { const mostLarisId = terlaris[0]?.id?? getVisibleProducts("Kostum")[0]?.id?? products[0]!.id; setItems([{ productId: produk?? mostLarisId, qty: 1, activeCategory: "Kostum" }]); } }, [products, produk, terlaris]);
  const [start, setStart] = useState<Date | undefined>(new Date(2026, 7, 18));
  const [end, setEnd] = useState<Date | undefined>(new Date(2026, 7, 19));
  const [nama, setNama] = useState(""); const [wa, setWa] = useState(""); const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);
  const [openStart, setOpenStart] = useState(false); const [openEnd, setOpenEnd] = useState(false);
  const [pickerModeStart, setPickerModeStart] = useState<"kalender" | "scroll">("kalender"); const [pickerModeEnd, setPickerModeEnd] = useState<"kalender" | "scroll">("kalender");
  const days = useMemo(() => (!start ||!end? 1 : Math.max(differenceInCalendarDays(end, start) || 1, 1)), [start, end]);
  const rows = useMemo(() => {
    return items.map((item) => {
      const product = products.find((p) => p.id === item.productId)?? products[0]!;
      const range = start && end? availableInRange(bookings, product.id, toKey(start), toKey(end)) : { available: product.stock, conflicts: [] as any };
      const maxQty = Math.max(range.available, 0); const qty = Math.min(Math.max(item.qty, 1), Math.max(maxQty, 1));
      return { product, maxQty, qty, conflicts: range.conflicts, subtotal: product.price * qty * days, visibleProducts: getVisibleProducts(item.activeCategory) };
    });
  }, [items, bookings, start, end, days, products, countMap]);
  const total = rows.reduce((s, r) => s + r.subtotal, 0); const anyFull = rows.some((r) => r.maxQty === 0);
  const canBook = rows.length > 0 &&!anyFull && Boolean(start && end) && nama.trim().length > 1;
  const availableToAdd = (i: number) => getVisibleProducts(items[i]?.activeCategory?? "Kostum").filter((p) =>!items.some((x) => x.productId === p.id));
  const setItem = (index: number, patch: Partial<{ productId: string; qty: number }>) => setItems((prev) => prev.map((it, i) => (i === index? {...it,...patch } : it)));
  const removeItem = (index: number) => { if (rows.length <= 1) { toast.error("Minimal 1 item harus ada"); return; } setItems((prev) => prev.filter((_, i) => i!== index)); toast.success("Item dihapus"); };
  const fmt = (d?: Date) => d? format(d, "d MMMM yyyy", { locale: localeId }).toLowerCase() : "Pilih tanggal";

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="surface-card p-5 sm:p-8">
            <h2 className="text-4xl font-black">1. Pilih Koleksi</h2>
            <p className="mt-3 text-base text-muted-foreground">Satu nota bisa berisi beberapa item.</p>
            <div className="mt-5 space-y-4">
              {rows.map((row, index) => {
                const cats = ["Kostum", "Kuluk Lancur", "Kuluk Mentok", "Klinting", "Aksesoris"] as const;
                return (
                  <div key={index} className="border rounded-2xl p-5 bg-white space-y-4">
                    <div className="flex gap-2 overflow-x-auto -mx-2 px-2 pb-1">
                      {cats.map((cat) => (<button key={cat} onClick={() => setItemCategory(index, cat as any)} className={cn("shrink-0 px-3 py-2 rounded-full text-sm border", items[index]?.activeCategory === cat? "bg-[#E8488A] text-white border-[#E8488A]" : "bg-gray-100 border-gray-200")}>{cat}</button>))}
                    </div>
                    <div className="border rounded-xl grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                      <button onClick={() => setZoom({ src: row.product.image, name: row.product.name })} className="relative w-full aspect-square overflow-hidden">
                        <ProductImage src={row.product.image} alt={row.product.name} className="h-full w-full" imgClassName="object-cover" />
                      </button>
                      <div className="p-3 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Koleksi</p>
                          <Select value={row.product.id} onValueChange={(v) => setItem(index, { productId: v, qty: 1 })}>
                            <SelectTrigger className="w-full rounded-xl mt-1 bg-white h-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>{row.visibleProducts.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} · {p.category}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>

                        {/* TERSEDIA + KELUAR & SISA SEJAJAR BOLD BESAR */}
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={row.maxQty === 0? "Habis" : row.maxQty <= 2? "Terbatas" : "Tersedia"} className="bg-green-100 text-green-700 rounded-full px-4 py-2 text- font-black tracking-wide w-fit" />
                          <div className="flex items-center gap-6 pt-1">
                            <p className="text- font-bold text-foreground">Keluar: <span className="text-red-600 font-black text-">{Math.max(row.product.stock - row.maxQty, 0)} {row.product.unit}</span></p>
                            <p className="text- font-bold text-foreground">Sisa: <span className="text-green-600 font-black text-">{row.maxQty} {row.product.unit}</span></p>
                          </div>
                        </div>

                        {/* - 1 + YANG ANGKA BISA DI KLIK & KETIK */}
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shrink-0" onClick={() => setItem(index, { qty: Math.max(1, row.qty - 1) })} disabled={row.qty <= 1}><Minus className="h-4 w-4" /></Button>

                          <Input
                            type="number"
                            inputMode="numeric"
                            value={row.qty}
                            onChange={(e) => {
                              const val = e.target.value === ""? 1 : Number(e.target.value);
                              if (isNaN(val)) return;
                              const clamped = Math.min(Math.max(val, 1), row.maxQty);
                              setItem(index, { qty: clamped });
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w- h-10 text-center font-black text- rounded-full border-2 focus-visible:ring-0"
                            min={1}
                            max={row.maxQty}
                          />

                          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shrink-0" onClick={() => setItem(index, { qty: Math.min(row.maxQty, row.qty + 1) })} disabled={row.qty >= row.maxQty}><Plus className="h-4 w-4" /></Button>
                          <span className="text-sm text-gray-500">maks. {row.maxQty} · {formatIDR(row.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 rounded-xl bg-white h-12" disabled={availableToAdd(index).length === 0} onClick={() => { const next = availableToAdd(index)[0]; if (next) setItems((p) => [...p, { productId: next.id, qty: 1, activeCategory: items[index]?.activeCategory?? "Kostum" }]); }}><Plus className="h-4 w-4 mr-1" /> Tambah Item</Button>
                      <Button variant="outline" className="rounded-xl h-12 px-5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeItem(index)} disabled={rows.length <= 1}><Trash2 className="h-4 w-4 mr-1" /> Hapus</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface-card p-6 sm:p-8 border rounded-">
            <h2 className="text-2xl font-bold">2. Tanggal Ambil & Kembali</h2>
            <div className="mt-6 space-y-5">
              <div><p className="text-base text-muted-foreground">Tanggal ambil</p><button onClick={() => setOpenStart(true)} className="mt-2 w-full sm:w- px-4 py-3 rounded-xl border border-input bg-white text-left text-base text-muted-foreground font-normal hover:bg-accent transition">{fmt(start)}</button></div>
              <div><p className="text-base text-muted-foreground">Tanggal kembali</p><button onClick={() => setOpenEnd(true)} className="mt-2 w-full sm:w- px-4 py-3 rounded-xl border border-input bg-white text-left text-base text-muted-foreground font-normal hover:bg-accent transition">{fmt(end)}</button></div>
            </div>
          </div>

          <div className="surface-card p-6 sm:p-8"><h2 className="text-2xl">3. Data Penyewa</h2><div className="mt-5 grid sm:grid-cols-2 gap-5"><div><Label>Nama</Label><Input value={nama} onChange={(e) => setNama(e.target.value)} className="rounded-xl" /></div><div><Label>WA</Label><Input value={wa} onChange={(e) => setWa(e.target.value)} className="rounded-xl" /></div></div></div>
        </div>

        <aside className="lg:sticky lg:top-28 mt-6"><div className="surface-card p-6"><h2 className="text-xl">Ringkasan Booking</h2><div className="mt-5 space-y-4">{rows.map((r, i) => (<div key={i} className="flex gap-4"><ProductImage src={r.product.image} alt={r.product.name} className="h-20 w-16 rounded-xl" /><div className="flex-1"><p className="font-medium truncate">{r.product.name}</p><p className="text-xs text-primary">{r.product.category}</p><p className="text-sm text-muted-foreground">{r.qty} {r.product.unit} × {formatIDR(r.product.price)}</p></div><p className="text-sm font-medium">{formatIDR(r.subtotal)}</p></div>))}</div><div className="mt-5 flex justify-between border-t pt-5"><span>Total</span><span className="text-2xl text-primary">{formatIDR(total)}</span></div><Button size="lg" className="mt-6 w-full rounded-full" disabled={!canBook} onClick={() => { if (!start ||!end) return; void saveBookingGroup({ start: toKey(start), end: toKey(end), name: nama.trim(), phone: wa.trim() }, rows.map((r) => ({ productId: r.product.id, qty: r.qty }))).then((c) => { refresh(); window.open(waOrderLink({ code: c.code, items: rows.map((r) => ({ productName: r.product.name, qty: r.qty, unit: r.product.unit, subtotal: formatIDR(r.subtotal) })), start: toKey(start), end: toKey(end), days, total: formatIDR(total), name: nama.trim(), phone: wa.trim() }), "_blank"); void navigate({ to: "/konfirmasi", search: { kode: c.code } }); }); }}>{anyFull? "Tanggal Penuh" : "Konfirmasi Booking"}</Button></div></aside>
      </div>

      <Dialog open={openStart} onOpenChange={setOpenStart}><DialogContent className="max-w- rounded-2xl"><DialogHeader><DialogTitle>Pilih Tanggal Ambil</DialogTitle></DialogHeader><div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit"><button onClick={() => setPickerModeStart("kalender")} className={cn("px-4 py-1.5 rounded-full text-sm font-medium", pickerModeStart === "kalender"? "bg-white shadow" : "")}>Kalender</button><button onClick={() => setPickerModeStart("scroll")} className={cn("px-4 py-1.5 rounded-full text-sm font-medium", pickerModeStart === "scroll"? "bg-white shadow" : "")}>Scroll</button></div>{pickerModeStart === "kalender"? (<Calendar mode="single" selected={start} onSelect={(d) => { if (d) setStart(d); setOpenStart(false); }} locale={localeId} className="mx-auto" />) : (<ScrollDatePicker date={start} onChange={(d) => setStart(d)} />)}<Button className="w-full rounded-xl mt-2" onClick={() => setOpenStart(false)}>Pilih</Button></DialogContent></Dialog>
      <Dialog open={openEnd} onOpenChange={setOpenEnd}><DialogContent className="max-w- rounded-2xl"><DialogHeader><DialogTitle>Pilih Tanggal Kembali</DialogTitle></DialogHeader><div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit"><button onClick={() => setPickerModeEnd("kalender")} className={cn("px-4 py-1.5 rounded-full text-sm font-medium", pickerModeEnd === "kalender"? "bg-white shadow" : "")}>Kalender</button><button onClick={() => setPickerModeEnd("scroll")} className={cn("px-4 py-1.5 rounded-full text-sm font-medium", pickerModeEnd === "scroll"? "bg-white shadow" : "")}>Scroll</button></div>{pickerModeEnd === "kalender"? (<Calendar mode="single" selected={end} onSelect={(d) => { if (d) setEnd(d); setOpenEnd(false); }} locale={localeId} disabled={start? { before: start } : undefined} className="mx-auto" />) : (<ScrollDatePicker date={end} onChange={(d) => setEnd(d)} />)}<Button className="w-full rounded-xl mt-2" onClick={() => setOpenEnd(false)}>Pilih</Button></DialogContent></Dialog>
      <Dialog open={Boolean(zoom)} onOpenChange={(o) =>!o && setZoom(null)}><DialogContent className="max-w-lg p-0 overflow-hidden">{zoom? <ProductImage src={zoom.src} alt={zoom.name} className="min-h-80 w-full" imgClassName="h-auto w-full object-contain" /> : null}</DialogContent></Dialog>
    </SiteLayout>
  );
}