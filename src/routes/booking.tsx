import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AlertTriangle, CalendarIcon, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader, SiteLayout } from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  availableInRange,
  bookedQtyOn,
  saveBookingGroup,
  stockOf,
  toKey,
  useBookings,
} from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";
import { waOrderLink } from "@/lib/whatsapp";

type BookingSearch = { produk?: string | undefined };

export const Route = createFileRoute("/booking")({
  validateSearch: (search: Record<string, unknown>): BookingSearch => ({
    produk: typeof search["produk"] === "string" ? (search["produk"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Booking Sewa — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Pilih tanggal keluar dan masuk, jumlah unit, dan cek ketersediaan koleksi Rasukan Ndayak agar jadwal tidak bertabrakan.",
      },
      { property: "og:title", content: "Booking Sewa — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Kalender pemakaian, ringkasan biaya, dan konfirmasi booking dalam satu halaman.",
      },
    ],
  }),
  component: Booking,
});

function Booking() {
  const { produk } = Route.useSearch();
  const { bookings, refresh } = useBookings();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const [items, setItems] = useState<{ productId: string; qty: number; activeCategory: "Semua" | (typeof products)[number]["category"] }[]>([]);

  const getVisibleProducts = (category: "Semua" | (typeof products)[number]["category"]) => {
    return category === "Semua"
      ? products
      : products.filter((p) => p.category === category);
  };

  const setItemCategory = (index: number, category: "Semua" | (typeof products)[number]["category"]) => {
    setItems((prev) => {
      const updated = [...prev];
      const currentItem = updated[index];
      const visibleInNewCategory = getVisibleProducts(category);
      
      // If current product not in new category, switch to first available product in that category
      const currentProductInNewCategory = visibleInNewCategory.some((p) => p.id === currentItem?.productId);
      const newProductId = currentProductInNewCategory ? currentItem?.productId : visibleInNewCategory[0]?.id ?? currentItem?.productId;
      
      updated[index] = { ...currentItem, activeCategory: category, productId: newProductId };
      return updated;
    });
  };

  useEffect(() => {
    if (!products.length) return;
    if (!items.length) {
      const fallback = produk ?? products[0]!.id;
      setItems([{ productId: fallback, qty: 1, activeCategory: "Semua" }]);
      return;
    }
  }, [products, produk]);

  const [start, setStart] = useState<Date | undefined>(new Date());
  const [end, setEnd] = useState<Date | undefined>(addDays(new Date(), 1));
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);

  const days = useMemo(() => {
    if (!start || !end) return 1;
    return Math.max(differenceInCalendarDays(end, start) || 1, 1);
  }, [start, end]);

  /** Baris nota lengkap dengan produk, ketersediaan, dan subtotal. */
  const rows = useMemo(() => {
    return items.map((item, itemIndex) => {
      const product = products.find((p) => p.id === item.productId) ?? products[0]!;
      const range =
        start && end
          ? availableInRange(bookings, product.id, toKey(start), toKey(end))
          : { available: product.stock, conflicts: [] as { day: string; available: number }[] };
      const maxQty = Math.max(range.available, 0);
      const qty = Math.min(Math.max(item.qty, 1), Math.max(maxQty, 1));
      const visibleProducts = getVisibleProducts(item.activeCategory);
      return { product, maxQty, qty, conflicts: range.conflicts, subtotal: product.price * qty * days, visibleProducts, itemIndex };
    });
  }, [items, bookings, start, end, days, products]);

  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  const anyFull = rows.some((r) => r.maxQty === 0);
  const canBook = rows.length > 0 && !anyFull && Boolean(start && end) && nama.trim().length > 1;

  const availableToAdd = (itemIndex: number) => {
    const itemCategory = items[itemIndex]?.activeCategory ?? "Semua";
    const visibleProducts = getVisibleProducts(itemCategory);
    return visibleProducts.filter((p) => !items.some((i) => i.productId === p.id));
  };

  /** Booking penyewa lain untuk koleksi yang sedang dipilih (mulai hari ini ke depan). */
  const otherBookings = useMemo(() => {
    const ids = new Set(items.map((i) => i.productId));
    const today = toKey(new Date());
    return bookings
      .filter((b) => ids.has(b.productId) && b.end >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [bookings, items]);

  const overlapping = useMemo(() => {
    if (!start || !end) return [] as typeof otherBookings;
    const s = toKey(start);
    const e = toKey(end);
    return otherBookings.filter((b) => b.start <= e && b.end >= s);
  }, [otherBookings, start, end]);

  const setItem = (index: number, patch: Partial<{ productId: string; qty: number }>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  /** Status pemakaian per tanggal untuk koleksi yang sedang dipilih. */
  const dayFlag = (date: Date): "penuh" | "sebagian" | "kosong" => {
    const key = toKey(date);
    let anyOut = false;
    for (const it of items) {
      const out = bookedQtyOn(bookings, it.productId, key);
      if (out <= 0) continue;
      anyOut = true;
      if (out >= stockOf(it.productId)) return "penuh";
    }
    return anyOut ? "sebagian" : "kosong";
  };
  const calendarModifiers = {
    penuh: (d: Date) => dayFlag(d) === "penuh",
    sebagian: (d: Date) => dayFlag(d) === "sebagian",
  };
  const calendarModifierClasses = {
    penuh: "relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-destructive",
    sebagian:
      "relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-warning",
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-[980px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="surface-card p-5 sm:p-8">
            <h2 className="text-4xl font-black leading-none tracking-[-0.04em] text-foreground sm:text-5xl">
              1. Pilih Koleksi
            </h2>
            <p className="mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
              Satu nota bisa berisi beberapa item, misal 5 kostum + 5 klinting + 5 kuluk + 5 aksesoris.
            </p>

            {/* Collection items - removed global filter, now per-item */}

            <div className="mt-5 space-y-4">
              {rows.map((row, index) => {
                const categoryOptions = ["Semua", "Kostum", "Kuluk Lancur", "Kuluk Mentok", "Klinting", "Aksesoris"] as const;
                return (
                  <div key={`koleksi-${index}`} className="koleksi-item border rounded-2xl p-5 bg-white space-y-4">
                    {/* Category Filter - Single Row */}
                    <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex-nowrap -mx-2 px-2 pb-1">
                      {categoryOptions.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setItemCategory(index, cat as typeof items[0]["activeCategory"])}
                          className={cn(
                            "shrink-0 px-2 sm:px-3 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border",
                            items[index]?.activeCategory === cat
                              ? "border-[#E8488A] bg-[#E8488A] text-white"
                              : "border-gray-200 bg-gray-100 text-foreground hover:bg-gray-200",
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Product Card */}
                    <div className="border rounded-xl grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setZoom({ src: row.product.image, name: row.product.name })}
                        className="group relative w-full aspect-square overflow-hidden"
                        aria-label={`Perbesar foto ${row.product.name}`}
                      >
                        <ProductImage
                          src={row.product.image}
                          alt={row.product.name}
                          className="h-full w-full"
                          imgClassName="transition-transform duration-300 group-hover:scale-105 object-cover"
                        />
                      </button>

                      <div className="p-3 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Koleksi</p>
                          <Select
                            value={row.product.id}
                            onValueChange={(v) => setItem(index, { productId: v, qty: 1 })}
                          >
                            <SelectTrigger className="w-full border rounded-xl p-2 text-base mt-1 border-gray-300 bg-white shadow-none h-auto">
                              <SelectValue placeholder="Pilih koleksi" />
                            </SelectTrigger>
                            <SelectContent>
                              {row.visibleProducts
                                .filter(
                                  (p) =>
                                    p.id === row.product.id ||
                                    !items.some((i) => i.productId === p.id),
                                )
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} · {p.category}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={
                              row.maxQty === 0
                                ? "Habis"
                                : row.maxQty <= 2
                                  ? "Terbatas"
                                  : "Tersedia"
                            }
                            className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs"
                          />
                        </div>

                        <div className="text-sm text-muted-foreground space-y-0.5">
                          <p>
                            Keluar: <span className="text-red-600 font-medium">{Math.max(row.product.stock - row.maxQty, 0)} {row.product.unit}</span>
                          </p>
                          <p>
                            Sisa: <span className="text-green-600 font-medium">{row.maxQty} {row.product.unit}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full border-gray-300 bg-white text-foreground shadow-none disabled:opacity-50 shrink-0"
                            onClick={() => setItem(index, { qty: Math.max(1, row.qty - 1) })}
                            disabled={row.qty <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-6 text-center font-semibold">{row.qty}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full border-gray-300 bg-white text-foreground shadow-none disabled:opacity-50 shrink-0"
                            onClick={() => setItem(index, { qty: Math.min(row.maxQty, row.qty + 1) })}
                            disabled={row.qty >= row.maxQty}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-gray-500">
                            maks. {row.maxQty} {row.product.unit} · {formatIDR(row.subtotal)}
                          </span>
                          {rows.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="ml-auto h-10 w-10 rounded-full text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {row.conflicts.length > 0 ? (
                      <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Tanggal{" "}
                        {row.conflicts
                          .map((c) => format(new Date(`${c.day}T00:00:00`), "d MMM", { locale: localeId }))
                          .join(", ")}{" "}
                        sudah penuh untuk {row.product.name}. Pilih tanggal lain atau lihat{" "}
                        <Link to="/jadwal" className="underline">
                          jadwal
                        </Link>
                        .
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border rounded-xl py-2.5 text-base font-medium border-gray-300 bg-white hover:bg-gray-50"
                      disabled={availableToAdd(index).length === 0}
                      onClick={() => {
                        const nextProduct = availableToAdd(index)[0];
                        if (!nextProduct) return;
                        setItems((prev) => [...prev, { productId: nextProduct.id, qty: 1, activeCategory: "Semua" }]);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Tambah Item
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface-card p-6 sm:p-8">
            <h2 className="text-2xl">2. Tanggal Ambil & Kembali</h2>
            {otherBookings.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {otherBookings.slice(0, 8).map((b) => {
                  const p = products.find((x) => x.id === b.productId);
                  const bentrok = overlapping.some((o) => o.id === b.id);
                  return (
                    <li key={b.id} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          bentrok ? "bg-destructive" : "bg-warning",
                        )}
                      />
                      <span className={cn(bentrok ? "text-destructive" : "text-muted-foreground")}>
                        {format(new Date(`${b.start}T00:00:00`), "d MMM yyyy", { locale: localeId })} –{" "}
                        {b.qty} {p?.unit ?? "pcs"} keluar
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-row flex-nowrap gap-2 sm:gap-3 md:gap-6 overflow-x-auto scrollbar-hide">
              <div className="shrink-0 w-[48%] md:w-1/2">
                <p className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Tanggal Ambil
                </p>
                <Calendar
                  mode="single"
                  selected={start}
                  onSelect={setStart}
                  locale={localeId}
                  modifiers={calendarModifiers}
                  modifiersClassNames={calendarModifierClasses}
                  className={cn("pointer-events-auto rounded-xl md:rounded-2xl border border-border p-2 md:p-3 [&_table]:w-full [&_thead]:gap-1 md:[&_thead]:gap-2 [&_tbody]:gap-1 md:[&_tbody]:gap-2 [&_button]:w-7 md:[&_button]:w-9 [&_button]:h-7 md:[&_button]:h-9 text-[11px] md:text-sm [&_thead_th]:text-[11px] md:[&_thead_th]:text-xs [&_thead_th]:px-0")}
                />
              </div>
              <div className="shrink-0 w-[48%] md:w-1/2">
                <p className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Tanggal Kembali
                </p>
                <Calendar
                  mode="single"
                  selected={end}
                  onSelect={setEnd}
                  locale={localeId}
                  disabled={start ? { before: start } : undefined}
                  modifiers={calendarModifiers}
                  modifiersClassNames={calendarModifierClasses}
                  className={cn("pointer-events-auto rounded-xl md:rounded-2xl border border-border p-2 md:p-3 [&_table]:w-full [&_thead]:gap-1 md:[&_thead]:gap-2 [&_tbody]:gap-1 md:[&_tbody]:gap-2 [&_button]:w-7 md:[&_button]:w-9 [&_button]:h-7 md:[&_button]:h-9 text-[11px] md:text-sm [&_thead_th]:text-[11px] md:[&_thead_th]:text-xs [&_thead_th]:px-0")}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" /> Penuh
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" /> Sebagian keluar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border border-border" /> Kosong
              </span>
            </div>
          </div>

          <div className="surface-card p-6 sm:p-8">
            <h2 className="text-2xl">3. Data Penyewa</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="b-nama">Nama Lengkap</Label>
                <Input
                  id="b-nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama Anda"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-wa">Nomor WhatsApp</Label>
                <Input
                  id="b-wa"
                  value={wa}
                  onChange={(e) => setWa(e.target.value)}
                  placeholder="08xx xxxx xxxx"
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-xl">Ringkasan Booking</h2>
            <div className="mt-5 space-y-4">
              {rows.map((row, i) => (
                <div key={`sum-${row.product.id}-${i}`} className="flex gap-4">
                  <ProductImage
                    src={row.product.image}
                    alt={row.product.name}
                    className="h-20 w-16 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.product.name}</p>
                    <p className="text-xs uppercase tracking-widest text-primary">
                      {row.product.category}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.qty} {row.product.unit} × {formatIDR(row.product.price)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatIDR(row.subtotal)}</p>
                </div>
              ))}
            </div>

            <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
              <Row label="Tanggal keluar" value={start ? format(start, "d MMM yyyy", { locale: localeId }) : "-"} />
              <Row label="Tanggal masuk" value={end ? format(end, "d MMM yyyy", { locale: localeId }) : "-"} />
              <Row label="Durasi" value={`${days} hari`} />
              <Row label="Jumlah item" value={`${rows.length} koleksi`} />
              <Row
                label="Total unit"
                value={`${rows.reduce((s, r) => s + r.qty, 0)} unit`}
              />
            </dl>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl text-primary">{formatIDR(total)}</span>
            </div>

            <Button
              size="lg"
              className="mt-6 w-full rounded-full"
              disabled={!canBook}
              onClick={() => {
                if (!start || !end) return;
                void saveBookingGroup(
                  { start: toKey(start), end: toKey(end), name: nama.trim(), phone: wa.trim() },
                  rows.map((r) => ({ productId: r.product.id, qty: r.qty })),
                )
                  .then((created) => {
                    refresh();
                    window.open(
                      waOrderLink({
                        code: created.code,
                        items: rows.map((r) => ({ productName: r.product.name, qty: r.qty, unit: r.product.unit, subtotal: formatIDR(r.subtotal) })),
                        start: toKey(start), end: toKey(end), days, total: formatIDR(total), name: nama.trim(), phone: wa.trim(),
                      }),
                      "_blank",
                    );
                    setNama(""); setWa("");
                    toast.success(`Booking ${created.code} tercatat`, { description: `${rows.length} item · ${days} hari. Tanggal ini kini terkunci di jadwal.` });
                    void navigate({ to: "/konfirmasi", search: { kode: created.code } });
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Booking gagal disimpan ke Supabase."));
              }}
            >
              {anyFull ? "Tanggal Penuh" : "Konfirmasi Booking"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Ambil & kembalikan di Semawe, Sokorini, Muntilan, Magelang.
            </p>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(zoom)} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          {zoom ? (
            <ProductImage src={zoom.src} alt={zoom.name} className="min-h-80 w-full" imgClassName="h-auto w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
