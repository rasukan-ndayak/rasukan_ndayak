const MAX_SIZE = 1600;
const MAX_BYTES = 8 * 1024 * 1024;

export async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar (JPG, PNG, atau WebP).");
  if (file.size > MAX_BYTES) throw new Error("Ukuran gambar maksimal 8 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("Gagal mengoptimalkan gambar.");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}
