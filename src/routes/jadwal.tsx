import { createFileRoute } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
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
import { bookingsOn, dayStatusFor, toKey, useBookings } from "@/data/bookings";
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

  const selectedBookings = bookingsOn(bookings, selected).filter(
    (b) => !filterId || b.productId === filterId,
  );
  const selectedInfo = dayStatusFor(bookings, selected, filterId);

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
              const { status, out } = dayStatusFor(bookings, key, filterId);
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
            <h3 className="text-lg">Booking pada tanggal ini</h3>
            {selectedBookings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada barang keluar. Tanggal ini kosong dan bisa dipesan.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {selectedBookings.map((b) => (
                  <li key={b.id} className="rounded-xl border border-border p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{getProduct(b.productId)?.name ?? b.productId}</p>
                      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary">
                        {b.qty} unit
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{b.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Keluar {format(new Date(`${b.start}T00:00:00`), "d MMM", { locale: localeId })} · Masuk{" "}
                      {format(new Date(`${b.end}T00:00:00`), "d MMM yyyy", { locale: localeId })} · {b.code}
                    </p>
                  </li>
                ))}
              </ul>
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
