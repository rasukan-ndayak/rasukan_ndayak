import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarDays,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

function safeFormatDate(
  value?: string | null,
  pattern = "d MMM yyyy",
) {
  if (!value?.trim()) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "-";

  return format(date, pattern, { locale: localeId });
}

import { AdminGate } from "@/components/admin-gate";
import { AdminProducts } from "@/components/admin-products";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { bookingsOn, toKey, totalOutOn, useBookings } from "@/data/bookings";
import { formatIDR, statusOf, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Rasukan Ndayak" },
      {
        name: "description",
        content: "Pantau produk, booking, pelanggan, dan pendapatan sewa busana adat Dayak.",
      },
      { property: "og:title", content: "Dashboard Admin — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Antarmuka admin untuk mengelola koleksi dan pemesanan Rasukan Ndayak.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AdminGate>
      <Admin />
    </AdminGate>
  );
}

const menu = [
  { key: "Dashboard", icon: LayoutDashboard },
  { key: "Produk", icon: Package },
  { key: "Booking", icon: CalendarDays },
  { key: "Pelanggan", icon: Users },
  { key: "Laporan", icon: BarChart3 },
  { key: "Pengaturan", icon: Settings },
] as const;

// NOTIF KHUSUS ADMIN - HANYA MUNCUL KALAU ADA YANG KELUAR
function JadwalKeluarAlert() {
  const { bookings } = useBookings();
  const keluarHariIni = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return bookings.filter((b: any) => (b.start || "").slice(0, 10) === today);
  }, [bookings]);

  if (keluarHariIni.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-5 animate-pulse">
      <h3 className="font-black text-red-600 text-lg">🔔 ADA {keluarHariIni.length} JADWAL KELUAR HARI INI!</h3>
      <div className="mt-3 grid gap-2">
        {keluarHariIni.map((b: any) => (
          <div key={b.id} className="flex justify-between items-center bg-white rounded-xl p-3 shadow">
            <div>
              <p className="font-bold">{b.productId} - {b.name}</p>
              <p className="text-xs text-gray-500">{b.phone} • {safeFormatDate(b.start)} → {safeFormatDate(b.end)}</p>
            </div>
            <a href={`https://wa.me/${String(b.phone).replace(/[^0-9]/g, "")}?text=Halo%20${b.name},%20kostum%20siap%20diambil%20hari%20ini`} target="_blank" className="rounded-full bg-green-500 px-4 py-1.5 text-xs font-bold text-white">WA</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Admin() {
  const [active, setActive] = useState<string>("Dashboard");

  const { bookings } = useBookings();
  const { products, refresh: refreshCatalog } = useCatalog();

  const getProduct = (id: string) => products.find((p) => p.id === id);

  const todayKey = toKey(new Date());
  const todayBookings = bookingsOn(bookings, todayKey);
  const outToday = totalOutOn(bookings, todayKey);

  const revenue = bookings.reduce(
    (sum, b) => sum + (getProduct(b.productId)?.price ?? 0) * b.qty,
    0,
  );

  const recent = [...bookings].slice(-6).reverse();

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  /* =========================
     GROUP BOOKING
  ========================= */

  const allBookings = Object.values(
    bookings.reduce<
      Record<
        string,
        {
          id: string;
          code: string;
          name: string;
          phone?: string;
          start: string;
          end: string;
          status: string;
          items: typeof bookings;
        }
      >
    >((groups, b) => {
      if (!groups[b.id]) {
        groups[b.id] = {
          id: b.id,
          code: b.code || "-",
          name: b.name || "-",
          phone: b.phone,
          start: b.start || "",
          end: b.end || "",
          status: String(b.status ?? "confirmed"),
          items: [],
        };
      }

      const group = groups[b.id];

if (group) {
  group.items.push(b);
}

return groups;

    }, {}),
  ).sort((a, b) => {
    return (b.start || "").localeCompare(a.start || "");
  });

  /* =========================
     DATA PELANGGAN
  ========================= */

  const customers = Array.from(
    bookings.reduce(
      (
        map,
        b,
      ) => {
        const key = b.phone || b.name || b.id;

        if (!map.has(key)) {
          map.set(key, {
            name: b.name || "-",
            phone: b.phone || "-",
            bookings: new Set<string>(),
            units: 0,
          });
        }

        const customer = map.get(key)!;
        customer.bookings.add(b.id);
        customer.units += b.qty;

        return map;
      },
      new Map<
        string,
        {
          name: string;
          phone: string;
          bookings: Set<string>;
          units: number;
        }
      >(),
    ).values(),
  );

  /* =========================
     STATISTIK
  ========================= */

  const stats = [
    {
      label: "Total Produk",
      value: String(products.length),
      icon: Package,
      hint: "Sesuai katalog",
      action: () => setActive("Produk"),
    },
    {
      label: "Booking Hari Ini",
      value: String(todayBookings.length),
      icon: CalendarDays,
      hint: `${outToday} unit keluar`,
      action: () => setActive("Booking"),
    },
    {
      label: "Pendapatan",
      value: formatIDR(revenue),
      icon: Wallet,
      hint: "Klik untuk melihat rincian",
      action: () => setActive("Laporan"),
    },
    {
      label: "Stok Tersedia",
      value: `${Math.max(totalStock - outToday, 0)} unit`,
      icon: Boxes,
      hint: `dari total ${totalStock} unit`,
      action: () => setActive("Produk"),
    },
  ];

  return (
    <div className="flex min-h-screen bg-secondary/40">
      {/* =========================
          SIDEBAR
      ========================= */}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary font-display text-primary-foreground">
            R
          </span>

          <span className="min-w-0">
            <span className="block truncate font-display">
              Rasukan Ndayak
            </span>

            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
              Admin Panel
            </span>
          </span>
        </Link>

        <nav className="mt-8 flex flex-col gap-1">
          {menu.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active === key
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="h-4 w-4" />
              {key}
            </button>
          ))}
        </nav>

        <Button
          asChild
          variant="outline"
          className="mt-auto rounded-full"
        >
          <Link to="/">Kembali ke situs</Link>
        </Button>
      </aside>

      {/* =========================
          KONTEN UTAMA
      ========================= */}

      <div className="min-w-0 flex-1">
        {/* HEADER */}

        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background px-5 py-4 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-2xl">
              {active}
            </h1>

            <p className="truncate text-sm text-muted-foreground">
              Ringkasan operasional Rasukan Ndayak
            </p>
          </div>

          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            AD
          </span>
        </header>

        {/* MENU MOBILE */}

        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-background px-5 py-3 lg:hidden">
          {menu.map(({ key }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs",
                active === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {key}
            </button>
          ))}
        </nav>

        <div className="space-y-6 p-5 lg:p-8">

          {/* ==================================================
              PRODUK
          ================================================== */}

          {active === "Produk" ? (
            <AdminProducts
              products={products}
              refresh={refreshCatalog}
            />

          ) : active === "Booking" ? (

            /* ==================================================
               BOOKING
            ================================================== */

            <section className="surface-card overflow-hidden">
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl">
                      Semua Booking
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {allBookings.length} booking tersimpan
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setActive("Dashboard")}
                  >
                    Kembali
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Kode</th>
                      <th className="px-5 py-3">Penyewa</th>
                      <th className="px-5 py-3">WhatsApp</th>
                      <th className="px-5 py-3">Koleksi</th>
                      <th className="px-5 py-3">Keluar → Masuk</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {allBookings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-12 text-center text-muted-foreground"
                        >
                          Belum ada booking.
                        </td>
                      </tr>
                    ) : (
                      allBookings.map((booking) => {
                        const total = booking.items.reduce(
                          (sum, item) =>
                            sum +
                            (getProduct(item.productId)?.price ?? 0) *
                              item.qty,
                          0,
                        );

                        return (
                          <tr
                            key={booking.id}
                            className="border-t border-border"
                          >
                            <td className="px-5 py-4 font-medium">
                              {booking.code}
                            </td>

                            <td className="px-5 py-4">
                              {booking.name}
                            </td>

                            <td className="px-5 py-4 text-muted-foreground">
                              {booking.phone || "-"}
                            </td>

                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                {booking.items.map((item, index) => {
                                  const product = getProduct(
                                    item.productId,
                                  );

                                  return (
                                    <div
                                      key={`${item.id}-${item.productId}-${index}`}
                                      className="text-muted-foreground"
                                    >
                                      {product?.name ?? item.productId} ·{" "}
                                      {item.qty}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-muted-foreground">
                              {safeFormatDate(
                                booking.start,
                                "d MMM yyyy",
                              )}{" "}
                              →{" "}
                              {safeFormatDate(
                                booking.end,
                                "d MMM yyyy",
                              )}
                            </td>

                            <td className="px-5 py-4 font-medium">
                              {formatIDR(total)}
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          ) : active === "Pelanggan" ? (

            /* ==================================================
               PELANGGAN
            ================================================== */

            <section className="surface-card overflow-hidden">
              <div className="border-b border-border p-5">
                <h2 className="text-xl">
                  Data Pelanggan
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Daftar pelanggan berdasarkan data booking.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">No</th>
                      <th className="px-5 py-3">Nama</th>
                      <th className="px-5 py-3">WhatsApp</th>
                      <th className="px-5 py-3">Jumlah Booking</th>
                      <th className="px-5 py-3">Total Unit</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-muted-foreground"
                        >
                          Belum ada data pelanggan.
                        </td>
                      </tr>
                    ) : (
                      customers.map((customer, index) => (
                        <tr
                          key={`${customer.phone}-${customer.name}-${index}`}
                          className="border-t border-border"
                        >
                          <td className="px-5 py-4">
                            {index + 1}
                          </td>

                          <td className="px-5 py-4 font-medium">
                            {customer.name}
                          </td>

                          <td className="px-5 py-4 text-muted-foreground">
                            {customer.phone}
                          </td>

                          <td className="px-5 py-4">
                            {customer.bookings.size}
                          </td>

                          <td className="px-5 py-4">
                            {customer.units} unit
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          ) : active === "Laporan" ? (

            /* ==================================================
               LAPORAN
            ================================================== */

            <div className="space-y-6">

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="surface-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Total Pendapatan
                  </p>

                  <p className="mt-3 font-display text-2xl">
                    {formatIDR(revenue)}
                  </p>

                  <p className="mt-1 text-xs text-success">
                    Akumulasi seluruh booking
                  </p>
                </div>

                <div className="surface-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Total Booking
                  </p>

                  <p className="mt-3 font-display text-2xl">
                    {allBookings.length}
                  </p>

                  <p className="mt-1 text-xs text-success">
                    Booking tersimpan
                  </p>
                </div>

                <div className="surface-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Total Pelanggan
                  </p>

                  <p className="mt-3 font-display text-2xl">
                    {customers.length}
                  </p>

                  <p className="mt-1 text-xs text-success">
                    Pelanggan terdata
                  </p>
                </div>

                <div className="surface-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Unit Tersewa
                  </p>

                  <p className="mt-3 font-display text-2xl">
                    {bookings.reduce(
                      (sum, b) => sum + b.qty,
                      0,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-success">
                    Total unit pada booking
                  </p>
                </div>
              </section>

              <section className="surface-card overflow-hidden">
                <div className="border-b border-border p-5">
                  <h2 className="text-xl">
                    Rincian Pendapatan
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Rincian nilai setiap booking.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[750px] text-sm">
                    <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Kode</th>
                        <th className="px-5 py-3">Penyewa</th>
                        <th className="px-5 py-3">Tanggal</th>
                        <th className="px-5 py-3">Unit</th>
                        <th className="px-5 py-3">Pendapatan</th>
                      </tr>
                    </thead>

                    <tbody>
                      {allBookings.map((booking) => {
                        const total = booking.items.reduce(
                          (sum, item) =>
                            sum +
                            (getProduct(item.productId)?.price ?? 0) *
                              item.qty,
                          0,
                        );

                        const units = booking.items.reduce(
                          (sum, item) => sum + item.qty,
                          0,
                        );

                        return (
                          <tr
                            key={`report-${booking.id}`}
                            className="border-t border-border"
                          >
                            <td className="px-5 py-4 font-medium">
                              {booking.code}
                            </td>

                            <td className="px-5 py-4">
                              {booking.name}
                            </td>

                            <td className="px-5 py-4 text-muted-foreground">
                              {safeFormatDate(
                                booking.start,
                                "d MMM yyyy",
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {units} unit
                            </td>

                            <td className="px-5 py-4 font-medium">
                              {formatIDR(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

          ) : active === "Pengaturan" ? (

            /* ==================================================
               PENGATURAN
            ================================================== */

            <section className="surface-card p-6">
              <h2 className="text-xl">
                Pengaturan
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Informasi dan pengaturan dasar panel admin.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">

                <div className="rounded-2xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">
                    Nama Usaha
                  </p>

                  <p className="mt-2 font-medium">
                    Rasukan Ndayak
                  </p>
                </div>

                <div className="rounded-2xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">
                    Panel
                  </p>

                  <p className="mt-2 font-medium">
                    Admin Panel
                  </p>
                </div>

                <div className="rounded-2xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">
                    Total Produk
                  </p>

                  <p className="mt-2 font-medium">
                    {products.length} produk
                  </p>
                </div>

                <div className="rounded-2xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">
                    Total Booking
                  </p>

                  <p className="mt-2 font-medium">
                    {allBookings.length} booking
                  </p>
                </div>

              </div>
            </section>

          ) : (

            /* ==================================================
               DASHBOARD
            ================================================== */

            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(
                  ({
                    label,
                    value,
                    icon: Icon,
                    hint,
                    action,
                  }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="surface-card p-5 text-left transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {label}
                        </span>

                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>

                      <p className="mt-4 font-display text-2xl">
                        {value}
                      </p>

                      <p className="mt-1 flex items-center gap-1 text-xs text-success">
                        <ArrowUpRight className="h-3 w-3" />
                        {hint}
                      </p>
                    </button>
                  ),
                )}
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">

                {/* BOOKING TERBARU */}

                <div className="surface-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border p-5">
                    <h2 className="text-lg">
                      Booking Terbaru
                    </h2>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setActive("Booking")}
                    >
                      Lihat semua
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3">
                            Kode
                          </th>

                          <th className="px-5 py-3">
                            Penyewa
                          </th>

                          <th className="px-5 py-3">
                            Koleksi
                          </th>

                          <th className="px-5 py-3">
                            Keluar → Masuk
                          </th>

                          <th className="px-5 py-3">
                            Total
                          </th>

                          <th className="px-5 py-3">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {recent.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-5 py-10 text-center text-sm text-muted-foreground"
                            >
                              Belum ada booking masuk.
                            </td>
                          </tr>
                        ) : (
                          recent.map((b, index) => {
                            const p = getProduct(b.productId);

                            const aktif = bookingsOn(
                              bookings,
                              todayKey,
                            ).some(
                              (x) => x.id === b.id,
                            );

                            return (
                              <tr
                                key={`${b.id}-${b.productId}-${index}`}
                                className="border-t border-border"
                              >
                                <td className="px-5 py-3 font-medium">
                                  {b.code}
                                </td>

                                <td className="px-5 py-3">
                                  {b.name}
                                </td>

                                <td className="px-5 py-3 text-muted-foreground">
                                  {p?.name ?? b.productId} ·{" "}
                                  {b.qty}
                                </td>

                                <td className="px-5 py-3 text-muted-foreground">
                                  {safeFormatDate(
                                    b.start,
                                    "d MMM",
                                  )}{" "}
                                  →{" "}
                                  {safeFormatDate(
                                    b.end,
                                    "d MMM yyyy",
                                  )}
                                </td>

                                <td className="px-5 py-3">
                                  {formatIDR(
                                    (p?.price ?? 0) *
                                      b.qty,
                                  )}
                                </td>

                                <td className="px-5 py-3">
                                  <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                                    {aktif
                                      ? "Sedang keluar"
                                      : "Terjadwal"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* STATUS STOK */}

                <div className="surface-card p-5">
                  <h2 className="text-lg">
                    Status Stok
                  </h2>

                  <ul className="mt-4 space-y-4">
                    {products.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3"
                      >
                        <ProductImage
                          src={p.image}
                          alt={p.name}
                          className="h-12 w-12 shrink-0 rounded-xl"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.name}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {p.stock} unit tersedia
                          </p>
                        </div>

                        <StatusBadge
                          status={statusOf(p.stock)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}