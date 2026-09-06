import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import {
  deleteRows,
  insertRows,
  rpc,
  selectRows,
  supabaseConfigured,
  updateRows,
} from "@/lib/supabase-rest";
import { products, type Product } from "@/data/products";

export type BookingStatus =
  "pending" | "confirmed" | "picked_up" | "paid" | "returned" | "cancelled";

export type Booking = {
  id: string;
  bookingId: string;
  code: string;
  productId: string;
  qty: number;
  priceAtBooking: number;
  start: string;
  end: string;
  pickupAt: string | null;
  performanceAt: string | null;
  returnAt: string | null;
  name: string;
  phone: string;
  description: string;
  createdAt: string;
  status: BookingStatus | string;
  memberStatus?: "new" | "member";
};

export type BookingSchedule = {
  pickupAt: string;
  performanceAt: string;
  returnAt: string;
};

export const toKey = (date: Date) => format(date, "yyyy-MM-dd");

export function toWibDateTime(date: string, time: string): string {
  return `${date}T${time}:00+07:00`;
}

export function formatWibDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!isValid(d)) return value;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", "");
}

export function wibTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!isValid(d)) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function effectivePickup(b: Booking): Date {
  if (b.pickupAt) return new Date(b.pickupAt);
  return new Date(`${b.start}T00:00:00+07:00`);
}

function effectiveReturn(b: Booking): Date {
  if (b.returnAt) return new Date(b.returnAt);
  if (b.end === b.start) return new Date(`${b.start}T23:59:59+07:00`);
  return new Date(`${b.end}T00:00:00+07:00`);
}

export function bookingOverlaps(b: Booking, startAt: string | Date, endAt: string | Date): boolean {
  if (b.status === "cancelled") return false;
  const bs = effectivePickup(b).getTime();
  const be = effectiveReturn(b).getTime();
  const rs = new Date(startAt).getTime();
  const re = new Date(endAt).getTime();
  if (![bs, be, rs, re].every(Number.isFinite)) return false;
  return bs < re && be > rs;
}

export function occupiedDays(start?: string | null, end?: string | null) {
  if (!start || !end) return [];
  const from = parseISO(start);
  const to = parseISO(end);
  if (!isValid(from) || !isValid(to) || from > to) return [];
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(toKey(cursor));
    if (toKey(cursor) === toKey(to)) break;
    cursor = addDays(cursor, 1);
  }
  return days.length > 1 ? days.slice(0, -1) : days;
}

function fromRow(r: any): Booking {
  const b = r.booking ?? r.bookings ?? r;
  const customer = b.customer ?? b.customers ?? r.customer ?? r.customers;
  const bookingId = r.booking_id ?? b.id ?? r.id ?? crypto.randomUUID();
  return {
    id: r.id ?? crypto.randomUUID(),
    bookingId,
    code: b.code ?? r.code ?? "",
    productId: r.product_id ?? "",
    qty: Number(r.qty ?? 0),
    priceAtBooking: Number(r.price_at_booking ?? 0),
    start: b.start_date ?? r.start_date ?? "",
    end: b.end_date ?? r.end_date ?? "",
    pickupAt: b.pickup_at ?? r.pickup_at ?? null,
    performanceAt: b.performance_at ?? r.performance_at ?? null,
    returnAt: b.return_at ?? r.return_at ?? null,
    name: customer?.["name"] ?? b["name"] ?? r["name"] ?? "",
    phone: customer?.["phone"] ?? b["phone"] ?? r["phone"] ?? "",
    description: customer?.["description"] ?? b["description"] ?? r["description"] ?? "",
    createdAt: b.created_at ?? r.created_at ?? new Date().toISOString(),
    status: b.status ?? r.status ?? "pending",
    memberStatus: customer?.member_status ?? b.member_status ?? "new",
  };
}

export async function loadBookings(): Promise<Booking[]> {
  if (!supabaseConfigured) return [];
  const rows = await selectRows<any>(
    "booking_items",
    "select=id,qty,price_at_booking,product_id,booking_id,bookings(id,code,start_date,end_date,pickup_at,performance_at,return_at,status,created_at,customer_id,customers(name,phone,description,member_status))&bookings.status=neq.cancelled&order=created_at.desc",
  );
  return rows.map(fromRow).filter((b) => Boolean(b.bookingId && b.productId));
}

export async function saveBookingGroup(
  common: Pick<Booking, "start" | "end" | "name" | "phone" | "description"> & BookingSchedule,
  items: { productId: string; qty: number }[],
) {
  if (!supabaseConfigured) throw new Error("Supabase belum dikonfigurasi.");
  const result = await rpc<any>("create_booking_v3", {
    p_name: common.name,
    p_phone: common.phone,
    p_description: common.description,
    p_start: common.start,
    p_end: common.end,
    p_pickup_at: common.pickupAt,
    p_performance_at: common.performanceAt,
    p_return_at: common.returnAt,
    p_items: items,
  });
  const code = String(result.code ?? "");
  const bookingId = result.bookingId as string | undefined;
  return {
    code,
    bookingId,
    customerId: result.customerId as string | undefined,
    status: (result.status ?? "pending") as BookingStatus,
    bookings: (result.items ?? items).map((x: any) => ({
      id: x.id ?? crypto.randomUUID(),
      bookingId: bookingId ?? x.booking_id ?? crypto.randomUUID(),
      code,
      productId: x.productId ?? x.product_id,
      qty: Number(x.qty ?? 0),
      priceAtBooking: Number(x.priceAtBooking ?? x.price_at_booking ?? 0),
      start: common.start,
      end: common.end,
      pickupAt: common.pickupAt,
      performanceAt: common.performanceAt,
      returnAt: common.returnAt,
      name: common.name,
      phone: common.phone,
      description: common.description,
      createdAt: new Date().toISOString(),
      status: (result.status ?? "pending") as BookingStatus,
      memberStatus: result.memberStatus ?? "new",
    })) as Booking[],
  };
}

export async function saveBooking(
  b: Omit<
    Booking,
    | "id"
    | "bookingId"
    | "code"
    | "createdAt"
    | "status"
    | "memberStatus"
    | "pickupAt"
    | "performanceAt"
    | "returnAt"
  > &
    BookingSchedule,
) {
  const result = await saveBookingGroup(b, [{ productId: b.productId, qty: b.qty }]);
  return result.bookings[0]!;
}

export async function removeBookingGroup(code: string) {
  const result = await rpc<any>("cancel_booking", { p_code: code.trim() });
  if (result === false || result?.success === false)
    throw new Error("Booking tidak ditemukan atau sudah dibatalkan.");
  return result;
}

export async function removeBooking(id: string) {
  await deleteRows("booking_items", `id=eq.${encodeURIComponent(id)}`);
}

export async function updateBooking(
  id: string,
  patch: Partial<
    Pick<
      Booking,
      | "qty"
      | "start"
      | "end"
      | "name"
      | "phone"
      | "description"
      | "pickupAt"
      | "performanceAt"
      | "returnAt"
    >
  >,
) {
  if (!supabaseConfigured) throw new Error("Supabase belum dikonfigurasi.");
  const current = await selectRows<any>(
    "booking_items",
    `select=booking_id,bookings(id,customer_id)&id=eq.${encodeURIComponent(id)}`,
  );
  const row = current[0];
  const bookingId = row?.booking_id;
  if (!bookingId) throw new Error("Booking item tidak ditemukan.");

  if (patch.qty !== undefined) {
    await rpc("update_booking_item_v2", {
      p_item_id: id,
      p_qty: Math.max(1, Math.floor(Number(patch.qty) || 1)),
    });
  }

  const hasSchedule = [
    patch.start,
    patch.end,
    patch.pickupAt,
    patch.performanceAt,
    patch.returnAt,
  ].some((v) => v !== undefined);
  if (hasSchedule) {
    const booking = await selectRows<any>(
      "bookings",
      `select=id,start_date,end_date,pickup_at,performance_at,return_at&id=eq.${encodeURIComponent(bookingId)}`,
    );
    const b = booking[0];
    const start = patch.start ?? b?.start_date;
    const end = patch.end ?? b?.end_date;
    const pickupAt = patch.pickupAt ?? b?.pickup_at;
    const performanceAt = patch.performanceAt ?? b?.performance_at;
    const returnAt = patch.returnAt ?? b?.return_at;
    await rpc("update_booking_schedule_v2", {
      p_booking_id: bookingId,
      p_start: start,
      p_end: end,
      p_pickup_at: pickupAt,
      p_performance_at: performanceAt,
      p_return_at: returnAt,
    });
  }

  const customerId = row?.bookings?.customer_id;
  if (
    customerId &&
    (patch.name !== undefined || patch.phone !== undefined || patch.description !== undefined)
  ) {
    const cp: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) cp["name"] = patch.name;
    if (patch.phone !== undefined) cp["phone"] = patch.phone;
    if (patch.description !== undefined) cp["description"] = patch.description;
    await updateRows("customers", `id=eq.${encodeURIComponent(customerId)}`, cp);
  }
  return true;
}

export async function addBookingItem(bookingId: string, productId: string, qty: number) {
  const result = await rpc<any>("add_booking_item_v2", {
    p_booking_id: bookingId,
    p_product_id: productId,
    p_qty: Math.max(1, Math.floor(Number(qty) || 1)),
  });
  return result;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  admin = "admin",
) {
  return rpc<any>("update_booking_status_v2", {
    p_booking_id: bookingId,
    p_status: status,
    p_admin: admin,
  });
}

export function bookingsByCode(bookings: Booking[], code: string) {
  return bookings.filter((b) => b.code.toLowerCase() === code.trim().toLowerCase());
}

export function bookingsByName(bookings: Booking[], name: string) {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) return [];
  const match = bookings.find((b) => b.name.trim().toLowerCase().includes(normalizedName));
  return match ? bookings.filter((b) => b.bookingId === match.bookingId) : [];
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const refresh = useCallback(async () => {
    try {
      setBookings(await loadBookings());
    } catch {
      setBookings([]);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { bookings, refresh };
}

export function bookedQtyOn(bookings: Booking[], productId: string, dayKey: string) {
  return bookings
    .filter(
      (b) =>
        b.productId === productId &&
        b.status !== "cancelled" &&
        occupiedDays(b.start, b.end).includes(dayKey),
    )
    .reduce((s, b) => s + b.qty, 0);
}

export function totalOutOn(bookings: Booking[], dayKey: string) {
  return bookings
    .filter((b) => b.status !== "cancelled" && occupiedDays(b.start, b.end).includes(dayKey))
    .reduce((s, b) => s + b.qty, 0);
}

export function peakBookedQtyOn(
  bookings: Booking[],
  productId: string | undefined,
  dayKey: string,
) {
  const dayStart = new Date(`${dayKey}T00:00:00+07:00`).getTime();
  const dayEnd = new Date(`${dayKey}T23:59:59+07:00`).getTime();
  const events: Array<{ time: number; delta: number }> = [];
  for (const b of bookings) {
    if (b.status === "cancelled" || (productId && b.productId !== productId)) continue;
    const start = effectivePickup(b).getTime();
    const end = effectiveReturn(b).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > dayEnd || end < dayStart)
      continue;
    events.push({ time: Math.max(start, dayStart), delta: b.qty });
    events.push({ time: Math.min(end, dayEnd + 1), delta: -b.qty });
  }
  events.sort((a, b) => a.time - b.time || b.delta - a.delta);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

export function bookingsOn(bookings: Booking[], dayKey: string) {
  return bookings.filter(
    (b) => b.status !== "cancelled" && occupiedDays(b.start, b.end).includes(dayKey),
  );
}

export function stockOf(productId: string) {
  return products.find((p) => p.id === productId)?.stock ?? 0;
}

export function availableInRange(
  bookings: Booking[],
  productId: string,
  start: string,
  end: string,
  excludeBookingId?: string,
  maintenance: Array<{ productId: string; startDate: string; endDate: string }> = [],
  schedule?: Partial<BookingSchedule>,
) {
  const stock = stockOf(productId);
  const startAt = schedule?.pickupAt ?? `${start}T00:00:00+07:00`;
  const endAt =
    schedule?.returnAt ?? (start === end ? `${end}T23:59:59+07:00` : `${end}T00:00:00+07:00`);
  const scoped = excludeBookingId
    ? bookings.filter((b) => b.bookingId !== excludeBookingId)
    : bookings;
  const overlapping = scoped.filter(
    (b) => b.productId === productId && bookingOverlaps(b, startAt, endAt),
  );
  const days = occupiedDays(start, end);
  const conflicts = days
    .filter((day) => overlapping.some((b) => occupiedDays(b.start, b.end).includes(day)))
    .map((day) => ({
      day,
      available:
        stock -
        overlapping
          .filter((b) => occupiedDays(b.start, b.end).includes(day))
          .reduce((s, b) => s + b.qty, 0),
    }));
  const maintenanceConflicts = maintenance.filter(
    (m) => m.productId === productId && m.startDate <= end && m.endDate >= start,
  );
  const reserved = overlapping.reduce((s, b) => s + b.qty, 0);
  return {
    available: maintenanceConflicts.length ? 0 : Math.max(stock - reserved, 0),
    conflicts,
    maintenanceConflicts,
  };
}

export type DayStatus = "Kosong" | "Terisi" | "Penuh";
export function dayStatusFor(bookings: Booking[], dayKey: string, productId?: string) {
  const capacity = productId ? stockOf(productId) : products.reduce((s, p) => s + p.stock, 0);
  const out = productId ? bookedQtyOn(bookings, productId, dayKey) : totalOutOn(bookings, dayKey);
  return {
    status: out === 0 ? "Kosong" : out >= capacity ? "Penuh" : ("Terisi" as DayStatus),
    out,
    capacity,
  };
}

export function getRentalCountMap(bookings: Booking[]) {
  const map: Record<string, number> = {};
  for (const b of bookings)
    if (b.status !== "cancelled") map[b.productId] = (map[b.productId] || 0) + Number(b.qty || 0);
  return map;
}

export function getTerlarisByKategori(bookings: Booking[], limit = 4) {
  const countMap = getRentalCountMap(bookings);
  const grouped = new Map<string, Product[]>();
  for (const p of products) {
    const key = String(p.category).toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }
  const result: Record<string, Product[]> = {};
  for (const [key, list] of grouped)
    result[key] = [...list]
      .sort((a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0))
      .slice(0, limit);
  return result;
}

export function getTerlarisGlobal(bookings: Booking[], limit = 8) {
  const countMap = getRentalCountMap(bookings);
  return [...products]
    .sort((a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0))
    .slice(0, limit);
}

export function rentalDays(start: string, end: string) {
  return Math.max(differenceInCalendarDays(parseISO(end), parseISO(start)), 1);
}
