import type { HTMLAttributes } from "react";

import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductImageProps = HTMLAttributes<HTMLDivElement> & {
  src?: string | null;
  alt: string;
  imgClassName?: string;
};

/**
 * Renders a product image only when a real URL exists.
 * This prevents React from emitting <img src=""> for products whose
 * photo has not been uploaded to Cloudinary yet.
 */
export function ProductImage({ src, alt, className, imgClassName, ...props }: ProductImageProps) {
  const hasImage = Boolean(src?.trim());

  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)} {...props}>
      {hasImage ? (
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          width={900}
          height={1100}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        <div className="flex h-full min-h-20 w-full flex-col items-center justify-center gap-1 p-3 text-center text-muted-foreground">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-wider">Foto belum diisi</span>
        </div>
      )}
    </div>
  );
}
