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
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([]);
  useEffect(() => {
    if (!items.length && products.length) setItems([{ productId: produk ?? products[0]!.id, qty: 1 }]);
  }, [products, produk, items.length]);
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
    return items.map((item) => {
      const product = products.find((p) => p.id === item.productId) ?? products[0]!;
      const range =
        start && end
          ? availableInRange(bookings, product.id, toKey(start), toKey(end))
          : { available: product.stock, conflicts: [] as { day: string; available: number }[] };
      const maxQty = Math.max(range.available, 0);
      const qty = Math.min(Math.max(item.qty, 1), Math.max(maxQty, 1));
      return { product, maxQty, qty, conflicts: range.conflicts, subtotal: product.price * qty * days };
    });
  }, [items, bookings, start, end, days]);

  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  const anyFull = rows.some((r) => r.maxQty === 0);
  const canBook = rows.length > 0 && !anyFull && Boolean(start && end) && nama.trim().length > 1;

  const availableToAdd = products.filter((p) => !items.some((i) => i.productId === p.id));

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
      <PageHeader
        eyebrow="Booking"
        title="Amankan Tanggal Pemakaian"
        description="Tambahkan beberapa koleksi sekaligus dalam satu nota, lalu tentukan tanggal keluar dan tanggal masuk. Sistem otomatis memeriksa jadwal agar tidak bertabrakan dengan penyewa lain."
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <div className="space-y-6">
          <div className="surface-card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl">1. Pilih Koleksi</h2>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={availableToAdd.length === 0}
                onClick={() =>
                  setItems((prev) => [...prev, { productId: availableToAdd[0]!.id, qty: 1 }])
                }
              >
                <Plus className="h-4 w-4" /> Tambah Item
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Satu nota bisa berisi beberapa item, misal 5 kostum + 5 klinting + 5 kuluk + 5 aksesoris.
            </p>

            <div className="mt-5 space-y-4">
              {rows.map((row, index) => (
                <div key={`${row.product.id}-${index}`} className="rounded-2xl border border-border p-4 sm:p-5">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setZoom({ src: row.product.image, name: row.product.name })}
                      className="group relative h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-border"
                      aria-label={`Perbesar foto ${row.product.name}`}
                    >
                      <ProductImage
                        src={row.product.image}
                        alt={row.product.name}
                        className="h-full w-full"
                        imgClassName="transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                    <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
  <div className="space-y-2">
    <Label>Koleksi</Label>

    <Select
      value={row.product.id}
      onValueChange={(v) => setItem(index, { productId: v, qty: 1 })}
    >
      <SelectTrigger className="rounded-xl">
        <SelectValue placeholder="Pilih koleksi" />
      </SelectTrigger>

      <SelectContent>
        {products
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

  <div className="space-y-2">
    <div className="flex h-9 items-center">
      <StatusBadge
        status={
          row.maxQty === 0
            ? "Habis"
            : row.maxQty <= 2
              ? "Terbatas"
              : "Tersedia"
        }
      />
    </div>

    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>
        Keluar:{" "}
        <strong className="text-destructive">
          {Math.max(row.product.stock - row.maxQty, 0)} {row.product.unit}
        </strong>
      </span>

      <span>
        Sisa:{" "}
        <strong className="text-success">
          {row.maxQty} {row.product.unit}
        </strong>
      </span>
    </div>
  </div>
  </div>
  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => setItem(index, { qty: Math.max(1, row.qty - 1) })}
                      disabled={row.qty <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center text-lg font-semibold">{row.qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => setItem(index, { qty: Math.min(row.maxQty, row.qty + 1) })}
                      disabled={row.qty >= row.maxQty}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      maks. {row.maxQty} {row.product.unit} · {formatIDR(row.subtotal)}
                    </span>
                    {rows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto rounded-full text-destructive"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  {row.conflicts.length > 0 ? (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-4 text-sm text-warning">
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
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-6 sm:p-8">
            <h2 className="text-2xl">2. Tanggal Keluar & Masuk</h2>
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
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Tanggal Keluar
                </p>
                <Calendar
                  mode="single"
                  selected={start}
                  onSelect={setStart}
                  locale={localeId}
                  modifiers={calendarModifiers}
                  modifiersClassNames={calendarModifierClasses}
                  className={cn("pointer-events-auto rounded-2xl border border-border p-3")}
                />
              </div>
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Tanggal Masuk
                </p>
                <Calendar
                  mode="single"
                  selected={end}
                  onSelect={setEnd}
                  locale={localeId}
                  disabled={start ? { before: start } : undefined}
                  modifiers={calendarModifiers}
                  modifiersClassNames={calendarModifierClasses}
                  className={cn("pointer-events-auto rounded-2xl border border-border p-3")}
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
