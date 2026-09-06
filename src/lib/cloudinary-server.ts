import { createServerFn } from "@tanstack/react-start";

export type CloudinaryAsset = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
};

type CloudinaryResponse = {
  resources?: CloudinaryAsset[];
  next_cursor?: string;
  error?: { message?: string };
};

const PRODUCT_FOLDERS = [
  "aksesoris",
  "klinting",
  "kostum",
  "kuluk lancur",
  "kuluk mentok",
];

function processEnvironment(name: string) {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return processEnv?.[name] ?? "";
}

function cloudinaryConfig() {
  return {
    cloudName:
      processEnvironment("CLOUDINARY_CLOUD_NAME") || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "",
    apiKey: processEnvironment("CLOUDINARY_API_KEY") || import.meta.env.CLOUDINARY_API_KEY || "",
    apiSecret:
      processEnvironment("CLOUDINARY_API_SECRET") || import.meta.env.CLOUDINARY_API_SECRET || "",
    folder:
      processEnvironment("CLOUDINARY_PRODUCT_FOLDER") ||
      import.meta.env.CLOUDINARY_PRODUCT_FOLDER ||
      "rasukan-ndayak",
  };
}

export const listCloudinaryProductAssets = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data?: { cursor?: string } }) => {
    const { cloudName, apiKey, apiSecret, folder } = cloudinaryConfig();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        "Cloudinary folder belum dikonfigurasi. Isi CLOUDINARY_API_KEY dan CLOUDINARY_API_SECRET di environment server.",
      );
    }

    const auth = btoa(`${apiKey}:${apiSecret}`);
    const folders = folder === "rasukan-ndayak" ? PRODUCT_FOLDERS : [folder];
    const results = await Promise.all(
      folders.map(async (assetFolder) => {
        const body: { expression: string; max_results: number; next_cursor?: string } = {
          expression: `resource_type:image AND type:upload AND asset_folder=${assetFolder}`,
          max_results: 100,
        };
        if (data?.cursor && folders.length === 1) body.next_cursor = data.cursor;
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        const result = (await response.json()) as CloudinaryResponse;
        if (!response.ok) {
          throw new Error(result.error?.message || `Cloudinary gagal membaca folder ${assetFolder}.`);
        }
        return result;
      }),
    );

    const assets = results.flatMap((result) => result.resources ?? []);

    return {
      assets,
      nextCursor: folders.length === 1 ? results[0]?.next_cursor ?? null : null,
      folder: folders.length === 1 ? folder : "folder kategori produk",
    };
  },
);
