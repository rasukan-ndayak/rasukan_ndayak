const url = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = Boolean(url && key);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseConfigured) throw new Error("Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request gagal (${response.status})`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function selectRows<T>(table: string, query = "select=*") {
  return request<T[]>(`${table}?${query}`);
}

export function insertRows<T>(table: string, rows: unknown) {
  return request<T[]>(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(rows) });
}

export function updateRows<T>(table: string, query: string, patch: unknown) {
  return request<T[]>(`${table}?${query}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
}

export function deleteRows<T>(table: string, query: string) {
  return request<T[]>(`${table}?${query}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
}

export function rpc<T>(name: string, args: unknown) {
  return request<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}

export function quote(value: string) {
  return encodeURIComponent(`eq.${value}`);
}
