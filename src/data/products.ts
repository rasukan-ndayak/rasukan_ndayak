import { useCallback, useEffect, useState } from "react";
import { insertRows, selectRows, updateRows, deleteRows, supabaseConfigured } from "@/lib/supabase-rest";

export type Category = "Kostum" | "Kuluk Lancur" | "Kuluk Mentok" | "Klinting" | "Aksesoris";
export type Status = "Tersedia" | "Terbatas" | "Habis";
export type Product = {
  id: string; name: string; category: Category; unit: "pcs" | "stell";
  price: number; stock: number; image: string; description: string; details: string[];
};
export const categories: Category[] = ["Kostum", "Kuluk Lancur", "Kuluk Mentok", "Klinting", "Aksesoris"];

const p = (id: string, name: string, category: Category, stock: number, price: number, unit: "pcs" | "stell" = "pcs"): Product => ({
  id, name, category, unit, price, stock, image: "",
  description: `${name} untuk perlengkapan tari tradisional.`,
  details: [`Stok ${stock} ${unit}`, `Harga sewa Rp${price.toLocaleString("id-ID")} / ${unit}`],
});

export const baseProducts: Product[] = [];

export let products: Product[] = baseProducts;
export const defaultImages: string[] = [];
export const statusOf = (stock: number): Status => stock <= 0 ? "Habis" : stock <= 3 ? "Terbatas" : "Tersedia";
export const formatIDR = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
export const getProduct = (id: string) => products.find((x) => x.id === id);

function fromRow(row: any): Product { return { id: row.id, name: row.name, category: row.category, unit: row.unit, price: Number(row.price), stock: Number(row.stock), image: row.image_url || "", description: row.description || "", details: Array.isArray(row.details) ? row.details : [] }; }
function toRow(p: Product) { return { id: p.id, name: p.name, category: p.category, unit: p.unit, price: p.price, stock: p.stock, image_url: p.image || null, description: p.description || null, details: p.details || [] }; }

export async function loadProducts(): Promise<Product[]> {
  if (!supabaseConfigured) return [];
  const rows = await selectRows<any>("products", "select=*&order=created_at.asc");
  products = rows.map(fromRow);
  return products;
}

export async function addProductRemote(product: Product) {
  // The Supabase products.id column is NOT NULL and is intentionally a text ID.
  // New products created from the admin form do not have an ID yet, so generate
  // one here before sending the row to Supabase.
  const id = product.id?.trim() || (globalThis.crypto?.randomUUID
    ? `prod-${globalThis.crypto.randomUUID()}`
    : `prod-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const row = toRow({ ...product, id });
  const rows = await insertRows<any>("products", row);
  return fromRow(rows[0]);
}
export async function updateProductRemote(id: string, patch: Partial<Product>) {
  const payload: any = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.unit !== undefined) payload.unit = patch.unit;
  if (patch.price !== undefined) payload.price = patch.price;
  if (patch.stock !== undefined) payload.stock = patch.stock;
  if (patch.image !== undefined) payload.image_url = patch.image || null;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.details !== undefined) payload.details = patch.details;
  const rows = await updateRows<any>("products", `id=eq.${encodeURIComponent(id)}`, payload);
  return fromRow(rows[0]);
}
export async function removeProductRemote(id: string) { await deleteRows("products", `id=eq.${encodeURIComponent(id)}`); }

export function useCatalog() {
  const [catalog, setCatalog] = useState<Product[]>(products);
  const refresh = useCallback(async () => { try { setCatalog(await loadProducts()); } catch { setCatalog(products); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const addProduct = useCallback(async (x: Product) => { const created = await addProductRemote(x); products = [...products, created]; setCatalog(products); return created; }, []);
  const updateProduct = useCallback(async (id: string, patch: Partial<Product>) => { const updated = await updateProductRemote(id, patch); products = products.map(x => x.id === id ? updated : x); setCatalog(products); return updated; }, []);
  const removeProduct = useCallback(async (id: string) => { await removeProductRemote(id); products = products.filter(x => x.id !== id); setCatalog(products); }, []);
  const resetCatalog = useCallback(async () => { setCatalog(await loadProducts()); }, []);
  return { products: catalog, addProduct, updateProduct, removeProduct, resetCatalog, refresh };
}
