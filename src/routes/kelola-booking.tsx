import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  Clock3,
  Minus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addBookingItem,
  availableInRange,
  bookingsByName,
  formatWibDateTime,
  removeBooking,
  removeBookingGroup,
  toKey,
  toWibDateTime,
  updateBooking,
  updateBookingStatus,
  useBookings,
  wibTime,
} from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";

type Search = { nama?: string | undefined };
export const Route = createFileRoute("/kelola-booking")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    nama: typeof search["nama"] === "string" ? search["nama"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Ubah atau Batalkan Booking — Rasukan Ndayak" }] }),
  component: KelolaBooking,
});

function KelolaBooking() {
  const { nama } = Route.useSearch();
  const navigate = useNavigate();
  const { bookings, refresh } = useBookings();
  const { products } = useCatalog();
  const [query, setQuery] = useState(nama ?? "");
  const [start, setStart] = useState<Date>();
  const [end, setEnd] = useState<Date>();
  const [pickupTime, setPickupTime] = useState("16:00");
  const [performanceDate, setPerformanceDate] = useState("");
  const [performanceTime, setPerformanceTime] = useState("19:00");
  const [returnTime, setReturnTime] = useState("13:00");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [newQty, setNewQty] = useState(1);

  const group = useMemo(() => (nama ? bookingsByName(bookings, nama) : []), [bookings, nama]);
  const head = group[0];
  const groupKey = group
    .map(
      (b) =>
        `${b.id}:${b.qty}:${b.start}:${b.end}:${b.pickupAt}:${b.performanceAt}:${b.returnAt}:${b.status}`,
    )
    .join("|");

  useEffect(() => {
    if (!head) return;
    setStart(parseISO(head.start));
    setEnd(parseISO(head.end));
    setPickupTime(wibTime(head.pickupAt) === "-" ? "16:00" : wibTime(head.pickupAt));
    setPerformanceDate(head.performanceAt ? head.performanceAt.slice(0, 10) : head.start);
    setPerformanceTime(wibTime(head.performanceAt) === "-" ? "19:00" : wibTime(head.performanceAt));
    setReturnTime(wibTime(head.returnAt) === "-" ? "13:00" : wibTime(head.returnAt));
    setQtys(Object.fromEntries(group.map((b) => [b.id, b.qty])));
  }, [head?.id, groupKey]);

  const days = useMemo(
    () => (start && end ? Math.max(differenceInCalendarDays(end, start), 1) : 1),
    [start, end],
  );
  const schedule =
    start && end
      ? {
          pickupAt: toWibDateTime(toKey(start), pickupTime),
          performanceAt: toWibDateTime(performanceDate || toKey(start), performanceTime),
          returnAt: toWibDateTime(toKey(end), returnTime),
        }
      : null;
  const scheduleValid = Boolean(
    schedule &&
    new Date(schedule.pickupAt) < new Date(schedule.performanceAt) &&
    new Date(schedule.performanceAt) < new Date(schedule.returnAt),
  );

  const rows = useMemo(
    () =>
      group.map((b) => {
        const product = products.find((p) => p.id === b.productId);
        const range =
          start && end
            ? availableInRange(
                bookings,
                b.productId,
                toKey(start),
                toKey(end),
                b.bookingId,
                [],
                schedule ?? undefined,
              )
            : {
                available: product?.stock ?? 0,
                conflicts: [] as { day: string; available: number }[],
              };
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
          subtotal: (product?.price ?? b.priceAtBooking ?? 0) * qty * days,
        };
      }),
    [group, products, bookings, start, end, schedule?.pickupAt, schedule?.returnAt, days, qtys],
  );

  const availableProducts = useMemo(
    () =>
      start && end
        ? products
            .filter((p) => !group.some((b) => b.productId === p.id))
            .map((product) => ({
              product,
              available: availableInRange(
                bookings,
                product.id,
                toKey(start),
                toKey(end),
                head?.bookingId,
                [],
                schedule ?? undefined,
              ).available,
            }))
        : [],
    [
      products,
      group,
      bookings,
      start,
      end,
      head?.bookingId,
      schedule?.pickupAt,
      schedule?.returnAt,
    ],
  );
  const selectedProductInfo = availableProducts.find((x) => x.product.id === selectedProduct);
  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  const anyFull = rows.some((r) => r.maxQty === 0);

  const handleSave = async () => {
    if (!head || !start || !end || !schedule || !scheduleValid) {
      toast.error("Jadwal belum valid.", {
        description:
          "Pastikan urutan ambil → pentas → kembali benar dan menggunakan format 24 jam.",
      });
      return;
    }
    if (anyFull) {
      toast.error("Jadwal bertabrakan dengan stok yang tersedia.");
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        rows.map((row) =>
          updateBooking(row.booking.id, {
            qty: row.qty,
            start: toKey(start),
            end: toKey(end),
            pickupAt: schedule.pickupAt,
            performanceAt: schedule.performanceAt,
            returnAt: schedule.returnAt,
          }),
        ),
      );
      await refresh();
      toast.success(`Booking ${head.code} diperbarui`, {
        description: "Perubahan jadwal dan jumlah unit sudah disimpan.",
      });
    } catch (error) {
      toast.error("Perubahan booking gagal disimpan", {
        description: error instanceof Error ? error.message : "Periksa koneksi Supabase.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (
    status: "confirmed" | "picked_up" | "paid" | "returned" | "cancelled",
  ) => {
    if (!head) return;
    try {
      await updateBookingStatus(head.bookingId, status);
      await refresh();
      toast.success(`Status booking diubah menjadi ${statusLabel(status)}.`);
    } catch (error) {
      toast.error("Status gagal diubah", {
        description: error instanceof Error ? error.message : "Periksa koneksi Supabase.",
      });
    }
  };

  const handleAddProduct = async () => {
    if (!head || !selectedProductInfo) return;
    if (newQty > selectedProductInfo.available) {
      toast.error("Jumlah melebihi stok tersedia.");
      return;
    }
    try {
      await addBookingItem(head.bookingId, selectedProduct, newQty);
      await refresh();
      setSelectedProduct("");
      setNewQty(1);
      toast.success("Produk berhasil ditambahkan ke nota.");
    } catch (error) {
      toast.error("Produk gagal ditambahkan", {
        description: error instanceof Error ? error.message : "Periksa koneksi Supabase.",
      });
    }
  };

  const handleCancel = async () => {
    if (!head) return;
    if (!window.confirm(`Batalkan seluruh booking ${head.code}?`)) return;
    try {
      await removeBookingGroup(head.code);
      await refresh();
      setQuery("");
      toast.success(`Booking ${head.code} dibatalkan`, {
        description: "Semua unit kembali tersedia di jadwal.",
      });
      await navigate({ to: "/kelola-booking", search: {} });
    } catch (error) {
      toast.error("Booking gagal dibatalkan", {
        description: error instanceof Error ? error.message : "Periksa koneksi Supabase.",
      });
    }
  };

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Kelola Booking"
        title="Ubah atau Batalkan Booking"
        description="Cari nama penyewa untuk mengubah jadwal, jumlah unit, atau status. Semua jam menggunakan format 24 jam WIB."
      />
      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
        <form
          className="surface-card flex flex-col gap-3 p-6 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/kelola-booking", search: { nama: query.trim() } });
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="nama">Nama Penyewa</Label>
            <Input
              id="nama"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Contoh: Cinze art production"
              className="rounded-xl"
            />
          </div>
          <Button type="submit" size="lg" className="rounded-full">
            <Search className="mr-2 h-4 w-4" /> Cari Booking
          </Button>
        </form>
        {nama && !head ? (
          <p className="mt-6 rounded-xl bg-warning/10 p-4 text-sm text-warning">
            <AlertTriangle className="mr-2 inline h-4 w-4" /> Penyewa dengan nama {nama} tidak ditemukan.
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
                  Status saat ini: <b>{statusLabel(head.status)}</b>
                </p>
              </div>
              <div className="surface-card p-6 sm:p-8">
                <h2 className="text-2xl">Jadwal Ambil, Pentas & Kembali</h2>
                <div className="mt-5 grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <CalendarIcon className="h-4 w-4 text-primary" /> Tanggal Ambil
                    </p>
                    <Calendar
                      mode="single"
                      selected={start}
                      onSelect={(d) => d && setStart(d)}
                      locale={localeId}
                      className={cn("pointer-events-auto rounded-2xl border border-border p-3")}
                      disabled={{
                        before:
                          parseISO(head.start) < new Date() ? new Date() : parseISO(head.start),
                      }}
                    />
                  </div>
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <CalendarIcon className="h-4 w-4 text-primary" /> Tanggal Kembali
                    </p>
                    <Calendar
                      mode="single"
                      selected={end}
                      onSelect={(d) => d && d >= (start ?? d) && setEnd(d)}
                      locale={localeId}
                      disabled={start ? { before: start } : undefined}
                      className={cn("pointer-events-auto rounded-2xl border border-border p-3")}
                    />
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <TimeInput
                    id="pickup"
                    label="Jam Ambil"
                    value={pickupTime}
                    onChange={setPickupTime}
                  />
                  <div>
                    <Label htmlFor="performance-date">Tanggal Pentas</Label>
                    <Input
                      id="performance-date"
                      type="date"
                      min={start ? toKey(start) : undefined}
                      max={end ? toKey(end) : undefined}
                      value={performanceDate}
                      onChange={(e) => setPerformanceDate(e.target.value)}
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                  <TimeInput
                    id="performance"
                    label="Jam Pentas"
                    value={performanceTime}
                    onChange={setPerformanceTime}
                  />
                  <TimeInput
                    id="return"
                    label="Jam Kembali"
                    value={returnTime}
                    onChange={setReturnTime}
                  />
                </div>
                {!scheduleValid ? (
                  <p className="mt-4 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                    <Clock3 className="mr-2 inline h-4 w-4" /> Urutan waktu harus ambil → pentas →
                    kembali.
                  </p>
                ) : null}
              </div>
              <div className="surface-card p-6 sm:p-8">
                <h2 className="text-2xl">Item dalam Nota</h2>
                <div className="mt-5 space-y-4">
                  {rows.map((row) => (
                    <div key={row.booking.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{row.name}</p>
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
                            onClick={async () => {
                              try {
                                await removeBooking(row.booking.id);
                                await refresh();
                                toast.success("Item dihapus dari nota.");
                              } catch (error) {
                                toast.error(
                                  error instanceof Error ? error.message : "Item gagal dihapus.",
                                );
                              }
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
                          disabled={row.qty <= 1}
                          onClick={() =>
                            setQtys((p) => ({ ...p, [row.booking.id]: Math.max(1, row.qty - 1) }))
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center font-semibold">{row.qty}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          disabled={row.qty >= row.maxQty}
                          onClick={() =>
                            setQtys((p) => ({
                              ...p,
                              [row.booking.id]: Math.min(row.maxQty, row.qty + 1),
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          maks. {row.maxQty} {row.unit} · {formatIDR(row.subtotal)}
                        </span>
                      </div>
                      {row.conflicts.length ? (
                        <p className="mt-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                          Ada jadwal lain yang bertabrakan pada{" "}
                          {row.conflicts
                            .map((c) => format(parseISO(c.day), "d MMM", { locale: localeId }))
                            .join(", ")}
                          .
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="h-11 rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="">Tambah produk...</option>
                    {availableProducts.map((x) => (
                      <option key={x.product.id} value={x.product.id} disabled={x.available <= 0}>
                        {x.product.name} — tersedia {x.available}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))}
                    className="rounded-xl"
                  />
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full rounded-full"
                  disabled={!selectedProductInfo || newQty > selectedProductInfo.available}
                  onClick={() => void handleAddProduct()}
                >
                  Tambah Produk ke Nota
                </Button>
              </div>
            </div>
            <aside className="lg:sticky lg:top-28 lg:h-fit">
              <div className="surface-card p-6 sm:p-7">
                <h2 className="text-xl">Ringkasan & Status</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <Row label="Ambil" value={`${formatDate(start)} · ${pickupTime}`} />
                  <Row
                    label="Pentas"
                    value={`${formatDate(performanceDate ? parseISO(performanceDate) : undefined)} · ${performanceTime}`}
                  />
                  <Row label="Kembali" value={`${formatDate(end)} · ${returnTime}`} />
                  <Row label="Durasi" value={`${days} hari`} />
                  <Row label="Total" value={formatIDR(total)} />
                </dl>
                <Button
                  size="lg"
                  className="mt-6 w-full rounded-full"
                  disabled={saving || !scheduleValid || anyFull}
                  onClick={() => void handleSave()}
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
                <div className="mt-6 border-t pt-5">
                  <Label>Status Booking</Label>
                  <div className="mt-3 grid gap-2">
                    {(["confirmed", "picked_up", "paid", "returned"] as const).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant={head.status === status ? "default" : "outline"}
                        className="w-full rounded-xl"
                        onClick={() => void handleStatus(status)}
                      >
                        {statusLabel(status)}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="mt-5 w-full rounded-full text-destructive"
                  onClick={() => void handleCancel()}
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
function TimeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={`${id}-time`}>{label} (24 jam)</Label>
      <Input
        id={`${id}-time`}
        type="time"
        step="60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-11 rounded-xl"
      />
    </div>
  );
}
function formatDate(value?: Date) {
  return value && !Number.isNaN(value.getTime())
    ? format(value, "d MMM yyyy", { locale: localeId })
    : "-";
}
function statusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Booking dikonfirmasi";
    case "picked_up":
      return "Sudah diambil";
    case "paid":
      return "Sudah dibayar";
    case "returned":
      return "Sudah kembali";
    case "cancelled":
      return "Dibatalkan";
    default:
      return "Menunggu konfirmasi admin";
  }
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
