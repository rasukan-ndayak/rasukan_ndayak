import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { ProductCard } from "@/components/product-card";
import { PageHeader, SiteLayout } from "@/components/site-layout";
import { categories, useCatalog } from "@/data/products";
import { cn } from "@/lib/utils";

type KatalogSearch = { kategori?: string | undefined };

export const Route = createFileRoute("/katalog")({
  validateSearch: (search: Record<string, unknown>): KatalogSearch => ({
    kategori: typeof search["kategori"] === "string" ? (search["kategori"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Katalog Sewa — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Jelajahi katalog sewa kostum tari, kuluk lancur, kuluk mentok, klinting, dan aksesoris lengkap dengan harga dan stok.",
      },
      { property: "og:title", content: "Katalog Sewa — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Harga sewa harian, status ketersediaan, dan detail setiap koleksi adat Dayak.",
      },
    ],
  }),
  component: Katalog,
});

function Katalog() {
  const { kategori } = Route.useSearch();
  const navigate = useNavigate();
  const { products } = useCatalog();
  const filtered = kategori ? products.filter((p) => p.category === kategori) : products;

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Katalog"
        title={kategori ?? "Seluruh Koleksi"}
        description="Setiap koleksi dirawat dan disterilkan sebelum disewakan kembali."
      />

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/katalog", search: {} })}
            className={cn(
              "rounded-full border border-border px-4 py-2 text-sm transition-colors",
              !kategori ? "bg-primary text-primary-foreground" : "hover:bg-accent",
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
                "rounded-full border border-border px-4 py-2 text-sm transition-colors",
                kategori === c ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {c}
            </Link>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">{filtered.length} koleksi ditemukan</p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}