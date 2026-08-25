import { createFileRoute, Link } from "@tanstack/react-router";
import {
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Package,
  ReceiptText,
} from "lucide-react";

import {
  PageHeader,
  SiteLayout,
} from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import {
  bookingsByCode,
  useBookings,
} from "@/data/bookings";
import {
  formatIDR,
  useCatalog,
} from "@/data/products";
import { waOrderLink } from "@/lib/whatsapp";

type KonfirmasiSearch = {
  kode?: string | undefined;
};

export const Route = createFileRoute("/konfirmasi")({
  validateSearch: (
    search: Record<string, unknown>,
  ): KonfirmasiSearch => ({
    kode:
      typeof search["kode"] === "string"
        ? (search["kode"] as string)
        : undefined,
  }),

  head: () => ({
    meta: [
      {
        title:
          "Konfirmasi Booking — Rasukan Ndayak",
      },
      {
        name: "description",
        content:
          "Rincian konfirmasi booking Rasukan Ndayak, termasuk tanggal sewa, koleksi, total biaya, DP, dan status pembayaran.",
      },
      {
        property: "og:title",
        content:
          "Konfirmasi Booking — Rasukan Ndayak",
      },
      {
        property: "og:description",
        content:
          "Cek kode booking, tanggal sewa, koleksi, total biaya, DP, dan status pembayaran.",
      },
    ],
  }),

  component: Konfirmasi,
});


function Konfirmasi() {
  const { kode } = Route.useSearch();

  const { bookings } = useBookings();
  const { products } = useCatalog();

  /*
   * =========================================================
   * CARI BOOKING
   * =========================================================
   */

  const last =
    bookings.length > 0
      ? bookings[bookings.length - 1]
      : undefined;

  const group = kode
    ? bookingsByCode(bookings, kode)
    : last
      ? bookingsByCode(
          bookings,
          last.code,
        )
      : [];

  const booking = group[0];


  /*
   * =========================================================
   * JIKA BOOKING BELUM DITEMUKAN
   * =========================================================
   */

  if (!booking) {
    return (
      <SiteLayout>
        <PageHeader
          eyebrow="Konfirmasi"
          title="Booking Tidak Ditemukan"
          description="Kode booking tidak dikenali atau data booking belum berhasil dimuat."
        />

        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
          <div className="surface-card rounded-2xl border p-6 sm:p-8">
            <p className="text-sm leading-6 text-muted-foreground">
              Silakan tunggu beberapa saat lalu
              buka kembali halaman konfirmasi.
              Pastikan kode booking yang digunakan
              benar.
            </p>

            {kode ? (
              <div className="mt-4 rounded-xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  Kode yang dicari
                </p>

                <p className="mt-1 font-mono text-lg font-bold">
                  {kode}
                </p>
              </div>
            ) : null}

            <Button
              asChild
              size="lg"
              className="mt-6 rounded-full"
            >
              <Link to="/booking">
                Buat Booking Baru
              </Link>
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }


  /*
   * =========================================================
   * DATA BOOKING
   * =========================================================
   */

  const days = Math.max(
    differenceInCalendarDays(
      parseISO(booking.end),
      parseISO(booking.start),
    ) || 1,
    1,
  );


  /*
   * =========================================================
   * ITEM BOOKING
   *
   * PENTING:
   * Gunakan priceAtBooking terlebih dahulu.
   * Jadi kalau harga katalog berubah setelah booking,
   * harga booking lama tetap benar.
   * =========================================================
   */

  const items = group.map((b) => {
    const product = products.find(
      (p) => p.id === b.productId,
    );

    const price =
      Number(b.priceAtBooking) > 0
        ? Number(b.priceAtBooking)
        : Number(product?.price ?? 0);

    return {
      booking: b,
      product,
      name:
        product?.name ??
        "Koleksi",
      unit:
        product?.unit ??
        "pcs",
      price,
      subtotal:
        price *
        Number(b.qty) *
        days,
    };
  });


  /*
   * =========================================================
   * TOTAL
   * =========================================================
   */

  const total = items.reduce(
    (sum, item) =>
      sum + item.subtotal,
    0,
  );

  const totalUnit = group.reduce(
    (sum, b) =>
      sum + Number(b.qty || 0),
    0,
  );


  /*
   * =========================================================
   * PAYMENT
   * =========================================================
   */

  const dpRequired =
    Boolean(booking.dpRequired);

  const dpAmount =
    Number(booking.dpAmount || 0);

  const paymentStatus =
    booking.paymentStatus ??
    "not_required";

  const paymentMethod =
    booking.paymentMethod ??
    null;


  /*
   * Jika database sudah mengirim nominal DP,
   * gunakan nominal tersebut.
   *
   * Jika DP diwajibkan tetapi nominal belum ada,
   * fallback ke 0 agar tidak menampilkan angka palsu.
   */

  const remainingAmount =
    Math.max(
      total - dpAmount,
      0,
    );


  /*
   * =========================================================
   * LABEL STATUS BOOKING
   * =========================================================
   */

  const bookingStatus =
    booking.status ??
    "pending";


  /*
   * =========================================================
   * LABEL STATUS PEMBAYARAN
   * =========================================================
   */

  const paymentStatusLabel =
    paymentStatus ===
    "paid"
      ? "Sudah Dibayar"
      : paymentStatus ===
          "pending"
        ? "Menunggu Verifikasi"
        : paymentStatus ===
            "rejected"
          ? "Pembayaran Ditolak"
          : paymentStatus ===
              "unpaid"
            ? "Belum Dibayar"
            : "Tidak Diperlukan";


  /*
   * =========================================================
   * LABEL METODE PEMBAYARAN
   * =========================================================
   */

  const paymentMethodLabel =
    paymentMethod ===
    "qris"
      ? "QRIS"
      : paymentMethod ===
          "cash_offline"
        ? "Cash / Tunai"
        : paymentMethod ===
            "transfer_offline"
          ? "Transfer Offline"
          : "-";


  /*
   * =========================================================
   * WHATSAPP
   * =========================================================
   */

  const wa = waOrderLink({
    code:
      booking.code,

    items:
      items.map((item) => ({
        productName:
          item.name,

        qty:
          item.booking.qty,

        unit:
          item.unit,

        subtotal:
          formatIDR(
            item.subtotal,
          ),
      })),

    start:
      booking.start,

    end:
      booking.end,

    days,

    total:
      formatIDR(total),

    name:
      booking.name,

    phone:
      booking.phone,

    description:
      booking.description,
  });


  /*
   * =========================================================
   * FORMAT TANGGAL
   * =========================================================
   */

  const tgl = (value: string) => {
    try {
      return format(
        parseISO(value),
        "EEEE, d MMMM yyyy",
        {
          locale: localeId,
        },
      );
    } catch {
      return value;
    }
  };


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Konfirmasi"
        title="Booking Anda Tercatat"
        description="Simpan kode booking ini dan tunjukkan saat pengambilan di Semawe, Sokorini, Muntilan, Magelang."
      />

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-12 lg:grid-cols-[1.3fr_1fr] lg:px-8">

        {/* =====================================================
            KIRI
        ====================================================== */}

        <div className="space-y-6">

          {/* =========================
              KODE BOOKING
          ========================= */}

          <div className="surface-card rounded-2xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />

              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Kode Booking
                </p>

                <p className="font-display text-2xl font-bold text-primary">
                  {booking.code}
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">

              <Info
                icon={
                  <CalendarCheck className="h-4 w-4 text-primary" />
                }
                label="Tanggal Keluar"
                value={tgl(booking.start)}
              />

              <Info
                icon={
                  <CalendarCheck className="h-4 w-4 text-primary" />
                }
                label="Tanggal Masuk"
                value={tgl(booking.end)}
              />

              <Info
                icon={
                  <Package className="h-4 w-4 text-primary" />
                }
                label="Jumlah Unit"
                value={`${totalUnit} unit · ${items.length} item`}
              />

              <Info
                icon={
                  <Package className="h-4 w-4 text-primary" />
                }
                label="Durasi Sewa"
                value={`${days} hari`}
              />
            </div>
          </div>


          {/* =========================
              STATUS BOOKING
          ========================= */}

          <div className="surface-card rounded-2xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <ReceiptText className="h-5 w-5 text-primary" />

              <h2 className="text-xl font-bold">
                Status Booking
              </h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <StatusBox
                label="Status Booking"
                value={formatBookingStatus(
                  bookingStatus,
                )}
              />

              <StatusBox
                label="Status Pembayaran"
                value={paymentStatusLabel}
                highlight={
                  paymentStatus ===
                  "paid"
                }
              />

              <StatusBox
                label="Metode Pembayaran"
                value={
                  paymentMethodLabel
                }
              />

              <StatusBox
                label="Status Member"
                value={
                  booking.memberStatus ===
                  "member"
                    ? "Member"
                    : "Penyewa Baru"
                }
              />
            </div>
          </div>


          {/* =========================
              DATA PENYEWA
          ========================= */}

          <div className="surface-card rounded-2xl border p-6 sm:p-8">
            <h2 className="text-xl font-bold">
              Data Penyewa
            </h2>

            <dl className="mt-4 space-y-3 text-sm">

              <Row
                label="Nama"
                value={
                  booking.name ||
                  "-"
                }
              />

              <Row
                label="WhatsApp"
                value={
                  booking.phone ||
                  "-"
                }
              />

              <Row
                label="Deskripsi"
                value={
                  booking.description ||
                  "-"
                }
              />

              <Row
                label="Lokasi ambil"
                value="Semawe, Sokorini, Muntilan, Magelang"
              />

            </dl>
          </div>


          {/* =========================
              INFORMASI PEMBAYARAN
          ========================= */}

          <div className="surface-card rounded-2xl border p-6 sm:p-8">

            <div className="flex items-center gap-3">
              <ReceiptText className="h-5 w-5 text-primary" />

              <h2 className="text-xl font-bold">
                Informasi Pembayaran
              </h2>
            </div>

            {!dpRequired ? (
              <div className="mt-5 rounded-xl border bg-green-50 p-4">
                <p className="font-semibold text-green-700">
                  Pembayaran DP tidak diperlukan.
                </p>

                <p className="mt-1 text-sm text-green-700/80">
                  Silakan lakukan pembayaran
                  sesuai ketentuan saat
                  pengambilan atau konfirmasi
                  dengan admin.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">

                <PaymentRow
                  label="Total Booking"
                  value={formatIDR(total)}
                />

                <PaymentRow
                  label="DP Wajib"
                  value={formatIDR(dpAmount)}
                  strong
                />

                <PaymentRow
                  label="Sisa Pembayaran"
                  value={formatIDR(
                    remainingAmount,
                  )}
                />

                <div className="border-t pt-4">
                  <PaymentRow
                    label="Status"
                    value={
                      paymentStatusLabel
                    }
                    strong
                  />

                  <div className="mt-3">
                    <PaymentRow
                      label="Metode"
                      value={
                        paymentMethodLabel
                      }
                    />
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>


        {/* =====================================================
            KANAN
        ====================================================== */}

        <aside className="lg:sticky lg:top-28 lg:h-fit">

          <div className="surface-card rounded-2xl border p-6 sm:p-7">

            <h2 className="text-xl font-bold">
              Ringkasan Biaya
            </h2>

            <div className="mt-5 space-y-4">

              {items.map((item) => (
                <div
                  key={item.booking.id}
                  className="flex gap-4"
                >

                  {item.product ? (
                    <ProductImage
                      src={
                        item.product.image
                      }
                      alt={
                        item.product.name
                      }
                      className="h-20 w-16 shrink-0 rounded-xl"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">

                    <p className="truncate font-medium">
                      {item.name}
                    </p>

                    <p className="text-xs uppercase tracking-widest text-primary">
                      {
                        item.product
                          ?.category
                      }
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.booking.qty}{" "}
                      {item.unit} ×{" "}
                      {formatIDR(
                        item.price,
                      )}{" "}
                      × {days} hari
                    </p>

                  </div>

                  <p className="shrink-0 text-sm font-medium">
                    {formatIDR(
                      item.subtotal,
                    )}
                  </p>

                </div>
              ))}

            </div>


            {/* TOTAL */}

            <div className="mt-5 flex items-center justify-between border-t border-border pt-5">

              <span className="text-sm text-muted-foreground">
                Total
              </span>

              <span className="font-display text-2xl font-bold text-primary">
                {formatIDR(total)}
              </span>

            </div>


            {/* DP */}

            {dpRequired ? (
              <div className="mt-4 rounded-xl bg-primary/5 p-4">

                <div className="flex items-center justify-between gap-4">

                  <span className="text-sm text-muted-foreground">
                    DP Wajib
                  </span>

                  <span className="font-bold text-primary">
                    {formatIDR(
                      dpAmount,
                    )}
                  </span>

                </div>

                <div className="mt-2 flex items-center justify-between gap-4">

                  <span className="text-sm text-muted-foreground">
                    Sisa
                  </span>

                  <span className="font-semibold">
                    {formatIDR(
                      remainingAmount,
                    )}
                  </span>

                </div>

              </div>
            ) : null}


            {/* STATUS PEMBAYARAN */}

            <div className="mt-4 rounded-xl border p-4">

              <div className="flex items-center gap-2">

                {paymentStatus ===
                "paid" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock3 className="h-5 w-5 text-amber-600" />
                )}

                <span className="font-semibold">
                  {paymentStatusLabel}
                </span>

              </div>

              {dpRequired &&
              paymentStatus !==
                "paid" ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Silakan lakukan
                  pembayaran DP sesuai
                  instruksi dari admin.
                </p>
              ) : null}

            </div>


            {/* TOMBOL */}

            <div className="mt-6 grid gap-3">

              <Button
                asChild
                size="lg"
                className="rounded-full"
              >
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Kirim ke WhatsApp
                </a>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link to="/jadwal">
                  Lihat Jadwal
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link to="/booking">
                  Booking Lagi
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link
                  to="/kelola-booking"
                  search={{
                    kode:
                      booking.code,
                  }}
                >
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


/* =========================================================
   COMPONENT INFO
========================================================= */

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">

      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </p>

      <p className="mt-2 font-medium">
        {value}
      </p>

    </div>
  );
}


/* =========================================================
   ROW
========================================================= */

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <dt className="text-muted-foreground">
        {label}
      </dt>

      <dd className="max-w-[65%] text-right font-medium">
        {value}
      </dd>

    </div>
  );
}


/* =========================================================
   STATUS BOX
========================================================= */

function StatusBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-4">

      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>

      <p
        className={
          "mt-2 font-semibold " +
          (highlight
            ? "text-green-600"
            : "")
        }
      >
        {value}
      </p>

    </div>
  );
}


/* =========================================================
   PAYMENT ROW
========================================================= */

function PaymentRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">

      <span className="text-sm text-muted-foreground">
        {label}
      </span>

      <span
        className={
          strong
            ? "font-bold text-primary"
            : "font-medium"
        }
      >
        {value}
      </span>

    </div>
  );
}


/* =========================================================
   BOOKING STATUS FORMATTER
========================================================= */

function formatBookingStatus(
  status: string,
) {
  switch (
    status
  ) {
    case "pending":
      return "Menunggu Konfirmasi";

    case "confirmed":
      return "Dikonfirmasi";

    case "completed":
      return "Selesai";

    case "cancelled":
      return "Dibatalkan";

    default:
      return status
        ? status
            .replace(
              /_/g,
              " ",
            )
            .replace(
              /\b\w/g,
              (c) =>
                c.toUpperCase(),
            )
        : "Menunggu Konfirmasi";
  }
}