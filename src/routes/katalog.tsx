import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductCard } from "@/components/product-card";
import { PageHeader, SiteLayout } from "@/components/site-layout";
import { categories, useCatalog } from "@/data/products";
import { useBookings, getTerlarisByKategori, getRentalCountMap } from "@/data/bookings";
import { cn } from "@/lib/utils";

type KatalogSearch = { kategori?: string | undefined };

export const Route = createFileRoute("/katalog")({
  validateSearch: (search: Record<string, unknown>): KatalogSearch => ({
    kategori: typeof search["kategori"] === "string"? (search["kategori"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Katalog Sewa — Rasukan Ndayak" },
      {
        name: "description",
        content: "Jelajahi katalog sewa kostum tari, kuluk lancur, kuluk mentok, klinting, dan aksesoris lengkap.",
      },
    ],
  }),
  component: Katalog,
});

function Katalog() {
  const { kategori } = Route.useSearch();
  const navigate = useNavigate();
  const { products } = useCatalog();
  const { bookings } = useBookings();

  const countMap = getRentalCountMap(bookings);
  const terlarisMap = getTerlarisByKategori(bookings, 3);

  console.log("DEBUG:", { 
    bookingsLength: bookings.length, 
    productsLength: products.length,
    terlarisMap,
    countMap 
  });

  const filtered = kategori ? products.filter((p) => p.category === kategori) : products;
  const isSemua = !kategori;
  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Katalog"
        title={kategori?? "Seluruh Koleksi"}
        description={
          isSemua
           ? "Koleksi terlaris minggu ini berdasarkan data sewa — update otomatis."
            : "Setiap koleksi dirawat dan disterilkan sebelum disewakan kembali."
        }
      />

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/katalog", search: {} })}
            className={cn(
              "rounded-full border border-border px-4 py-2 text-sm transition-colors",
             !kategori? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            Semua
          </button>
          {categories.map((c) => (
            <Link
              key={c}
              to="/katalog"
              search={{ kategori: c }}
              className={cn(
                "rounded-full border border-border px-4 py-2 text-sm capitalize transition-colors",
                kategori === c? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {c}
            </Link>
          ))}
        </div>

        {isSemua? (
          <div className="mt-8 space-y-12">
            {Object.entries(terlarisMap).map(([kat, items]) => {
              if (items.length === 0) return null;
              const topId = items[0]?.id;
              const topCount = topId? countMap[topId]?? 0 : 0;

              return (
                <div key={kat}>
                  <div className="flex items-end justify-between">
                    <h2 className="text-xl font-bold capitalize flex items-center gap-2">
                      {kat} Terlaris
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text- font-bold text-white">
                        🔥 {topCount}x disewa
                      </span>
                    </h2>
                    <Link to="/katalog" search={{ kategori: kat }} className="text-sm text-primary hover:underline">
                      Lihat Semua →
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                      <div key={p.id} className="relative">
                        <ProductCard product={p} />
                        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                          {countMap[p.id]?? 0} kali sewa
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="border-t pt-10">
              <h2 className="text-xl font-bold">Seluruh Koleksi</h2>
              <p className="mt-2 text-sm text-muted-foreground">{filtered.length} koleksi ditemukan</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted-foreground">{filtered.length} koleksi ditemukan</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  );
}