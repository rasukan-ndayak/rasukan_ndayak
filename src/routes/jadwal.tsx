import { createFileRoute } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader, SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookingsOn, dayStatusFor, toKey, useBookings, type DayStatus } from "@/data/bookings";
import { useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jadwal")({
  head: () => ({
    meta: [
      { title: "Jadwal Keluar Masuk — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Kalender jadwal sewa Rasukan Ndayak: tanggal yang sudah terisi, tanggal kosong, dan jumlah unit yang keluar setiap harinya.",
      },
      { property: "og:title", content: "Jadwal Keluar Masuk — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Cek tanggal kosong dan terisi agar jadwal sewa tidak bertabrakan.",
      },
    ],
  }),
  component: Jadwal,
});

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function Jadwal() {
  const { bookings } = useBookings();
  const { products } = useCatalog();
  const getProduct = (pid: string) => products.find((p) => p.id === pid);
  const [month, setMonth] = useState(() => startOfMonth(new Date(2026, 0, 1)));
  const [productId, setProductId] = useState<string>("semua");
  const [selected, setSelected] = useState<string>("2026-01-01");

  useEffect(() => {
    setMonth(startOfMonth(new Date()));
    setSelected(toKey(new Date()));
  }, []);

  const filterId = productId === "semua" ? undefined : productId;

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const selectedDate = new Date(`${selected}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);
  const isSelectedPast = isBefore(selectedDate, today);

  const selectedBookings = isSelectedPast
    ? []
    : bookingsOn(bookings, selected).filter(
        (b) => !filterId || b.productId === filterId,
      );
  const selectedBookingGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        name: string;
        code: string;
        start: string;
        items: Array<{ productId: string; qty: number }>;
      }
    >();

    for (const booking of selectedBookings) {
      // Kode booking hanya dipakai secara internal untuk memisahkan transaksi.
      // Kode tidak ditampilkan pada tabel.
      const groupKey = booking.code || booking.id;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.items.push({
          productId: booking.productId,
          qty: booking.qty,
        });
      } else {
        groups.set(groupKey, {
          name: booking.name,
          code: booking.code,
          start: booking.start,
          items: [{
            productId: booking.productId,
            qty: booking.qty,
          }],
        });
      }
    }

    return Array.from(groups.values());
  }, [selectedBookings]);

  const selectedCollectionDetails = useMemo(() => {
    const details = new Map<string, { name: string; total: number; out: number }>();

    for (const booking of selectedBookings) {
      const product = getProduct(booking.productId);
      if (!product) continue;

      const existing = details.get(booking.productId);
      if (existing) {
        existing.out += booking.qty;
      } else {
        details.set(booking.productId, {
          name: product.name,
          total: product.stock,
          out: booking.qty,
        });
      }
    }

    return Array.from(details.entries()).map(([productId, detail]) => ({
      productId,
      ...detail,
      remaining: Math.max(detail.total - detail.out, 0),
    }));
  }, [selectedBookings, products]);

  const baseSelectedInfo = dayStatusFor(bookings, selected, filterId);
  const selectedInfo = isSelectedPast
    ? { status: "Kosong" as DayStatus, out: 0, capacity: baseSelectedInfo.capacity }
    : baseSelectedInfo;

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Jadwal"
        title="Jadwal Keluar & Masuk"
        description="Kalender ketersediaan koleksi. Tanggal berwarna berarti sudah ada unit yang keluar; angka menunjukkan berapa unit keluar pada tanggal tersebut."
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1.6fr_1fr] lg:px-8">
        <div className="surface-card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Bulan sebelumnya"
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-40 text-center font-display text-xl">
                {format(month, "MMMM yyyy", { locale: localeId })}
              </p>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Bulan berikutnya"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="w-full sm:w-64">
              <Label className="sr-only">Filter koleksi</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua koleksi</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const key = toKey(day);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dayCopy = new Date(day);
              dayCopy.setHours(0, 0, 0, 0);
              const isPast = isBefore(dayCopy, today);
              const { status: rawStatus, out: rawOut } = dayStatusFor(bookings, key, filterId);
              const status = isPast ? "Kosong" : rawStatus;
              const out = isPast ? 0 : rawOut;
              const inMonth = isSameMonth(day, month);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition-all",
                    inMonth ? "border-border" : "border-transparent opacity-40",
                    status === "Kosong" && "bg-background hover:bg-accent",
                    status === "Terisi" && "border-warning/40 bg-warning/10 text-warning",
                    status === "Penuh" && "border-primary/40 bg-primary/10 text-primary",
                    selected === key && "ring-2 ring-primary ring-offset-2",
                    isToday(day) && "font-bold",
                  )}
                >
                  <span>{format(day, "d")}</span>
                  <span className="text-[10px] leading-none">{out > 0 ? `${out} keluar` : "kosong"}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Legend className="bg-background border border-border" label="Kosong" />
            <Legend className="bg-warning/30" label="Sebagian terisi" />
            <Legend className="bg-primary/30" label="Penuh / stok habis" />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">Detail Tanggal</p>
            <h2 className="mt-2 text-2xl">
              {format(new Date(`${selected}T00:00:00`), "d MMMM yyyy", { locale: localeId })}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-muted-foreground">Unit keluar</p>
                <p className="font-display text-2xl text-primary">{selectedInfo.out}</p>
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-muted-foreground">Sisa siap sewa</p>
                <p className="font-display text-2xl">
                  {Math.max(selectedInfo.capacity - selectedInfo.out, 0)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Status tanggal: <span className="font-semibold text-foreground">{selectedInfo.status}</span>
            </p>
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg">1. Rincian Koleksi</h3>
            {selectedCollectionDetails.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada koleksi yang keluar pada tanggal ini.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Koleksi
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Keluar
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Sisa
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCollectionDetails.map((item) => (
                      <tr key={item.productId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-right">{item.total} unit</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">
                          {item.out} unit
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {item.remaining} unit
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg">2. Booking pada tanggal ini</h3>
            {selectedBookings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada barang keluar. Tanggal ini kosong dan bisa dipesan.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {selectedBookingGroups.map((group) => (
                  <div
                    key={group.code || `${group.name}-${group.start}`}
                    className="overflow-hidden rounded-xl border border-border"
                  >
                    <div className="border-b border-border bg-secondary px-4 py-3">
                      <p className="font-semibold">{group.name}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background">
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                              Koleksi
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                              Unit
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item, index) => (
                            <tr
                              key={`${group.code}-${item.productId}-${index}`}
                              className="border-b border-border last:border-b-0"
                            >
                              <td className="px-4 py-3 font-medium">
                                {getProduct(item.productId)?.name ?? item.productId}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-primary">
                                {item.qty} unit
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-3.5 w-3.5 rounded-md", className)} />
      {label}
    </span>
  );
}