import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, MapPin, ShieldCheck, Sparkles, Truck } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { categories, useCatalog } from "@/data/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rasukan Ndayak — Sewa Busana Adat Dayak" },
      {
        name: "description",
        content:
          "Sewa kostum tari, kuluk lancur, dan kuluk mentok. Koleksi premium, stok real-time, booking cepat.",
      },
      { property: "og:title", content: "Rasukan Ndayak — Sewa Busana Adat Dayak" },
      {
        property: "og:description",
        content: "Koleksi busana adat Dayak untuk panggung, upacara, dan dokumentasi budaya.",
      },
    ],
  }),
  component: Index,
});

const advantages = [
  { icon: Sparkles, title: "Koleksi Terawat", text: "Dicuci dan disetrika ulang setiap selesai sewa." },
  { icon: CalendarCheck, title: "Booking Fleksibel", text: "Pilih tanggal pakai dan durasi sesuai acara." },
  { icon: ShieldCheck, title: "Tanpa Deposit Ribet", text: "Cukup identitas dan konfirmasi pesanan." },
  { icon: Truck, title: "Antar Dalam Kota", text: "Pengantaran gratis untuk pesanan tertentu." },
];

function Index() {
  const { products } = useCatalog();
  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div className="animate-rise">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">SEWA KOSTUM NDAYAKAN</p>
            <h1 className="mt-5 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">Rasukan Ndayak</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Dalam setiap tarian tersimpan filosofi kehidupan.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link to="/katalog">Lihat Katalog</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                <Link to="/booking">Booking Sekarang</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-7">
                <Link to="/jadwal">Cek Jadwal</Link>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
              <div>
                <dt className="font-display text-2xl text-primary">{products.length}</dt>
                <dd className="text-xs uppercase tracking-widest text-muted-foreground">Koleksi</dd>
              </div>
              <div>
                <dt className="font-display text-2xl text-primary">
                  {products.reduce((s, p) => s + p.stock, 0)}
                </dt>
                <dd className="text-xs uppercase tracking-widest text-muted-foreground">Unit siap</dd>
              </div>
              <div>
                <dt className="font-display text-2xl text-primary">
                  <a
                    href="https://www.google.com/maps/place/Cinze+art_production/@-7.6148053,110.2531306,17z/data=!4m14!1m7!3m6!1s0x2e7a8b1dd3fda71b:0x1a532746954a894c!2sCinze+art_production!8m2!3d-7.6148053!4d110.2531306!16s%2Fg%2F11p73d1k43!3m5!1s0x2e7a8b1dd3fda71b:0x1a532746954a894c!8m2!3d-7.6148053!4d110.2531306!16s%2Fg%2F11p73d1k43?entry=ttu&g_ep=EgoyMDI2MDgwMi4wIKXMDSoASAFQAw%3D%3D"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Lihat lokasi di Google Maps"
                    className="inline-flex items-center justify-center rounded-full bg-primary-soft p-2 text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    <MapPin className="h-6 w-6" />
                  </a>
                </dt>
                <dd className="text-xs uppercase tracking-widest text-muted-foreground">Magelang</dd>
              </div>
            </dl>
          </div>

          <div className="relative animate-rise">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-primary-soft blur-2xl" />
            <img
              src="/header.png"
              alt="Header Dasukan Ndayak - Kostum adat Dayak"
              className="mx-auto w-full max-w-lg rounded-[2.5rem] object-contain"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map(({ icon: Icon, title, text }) => (
            <div key={title} className="surface-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl">Kategori Koleksi</h2>
            <p className="mt-2 text-muted-foreground">Telusuri berdasarkan jenis perlengkapan.</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c}
              to="/katalog"
              search={{ kategori: c }}
              className="surface-card group flex items-center justify-between p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]"
            >
              <span className="font-display text-xl">{c}</span>
              <span className="text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Lihat
              </span>
            </Link>
          ))}
        </div>
      </section>

      {categories.map((c) => {
        const items = products.filter((p) => p.category === c);
        if (items.length === 0) return null;
        return (
          <section key={c} className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl sm:text-4xl">{c}</h2>
                <p className="mt-2 text-muted-foreground">{items.length} koleksi tersedia.</p>
              </div>
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/katalog" search={{ kategori: c }}>
                  Lihat semua {c}
                </Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 3).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="mx-auto mt-20 max-w-7xl px-5 lg:px-8">
        <div className="rounded-[2.5rem] bg-primary px-8 py-14 text-center text-primary-foreground shadow-[var(--shadow-glow)] sm:px-16">
          <h2 className="text-3xl sm:text-4xl">Siap tampil memukau di panggung?</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Amankan tanggal pemakaian Anda sekarang, stok koleksi terbatas untuk musim festival.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8 rounded-full px-8">
            <Link to="/booking">Booking Sekarang</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
