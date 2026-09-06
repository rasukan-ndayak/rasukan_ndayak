import type { Product } from "@/data/products";

const colorClasses: Record<string, string> = {
  biru: "text-blue-600",
  emas: "text-yellow-600",
  gold: "text-yellow-600",
  hijau: "text-green-600",
  hitam: "text-zinc-900",
  kuning: "text-yellow-500",
  merah: "text-red-600",
  orange: "text-orange-500",
  oranye: "text-orange-500",
  pink: "text-pink-500",
  putih: "text-slate-400",
  ungu: "text-purple-600",
};

const colorWordPattern = /\b(biru|emas|gold|hijau|hitam|kuning|merah|orange|oranye|pink|putih|ungu)\b/gi;

export function ProductName({ product, className }: { product: Product; className?: string }) {
  const parts = product.name.split(colorWordPattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const colorClass = colorClasses[part.toLowerCase()];

        return colorClass ? (
          <span key={`${part}-${index}`} className={colorClass}>
            {part}
          </span>
        ) : (
          part
        );
      })}
    </span>
  );
}