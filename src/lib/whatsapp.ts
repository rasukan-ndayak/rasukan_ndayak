import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

export const ADMIN_WA = "6285726019040";

function tgl(value: string) {
  if (!value) return "-";
  try {
    return format(parseISO(value), "EEEE, d MMMM yyyy", { locale: localeId });
  } catch {
    return value;
  }
}

function jam(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatRupiah(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export type WaItem = { productName: string; qty: number; unit: string; subtotal: string };
export type WaOrder = {
  code: string;
  items: WaItem[];
  start: string;
  end: string;
  pickupAt?: string | null;
  performanceAt?: string | null;
  returnAt?: string | null;
  days: number;
  total: string;
  name: string;
  phone: string;
  description: string;
};

export function buildWaOrderMessage(o: WaOrder) {
  return [
    "Halo Rasukan Ndayak, saya ingin konfirmasi booking:",
    "",
    `Kode: ${o.code}`,
    "",
    "Item yang disewa:",
    ...o.items.map(
      (it, i) => `${i + 1}. ${it.productName} — ${it.qty} ${it.unit} (${it.subtotal})`,
    ),
    "",
    `Tanggal ambil: ${tgl(o.start)}`,
    `Jam ambil: ${jam(o.pickupAt)}`,
    `Tanggal pentas: ${o.performanceAt ? tgl(o.performanceAt.slice(0, 10)) : "-"}`,
    `Jam pentas: ${jam(o.performanceAt)}`,
    `Tanggal kembali: ${tgl(o.end)}`,
    `Jam kembali: ${jam(o.returnAt)}`,
    `Durasi sewa: ${o.days} hari`,
    `Total biaya: ${o.total}`,
    "",
    `Nama: ${o.name || "-"}`,
    `WhatsApp: ${o.phone || "-"}`,
    `Deskripsi: ${o.description || "-"}`,
  ].join("\n");
}

export function waOrderLink(o: WaOrder) {
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(buildWaOrderMessage(o))}`;
}

export type WaBooking = Omit<WaOrder, "items"> & { productName: string; qty: number; unit: string };
export function buildWaMessage(b: WaBooking) {
  return buildWaOrderMessage({
    ...b,
    items: [{ productName: b.productName, qty: b.qty, unit: b.unit, subtotal: b.total }],
  });
}
export function waLink(b: WaBooking) {
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(buildWaMessage(b))}`;
}
export function waTextLink(message: string) {
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(message)}`;
}
