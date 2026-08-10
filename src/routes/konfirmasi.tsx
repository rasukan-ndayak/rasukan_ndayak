import { createFileRoute, Link } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarCheck, CheckCircle2, MessageCircle, Package } from "lucide-react";

import { PageHeader, SiteLayout } from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { bookingsByCode, useBookings } from "@/data/bookings";
import { formatIDR, useCatalog } from "@/data/products";
import { waOrderLink } from "@/lib/whatsapp";

type KonfirmasiSearch = { kode?: string | undefined };

export const Route = createFileRoute("/konfirmasi")({
  validateSearch: (search: Record<string, unknown>): KonfirmasiSearch => ({
    kode: typeof search["kode"] === "string" ? (search["kode"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Konfirmasi Booking — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Rincian konfirmasi sewa: tanggal keluar dan masuk, jumlah unit, serta ringkasan total biaya booking Rasukan Ndayak.",
      },
      { property: "og:title", content: "Konfirmasi Booking — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Cek kembali tanggal, jumlah unit, dan total biaya sewa sebelum pengambilan.",
      },
    ],
  }),
  component: Konfirmasi,
});

function Konfirmasi() {
  const { kode } = Route.useSearch();
  const { bookings } = useBookings();
  const { products } = useCatalog();
  const last = bookings[bookings.length - 1];
  const group = kode ? bookingsByCode(bookings, kode) : last ? bookingsByCode(bookings, last.code) : [];
  const booking = group[0];

  if (!booking) {
    return (
      <SiteLayout>
        <PageHeader
          eyebrow="Konfirmasi"
          title="Booking Tidak Ditemukan"
          description="Kode booking tidak dikenali atau belum ada booking tersimpan di perangkat ini."
        />
        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/booking">Buat Booking Baru</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  const days = Math.max(differenceInCalendarDays(parseISO(booking.end), parseISO(booking.start)) || 1, 1);
  const items = group.map((b) => {
    const product = products.find((p) => p.id === b.productId);
    const price = product?.price ?? 0;
    return {
      booking: b,
      product,
      name: product?.name ?? "Koleksi",
      unit: product?.unit ?? "pcs",
      price,
      subtotal: price * b.qty * days,
    };
  });
  const total = items.reduce((s, it) => s + it.subtotal, 0);
  const totalUnit = group.reduce((s, b) => s + b.qty, 0);
  const wa = waOrderLink({
    code: booking.code,
    items: items.map((it) => ({
      productName: it.name,
      qty: it.booking.qty,
      unit: it.unit,
      subtotal: formatIDR(it.subtotal),
    })),
    start: booking.start,
    end: booking.end,
    days,
    total: formatIDR(total),
    name: booking.name,
    phone: booking.phone,
  });
  const tgl = (v: string) => format(parseISO(v), "EEEE, d MMMM yyyy", { locale: localeId });

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Konfirmasi"
        title="Booking Anda Tercatat"
        description="Simpan kode booking ini dan tunjukkan saat pengambilan di Semawe, Sokorini, Muntilan, Magelang."
      />

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 lg:grid-cols-[1.3fr_1fr] lg:px-8">
        <div className="space-y-6">
          <div className="surface-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Kode Booking</p>
                <p className="font-display text-2xl text-primary">{booking.code}</p>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Info icon={<CalendarCheck className="h-4 w-4 text-primary" />} label="Tanggal Keluar" value={tgl(booking.start)} />
              <Info icon={<CalendarCheck className="h-4 w-4 text-primary" />} label="Tanggal Masuk" value={tgl(booking.end)} />
              <Info icon={<Package className="h-4 w-4 text-primary" />} label="Jumlah Unit" value={`${totalUnit} unit · ${items.length} item`} />
              <Info icon={<Package className="h-4 w-4 text-primary" />} label="Durasi Sewa" value={`${days} hari`} />
            </div>
          </div>

          <div className="surface-card p-6 sm:p-8">
            <h2 className="text-xl">Data Penyewa</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Nama" value={booking.name} />
              <Row label="WhatsApp" value={booking.phone || "-"} />
              <Row label="Lokasi ambil" value="Semawe, Sokorini, Muntilan, Magelang" />
            </dl>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-xl">Ringkasan Biaya</h2>
            <div className="mt-5 space-y-4">
              {items.map((it) => (
                <div key={it.booking.id} className="flex gap-4">
                  {it.product ? (
                    <ProductImage
                      src={it.product.image}
                      alt={it.product.name}
                      className="h-20 w-16 shrink-0 rounded-xl"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="text-xs uppercase tracking-widest text-primary">
                      {it.product?.category}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {it.booking.qty} {it.unit} × {formatIDR(it.price)} × {days} hari
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatIDR(it.subtotal)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl text-primary">{formatIDR(total)}</span>
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
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/booking">Booking Lagi</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/kelola-booking" search={{ kode: booking.code }}>
                  Ubah / Batalkan Booking
                </Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
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