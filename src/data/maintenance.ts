import { useCallback, useEffect, useState } from "react";
import { deleteRows, insertRows, selectRows, supabaseConfigured } from "@/lib/supabase-rest";

export type Maintenance = {
  id: string;
  productId: string;
  startDate: string;
  endDate: string;
  note: string;
  createdAt?: string;
};

function fromRow(row: any): Maintenance {
  return {
    id: row.id,
    productId: row.product_id,
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

export async function loadMaintenance(): Promise<Maintenance[]> {
  if (!supabaseConfigured) return [];
  const rows = await selectRows<any>(
    "product_maintenance",
    "select=id,product_id,start_date,end_date,note,created_at&order=start_date.asc",
  );
  return rows.map(fromRow);
}

export async function addMaintenanceRemote(input: Omit<Maintenance, "id" | "createdAt">) {
  if (!supabaseConfigured) throw new Error("Supabase belum dikonfigurasi.");
  const rows = await insertRows<any>("product_maintenance", {
    product_id: input.productId,
    start_date: input.startDate,
    end_date: input.endDate,
    note: input.note?.trim() || null,
  });
  return fromRow(rows[0]);
}

export async function removeMaintenanceRemote(id: string) {
  await deleteRows("product_maintenance", `id=eq.${encodeURIComponent(id)}`);
}

export function maintenanceConflictsRange(
  records: Maintenance[],
  productId: string,
  startDate: string,
  endDate: string,
) {
  // Tanggal kembali (endDate) bukan hari pemakaian, sehingga periode perawatan
  // dimulai sebelum tanggal kembali agar dianggap bentrok dengan booking.
  return records.filter(
    (m) =>
      m.productId === productId &&
      m.startDate < endDate &&
      m.endDate >= startDate,
  );
}

export function isMaintenanceDay(records: Maintenance[], productId: string, day: string) {
  return records.some(
    (m) => m.productId === productId && m.startDate <= day && m.endDate >= day,
  );
}

export function useMaintenance() {
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);

  const refresh = useCallback(async () => {
    try {
      setMaintenance(await loadMaintenance());
    } catch {
      setMaintenance([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(async (input: Omit<Maintenance, "id" | "createdAt">) => {
    const created = await addMaintenanceRemote(input);
    setMaintenance((current) =>
      [...current, created].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    );
    return created;
  }, []);

  const remove = useCallback(async (id: string) => {
    await removeMaintenanceRemote(id);
    setMaintenance((current) => current.filter((x) => x.id !== id));
  }, []);

  return { maintenance, add, remove, refresh };
}
