import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AlertTriangle, CalendarIcon, CheckCircle2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader, SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  availableInRange,
  bookingsByCode,
  removeBooking,
  removeBookingGroup,
  toKey,
  updateBooking,
  useBookings,
} from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";

type Search = { kode?: string | undefined };

export const Route = createFileRoute("/kelola-booking")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    kode: typeof search["kode"] === "string" ? (search["kode"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ubah atau Batalkan Booking — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Cari booking dengan kode, ubah tanggal keluar-masuk dan jumlah unit tiap item dengan pengecekan ketersediaan real-time, atau batalkan nota.",
      },
      { property: "og:title", content: "Ubah atau Batalkan Booking — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Kelola jadwal sewa Anda: ubah tanggal, ubah jumlah unit tiap item, atau batalkan booking.",
      },
    ],
  }),
  component: KelolaBooking,
});

function KelolaBooking() {
  const { kode } = Route.useSearch();
  const navigate = useNavigate();
  const { bookings, refresh } = useBookings();
  const { products } = useCatalog();
  const [query, setQuery] = useState(kode ?? "");

  const group = useMemo(() => (kode ? bookingsByCode(bookings, kode) : []), [bookings, kode]);
  const head = group[0];

  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const groupKey = group.map((b) => `${b.id}:${b.qty}`).join("|");
  useEffect(() => {
    if (!head) return;
    setStart(parseISO(head.start));
    setEnd(parseISO(head.end));
    setQtys(Object.fromEntries(group.map((b) => [b.id, b.qty])));
  }, [head?.id, head?.start, head?.end, groupKey]);

  const days = useMemo(() => {
    if (!start || !end) return 1;
    return Math.max(differenceInCalendarDays(end, start) || 1, 1);
  }, [start, end]);

  const rows = useMemo(() => {
    return group.map((b) => {
      const product = products.find((p) => p.id === b.productId);
      const range =
        start && end
          ? availableInRange(bookings, b.productId, toKey(start), toKey(end), b.id)
          : { available: product?.stock ?? 0, conflicts: [] as { day: string; available: number }[] };
      const maxQty = Math.max(range.available, 0);
      const qty = Math.min(Math.max(qtys[b.id] ?? b.qty, 1), Math.max(maxQty, 1));
      return {
        booking: b,
        product,
        name: product?.name ?? "Koleksi",
        unit: product?.unit ?? "pcs",
        maxQty,
        qty,
        conflicts: range.conflicts,
        subtotal: (product?.price ?? 0) * qty * days,
      };
    });
  }, [group, bookings, start, end, days, qtys]);

  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  const anyFull = rows.some((r) => r.maxQty === 0);
  const canSave = Boolean(start && end) && rows.length > 0 && !anyFull;

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Kelola Booking"
        title="Ubah atau Batalkan Booking"
        description="Masukkan kode booking Anda. Semua item dalam satu nota bisa diubah tanggal dan jumlah unitnya, langsung dicek terhadap jadwal."
      />

      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
        <form
          className="surface-card flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/kelola-booking", search: { kode: query.trim() } });
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="kode">Kode Booking</Label>
            <Input
              id="kode"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Contoh: RN-2401"
              className="rounded-xl"
            />
          </div>
          <Button type="submit" size="lg" className="rounded-full">
            <Search className="mr-2 h-4 w-4" /> Cari Booking
          </Button>
        </form>

        {kode && !head ? (
          <p className="mt-6 flex items-center gap-2 rounded-xl bg-warning/10 p-4 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Kode <span className="font-semibold">{kode}</span> tidak ditemukan di perangkat ini.
          </p>
        ) : null}

        {head ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              <div className="surface-card p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {head.name}
                    </p>
                    <p className="font-display text-2xl text-primary">{head.code}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {group.length} item ·{" "}
                  {format(parseISO(head.start), "d MMM", { locale: localeId })} –{" "}
                  {format(parseISO(head.end), "d MMM yyyy", { locale: localeId })}
                </p>
              </div>

              <div className="surface-card p-6 sm:p-8">
                <h2 className="text-2xl">Ubah Tanggal</h2>
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
                      className={cn("pointer-events-auto rounded-2xl border border-border p-3")}
                    />
                  </div>
                </div>
              </div>

              <div className="surface-card p-6 sm:p-8">
                <h2 className="text-2xl">Item dalam Nota</h2>
                <div className="mt-5 space-y-4">
                  {rows.map((row) => (
                    <div key={row.booking.id} className="rounded-2xl border border-border p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.name}</p>
                          <p className="text-xs uppercase tracking-widest text-primary">
                            {row.product?.category}
                          </p>
                        </div>
                        {rows.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-destructive"
                            onClick={() => {
                              removeBooking(row.booking.id);
                              refresh();
                              toast.success(`${row.name} dihapus dari nota ${head.code}`);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          onClick={() =>
                            setQtys((p) => ({ ...p, [row.booking.id]: Math.max(1, row.qty - 1) }))
                          }
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
                          onClick={() =>
                            setQtys((p) => ({
                              ...p,
                              [row.booking.id]: Math.min(row.maxQty, row.qty + 1),
                            }))
                          }
                          disabled={row.qty >= row.maxQty}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          tersedia {row.maxQty} dari {row.product?.stock ?? 0} {row.unit} pada tanggal ini ·{" "}
                          {formatIDR(row.subtotal)}
                        </span>
                      </div>

                      {row.conflicts.length > 0 ? (
                        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-4 text-sm text-warning">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          Tanggal{" "}
                          {row.conflicts
                            .map((c) => format(parseISO(c.day), "d MMM", { locale: localeId }))
                            .join(", ")}{" "}
                          sudah penuh untuk {row.name}. Pilih tanggal lain atau lihat{" "}
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
            </div>

            <aside className="lg:sticky lg:top-28 lg:h-fit">
              <div className="surface-card p-6 sm:p-7">
                <h2 className="text-xl">Ringkasan Baru</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <Row
                    label="Tanggal keluar"
                    value={start ? format(start, "d MMM yyyy", { locale: localeId }) : "-"}
                  />
                  <Row
                    label="Tanggal masuk"
                    value={end ? format(end, "d MMM yyyy", { locale: localeId }) : "-"}
                  />
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
                  disabled={!canSave}
                  onClick={() => {
                    if (!start || !end) return;
                    rows.forEach((row) =>
                      updateBooking(row.booking.id, {
                        qty: row.qty,
                        start: toKey(start),
                        end: toKey(end),
                      }),
                    );
                    refresh();
                    toast.success(`Booking ${head.code} diperbarui`, {
                      description: `${rows.length} item · ${days} hari. Jadwal sudah disesuaikan.`,
                    });
                    void navigate({ to: "/konfirmasi", search: { kode: head.code } });
                  }}
                >
                  {anyFull ? "Tanggal Penuh" : "Simpan Perubahan"}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="mt-3 w-full rounded-full text-destructive"
                  onClick={() => {
                    removeBookingGroup(head.code);
                    refresh();
                    setQuery("");
                    toast.success(`Booking ${head.code} dibatalkan`, {
                      description: "Semua item pada nota ini kembali tersedia di jadwal.",
                    });
                    void navigate({ to: "/kelola-booking", search: {} });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Batalkan Seluruh Nota
                </Button>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </SiteLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
