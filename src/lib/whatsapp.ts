import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

export const ADMIN_WA = "6285726019040";

const tgl = (v: string) =>
  format(
    parseISO(v),
    "EEEE, d MMMM yyyy",
    {
      locale: localeId,
    },
  );

export type WaBooking = {
  code: string;
  productName: string;
  qty: number;
  unit: string;
  start: string;
  end: string;
  days: number;
  total: string;
  name: string;
  phone: string;
  description: string;
};

export function buildWaMessage(
  b: WaBooking,
): string {
  return [
    "Halo Rasukan Ndayak, saya ingin konfirmasi booking:",
    "",
    `Kode: ${b.code}`,
    `Koleksi: ${b.productName}`,
    `Jumlah: ${b.qty} ${b.unit}`,
    `Tanggal keluar: ${tgl(b.start)}`,
    `Tanggal masuk: ${tgl(b.end)}`,
    `Durasi: ${b.days} hari`,
    `Total biaya: ${b.total}`,
    "",
    `Nama: ${b.name || "-"}`,
    `WhatsApp: ${b.phone || "-"}`,
    `Deskripsi: ${b.description || "-"}`,
  ].join("\n");
}

export function waLink(
  b: WaBooking,
): string {
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
    buildWaMessage(b),
  )}`;
}

export type WaItem = {
  productName: string;
  qty: number;
  unit: string;
  subtotal: string;
};

export type WaOrder = {
  code: string;
  items: WaItem[];
  start: string;
  end: string;
  days: number;
  total: string;
  name: string;
  phone: string;
  description: string;
};

export function buildWaOrderMessage(
  o: WaOrder,
): string {
  return [
    "Halo Rasukan Ndayak, saya ingin konfirmasi booking:",
    "",
    `Kode: ${o.code}`,
    "Item yang disewa:",
    ...o.items.map(
      (it, i) =>
        `${i + 1}. ${it.productName} — ${it.qty} ${it.unit} (${it.subtotal})`,
    ),
    "",
    `Tanggal keluar: ${tgl(o.start)}`,
    `Tanggal masuk: ${tgl(o.end)}`,
    `Durasi: ${o.days} hari`,
    `Total biaya: ${o.total}`,
    "",
    `Nama: ${o.name || "-"}`,
    `WhatsApp: ${o.phone || "-"}`,
    `Deskripsi: ${o.description || "-"}`,
  ].join("\n");
}

export function waOrderLink(
  o: WaOrder,
): string {
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
    buildWaOrderMessage(o),
  )}`;
}