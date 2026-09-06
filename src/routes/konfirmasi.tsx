import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Package,
  ReceiptText,
} from "lucide-react";
import { PageHeader, SiteLayout } from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { ProductName } from "@/components/product-name";
import { Button } from "@/components/ui/button";
import { bookingsByCode, formatWibDateTime, useBookings, wibTime } from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { waOrderLink } from "@/lib/whatsapp";
import { useBookingNotifications } from "@/data/notifications";

type KonfirmasiSearch = { kode?: string | undefined };
export const Route = createFileRoute("/konfirmasi")({
  validateSearch: (search: Record<string, unknown>): KonfirmasiSearch => ({
    kode: typeof search["kode"] === "string" ? search["kode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Konfirmasi Booking — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Rincian booking Rasukan Ndayak, jadwal, koleksi, total biaya, dan status booking.",
      },
    ],
  }),
  component: Konfirmasi,
});

function bookingStatusLabel(status: string) {
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

function formatDate(value: string) {
  try {
    return format(parseISO(value), "EEEE, d MMMM yyyy", { locale: localeId });
  } catch {
    return value || "-";
  }
}

function Konfirmasi() {
  const { kode } = Route.useSearch();
  const { bookings } = useBookings();
  const { products } = useCatalog();
  const { notifications, permission, requestPermission } = useBookingNotifications(kode);
  const last = bookings.at(-1);
  const group = kode
    ? bookingsByCode(bookings, kode)
    : last
      ? bookingsByCode(bookings, last.code)
      : [];
  const booking = group[0];

  if (!booking)
    return (
      <SiteLayout>
        <PageHeader
          eyebrow="Konfirmasi"
          title="Booking Tidak Ditemukan"
          description="Data booking belum berhasil dimuat atau kode booking tidak dikenali."
        />
        <div className="mx-auto max-w-3xl px-5 py-16">
          <div className="surface-card rounded-2xl border p-8">
            <p className="text-sm text-muted-foreground">
              Tunggu beberapa saat lalu coba kembali dengan kode booking yang benar.
            </p>
            <Button asChild className="mt-6 rounded-full">
              <Link to="/booking">Buat Booking Baru</Link>
            </Button>
          </div>
        </div>
      </SiteLayout>
    );

  const days = Math.max(
    differenceInCalendarDays(parseISO(booking.end), parseISO(booking.start)),
    1,
  );
  const items = group.map((b) => {
    const product = products.find((p) => p.id === b.productId);
    const price =
      Number(b.priceAtBooking) > 0 ? Number(b.priceAtBooking) : Number(product?.price ?? 0);
    return {
      booking: b,
      product,
      name: product?.name ?? "Koleksi",
      unit: product?.unit ?? "pcs",
      price,
      subtotal: price * Number(b.qty) * days,
    };
  });
  const total = items.reduce((sum, x) => sum + x.subtotal, 0);
  const totalUnit = group.reduce((sum, x) => sum + Number(x.qty || 0), 0);
  const wa = waOrderLink({
    code: booking.code,
    items: items.map((x) => ({
      productName: x.name,
      qty: x.booking.qty,
      unit: x.unit,
      subtotal: formatIDR(x.subtotal),
    })),
    start: booking.start,
    end: booking.end,
    pickupAt: booking.pickupAt,
    performanceAt: booking.performanceAt,
    returnAt: booking.returnAt,
    days,
    total: formatIDR(total),
    name: booking.name,
    phone: booking.phone,
    description: booking.description,
  });

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Konfirmasi"
        title="Booking Anda Tercatat"
        description="Simpan kode booking ini dan gunakan untuk mengecek perubahan jadwal atau status dari admin."
      />
      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card rounded-2xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Kode Booking
                </p>
                <p className="font-display text-2xl font-bold text-primary">{booking.code}</p>
              </div>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Info
                icon={<CalendarCheck className="h-4 w-4 text-primary" />}
                label="Tanggal Ambil"
                value={`${formatDate(booking.start)}${booking.pickupAt ? ` · ${wibTime(booking.pickupAt)}` : ""}`}
              />
              <Info
                icon={<CalendarCheck className="h-4 w-4 text-primary" />}
                label="Tanggal Pentas"
                value={booking.performanceAt ? formatWibDateTime(booking.performanceAt) : "-"}
              />
              <Info
                icon={<CalendarCheck className="h-4 w-4 text-primary" />}
                label="Tanggal Kembali"
                value={`${formatDate(booking.end)}${booking.returnAt ? ` · ${wibTime(booking.returnAt)}` : ""}`}
              />
              <Info
                icon={<Package className="h-4 w-4 text-primary" />}
                label="Durasi"
                value={`${days} hari · ${totalUnit} unit`}
              />
            </div>
          </section>

          <section className="surface-card rounded-2xl border p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Notifikasi Booking</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dapatkan pemberitahuan saat admin mengubah jadwal atau status.
                </p>
              </div>
              {permission === "default" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void requestPermission()}
                >
                  Aktifkan Notifikasi
                </Button>
              ) : null}
            </div>
            {notifications.length ? (
              <div className="mt-4 space-y-3">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className="rounded-xl border bg-secondary p-4">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Belum ada pemberitahuan baru.</p>
            )}
          </section>

          <section className="surface-card rounded-2xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <ReceiptText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Status Booking</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <StatusBox label="Status" value={bookingStatusLabel(booking.status)} />
              <StatusBox
                label="Jadwal Ambil"
                value={
                  booking.pickupAt ? formatWibDateTime(booking.pickupAt) : formatDate(booking.start)
                }
              />
              <StatusBox
                label="Pentas"
                value={booking.performanceAt ? formatWibDateTime(booking.performanceAt) : "-"}
              />
              <StatusBox
                label="Kembali"
                value={
                  booking.returnAt ? formatWibDateTime(booking.returnAt) : formatDate(booking.end)
                }
              />
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" /> Semua jam menggunakan format 24 jam WIB.
            </p>
          </section>

          <section className="surface-card rounded-2xl border p-6 sm:p-8">
            <h2 className="text-xl font-bold">Data Penyewa</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Nama" value={booking.name || "-"} />
              <Row label="WhatsApp" value={booking.phone || "-"} />
              <Row label="Deskripsi" value={booking.description || "-"} />
              <Row label="Lokasi ambil" value="Semawe, Sokorini, Muntilan, Magelang" />
            </dl>
          </section>
        </div>
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="surface-card rounded-2xl border p-6 sm:p-7">
            <h2 className="text-xl font-bold">Ringkasan Biaya</h2>
            <div className="mt-5 space-y-4">
              {items.map((item) => (
                <div key={item.booking.id} className="flex gap-4">
                  {item.product ? (
                    <ProductImage
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-20 w-16 shrink-0 rounded-xl"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.product ? <ProductName product={item.product} /> : item.name}
                    </p>
                    <p className="text-xs uppercase tracking-widest text-primary">
                      {item.product?.category}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.booking.qty} {item.unit} × {formatIDR(item.price)} × {days} hari
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatIDR(item.subtotal)}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-5">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold text-primary">
                {formatIDR(total)}
              </span>
            </div>
            <div className="mt-4 rounded-xl border p-4 text-sm">
              <p className="font-semibold">Status: {bookingStatusLabel(booking.status)}</p>
              <p className="mt-1 text-muted-foreground">
                Pembayaran dikonfirmasi langsung oleh admin melalui status booking.
              </p>
            </div>
            <div className="mt-6 grid gap-3">
              <Button asChild size="lg" className="rounded-full">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Kirim ke WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/jadwal">Lihat Jadwal</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}
function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] text-right font-medium">{value}</dd>
    </div>
  );
}
