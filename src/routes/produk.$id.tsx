import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, Boxes, Check } from "lucide-react";

import { ProductImage } from "@/components/product-image";
import { ProductCard } from "@/components/product-card";
import { SiteLayout } from "@/components/site-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatIDR, loadProducts, useCatalog, statusOf } from "@/data/products";

export const Route = createFileRoute("/produk/$id")({
  loader: async ({ params }) => {
    const product = (await loadProducts()).find((p) => p.id === params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Koleksi tidak ditemukan — Rasukan Ndayak" }, { name: "robots", content: "noindex" }],
      };
    }
    const { product } = loaderData;
    return {
      meta: [
        { title: `${product.name} — Rasukan Ndayak` },
        { name: "description", content: product.description },
        { property: "og:title", content: `${product.name} — Rasukan Ndayak` },
        { property: "og:description", content: product.description },
      ],
    };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { products } = useCatalog();
  const { product } = Route.useLoaderData();
  const status = statusOf(product.stock);
  const related = products.filter((p) => p.id !== product.id && p.category === product.category);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <Link
          to="/katalog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke katalog
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <ProductImage
            src={product.image}
            alt={product.name}
            className="min-h-[360px] w-full rounded-[2rem] border border-border shadow-[var(--shadow-card)]"
            imgClassName="rounded-[2rem]"
          />

          <div className="animate-rise">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-[0.24em] text-primary">
                {product.category}
              </span>
              <StatusBadge status={status} />
            </div>
            <h1 className="mt-4 text-4xl leading-tight">{product.name}</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">{product.description}</p>

            <div className="mt-8 flex flex-wrap items-end gap-8 border-y border-border py-6">
              <div>
                <p className="text-3xl font-semibold text-primary">{formatIDR(product.price)}</p>
                <p className="text-xs text-muted-foreground">harga sewa per hari</p>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Boxes className="h-4 w-4" /> Stok tersedia: {product.stock} unit
              </p>
            </div>

            <ul className="mt-6 space-y-3">
              {product.details.map((d: string) => (
                <li key={d} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {d}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-8" disabled={product.stock === 0}>
                <Link to="/booking" search={{ produk: product.id }}>
                  {product.stock === 0 ? "Stok Habis" : "Booking Sekarang"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <Link to="/kontak">Tanya Ketersediaan</Link>
              </Button>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-20">
            <h2 className="text-2xl">Koleksi Serupa</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SiteLayout>
  );
}