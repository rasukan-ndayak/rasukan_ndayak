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
import { useState } from "react";

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
  const stats = [
    { label: "Total Produk", value: String(products.length), icon: Package, hint: "Sesuai katalog" },
    {
      label: "Booking Hari Ini",
      value: String(todayBookings.length),
      icon: CalendarDays,
      hint: `${outToday} unit keluar`,
    },
    { label: "Pendapatan", value: formatIDR(revenue), icon: Wallet, hint: "Akumulasi booking" },
    {
      label: "Stok Tersedia",
      value: `${Math.max(totalStock - outToday, 0)} unit`,
      icon: Boxes,
      hint: `dari total ${totalStock} unit`,
    },
  ];

  return (
    <div className="flex min-h-screen bg-secondary/40">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary font-display text-primary-foreground">
            R
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display">Rasukan Ndayak</span>
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
              <Icon className="h-4 w-4" /> {key}
            </button>
          ))}
        </nav>

        <Button asChild variant="outline" className="mt-auto rounded-full">
          <Link to="/">Kembali ke situs</Link>
        </Button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background px-5 py-4 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-2xl">{active}</h1>
            <p className="truncate text-sm text-muted-foreground">
              Ringkasan operasional Rasukan Ndayak
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            AD
          </span>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-background px-5 py-3 lg:hidden">
          {menu.map(({ key }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn(
                "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs",
                active === key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {key}
            </button>
          ))}
        </nav>

        <div className="space-y-6 p-5 lg:p-8">
          {active === "Produk" ? (
            <AdminProducts products={products} refresh={refreshCatalog} />
          ) : (
            <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, hint }) => (
              <div key={label} className="surface-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-4 font-display text-2xl">{value}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-success">
                  <ArrowUpRight className="h-3 w-3" /> {hint}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-5">
                <h2 className="text-lg">Booking Terbaru</h2>
                <Button variant="ghost" size="sm" className="rounded-full">
                  Lihat semua
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Kode</th>
                      <th className="px-5 py-3">Penyewa</th>
                      <th className="px-5 py-3">Koleksi</th>
                      <th className="px-5 py-3">Keluar → Masuk</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr className="border-t border-border">
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                          Belum ada booking masuk.
                        </td>
                      </tr>
                    ) : null}
                    {recent.map((b) => {
                      const p = getProduct(b.productId);
                      const aktif = bookingsOn(bookings, todayKey).some((x) => x.id === b.id);
                      return (
                        <tr key={b.id} className="border-t border-border">
                          <td className="px-5 py-3 font-medium">{b.code}</td>
                          <td className="px-5 py-3">{b.name}</td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {p?.name ?? b.productId} · {b.qty}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {format(new Date(`${b.start}T00:00:00`), "d MMM", { locale: localeId })} →{" "}
                            {format(new Date(`${b.end}T00:00:00`), "d MMM yyyy", { locale: localeId })}
                          </td>
                          <td className="px-5 py-3">{formatIDR((p?.price ?? 0) * b.qty)}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                              {aktif ? "Sedang keluar" : "Terjadwal"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-lg">Status Stok</h2>
              <ul className="mt-4 space-y-4">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <ProductImage
                      src={p.image}
                      alt={p.name}
                      className="h-12 w-12 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.stock} unit tersedia</p>
                    </div>
                    <StatusBadge status={statusOf(p.stock)} />
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