import { useMemo } from "react";
import { useBookings } from "@/data/bookings";
import { format } from "date-fns";

export function AdminAlert() {
  const { bookings } = useBookings();

  const keluarHariIni = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return bookings.filter((b: any) => {
      const tgl = (b.start || b.start_date || "").slice(0, 10);
      return tgl === today;
    });
  }, [bookings]);

  // INI KUNCINYA: kalau gak ada yang keluar, jangan render apa-apa
  if (keluarHariIni.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-red-500 bg-red-50 p-5">
      <h3 className="font-black text-red-600 text-lg">
        🔔 {keluarHariIni.length} JADWAL KELUAR HARI INI - {format(new Date(), "dd MMM yyyy")}
      </h3>
      <div className="mt-3 grid gap-2">
        {keluarHariIni.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow">
            <div>
              <p className="font-bold">{b.productId}</p>
              <p className="text-sm text-gray-600">{b.name} • {b.phone}</p>
            </div>
            <a
              href={`https://wa.me/${String(b.phone).replace(/[^0-9]/g, "")}?text=Halo%20${b.name},%20kostum%20${b.productId}%20siap%20diambil%20hari%20ini`}
              target="_blank"
              className="rounded-full bg-green-500 px-4 py-1.5 text-sm font-bold text-white"
            >
              WA
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}