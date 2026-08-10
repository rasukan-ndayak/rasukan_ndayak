import { Link } from "@tanstack/react-router";
import { ArrowRight, Boxes } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product-image";
import { formatIDR, statusOf, type Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  const status = statusOf(product.stock);

  return (
    <article className="surface-card group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <ProductImage
          src={product.image}
          alt={product.name}
          className="h-full w-full"
          imgClassName="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4">
          <StatusBadge status={status} className="bg-background/90 backdrop-blur" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary">{product.category}</p>
        <h3 className="text-lg leading-snug">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground">{formatIDR(product.price)}</p>
            <p className="text-xs text-muted-foreground">per {product.unit} / hari</p>
          </div>
          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Boxes className="h-4 w-4" /> Stok {product.stock} {product.unit}
          </p>
        </div>
        <Button asChild variant="outline" className="mt-2 w-full rounded-full">
          <Link to="/produk/$id" params={{ id: product.id }}>
            Detail <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}