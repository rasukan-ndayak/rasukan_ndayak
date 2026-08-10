export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";
export const CLOUDINARY_PRODUCT_FOLDER = "rasukan-ndayak/products";

export function img(_folder: string, _fileName: string) {
  // Foto katalog sengaja kosong. Admin mengisi foto dari panel admin.
  return "";
}

export async function uploadToCloudinary(file: File, _folder = CLOUDINARY_PRODUCT_FOLDER) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary belum dikonfigurasi. Isi VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET.");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  // Folder is configured in the Cloudinary upload preset. Do not override it here.
  // This also avoids 400 errors when the preset uses a fixed Asset folder.

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || text;
    } catch {
      // Keep the raw response when it is not JSON.
    }
    throw new Error(`Upload Cloudinary gagal (${res.status}): ${message}`);
  }

  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary tidak mengembalikan URL foto.");
  return data.secure_url;
}
