/// <reference path="./edge-runtime.d.ts" />

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function getSupabaseSecretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch {
    return "";
  }
}

const SERVICE_ROLE_KEY = getSupabaseSecretKey();
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN") ?? "";
const NOTIFICATION_WA_TARGET = Deno.env.get("NOTIFICATION_WA_TARGET") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type ReminderKind = "booking_created" | "rental_preparation";
type Relation<T> = T | T[] | null;
type Booking = {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  pickup_at: string | null;
  performance_at: string | null;
  return_at: string | null;
  status: string;
  created_at: string;
  customers: Relation<{ name: string | null; phone: string | null }>;
  booking_items: Array<{
    qty: number;
    product_id: string;
    products: Relation<{ name: string | null; unit: string | null }>;
  }>;
};

function jakartaDateKey(date = new Date()) {
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function firstRelation<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function buildMessage(booking: Booking, kind: ReminderKind) {
  const customer = firstRelation(booking.customers);

  const items = Array.isArray(booking.booking_items) ? booking.booking_items : [];

  const itemLines = items.map((item, index) => {
    const product = firstRelation(item.products);
    return `${index + 1}. ${product?.name ?? item.product_id} — ${item.qty} ${product?.unit ?? "unit"}`;
  });

  return [
    kind === "booking_created" ? "🔔 BOOKING BARU MASUK" : "🔔 PERSIAPAN SEWA HARI INI",
    "",
    `Kode: ${booking.code}`,
    `Tanggal ambil: ${formatDateTime(booking.pickup_at)}`,
    `Tanggal pentas: ${formatDateTime(booking.performance_at)}`,
    `Tanggal kembali: ${formatDateTime(booking.return_at)}`,
    `Penyewa: ${customer?.name ?? "-"}`,
    `WA penyewa: ${customer?.phone ?? "-"}`,
    "",
    "Item yang harus disiapkan:",
    ...(itemLines.length ? itemLines : ["-"]),
    "",
    kind === "booking_created"
      ? "Silakan cek booking dan hubungi penyewa bila diperlukan."
      : "Silakan cek booking sebelum pelanggan datang.",
  ].join("\n");
}

async function sendFonnte(target: string, message: string) {
  const form = new FormData();
  form.set("target", target);
  form.set("message", message);
  form.set("countryCode", "62");
  form.set("preview", "false");

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: FONNTE_TOKEN,
    },
    body: form,
  });

  const text = await response.text();
  let data: { status?: boolean; detail?: string; reason?: string } | string = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep raw response when provider does not return JSON.
  }

  if (!response.ok || typeof data === "string" || data.status === false) {
    throw new Error(
      typeof data === "string" ? data : (data.detail ?? data.reason ?? `Fonnte HTTP ${response.status}`),
    );
  }

  return data;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "POST only" }, { status: 405 });
    }

    const incomingSecret = req.headers.get("x-cron-secret") ?? "";
    if (!CRON_SECRET || incomingSecret !== CRON_SECRET) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return Response.json(
        { ok: false, error: "Supabase service secret belum dikonfigurasi" },
        { status: 500 },
      );
    }

    if (!FONNTE_TOKEN || !NOTIFICATION_WA_TARGET) {
      return Response.json(
        { ok: false, error: "FONNTE_TOKEN atau NOTIFICATION_WA_TARGET belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const today = jakartaDateKey();

    const { data: rawBookings, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        code,
        start_date,
        end_date,
        pickup_at,
        performance_at,
        return_at,
        status,
        created_at,
        customers(name, phone),
        booking_items(
          qty,
          product_id,
          products(name, unit)
        )
      `,
      )
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    if (bookingError) {
      throw bookingError;
    }

    const bookings = (rawBookings ?? []) as Booking[];
    const notifications = bookings.flatMap((booking: Booking) => {
      const createdDay = jakartaDateKey(new Date(booking.created_at));
      const pickupDay = booking.pickup_at ? jakartaDateKey(new Date(booking.pickup_at)) : booking.start_date;
      const result: Array<{ booking: Booking; kind: ReminderKind }> = [];
      if (createdDay === today) result.push({ booking, kind: "booking_created" });
      if (pickupDay === today) result.push({ booking, kind: "rental_preparation" });
      return result;
    });

    const target = normalizePhone(NOTIFICATION_WA_TARGET);
    if (!target) {
      throw new Error("NOTIFICATION_WA_TARGET tidak valid");
    }

    const results: Array<{ code: string; kind: ReminderKind; status: string; error?: string }> = [];

    for (const { booking, kind } of notifications) {
      const { data: claim, error: claimError } = await supabase.rpc("claim_rental_reminder", {
        p_booking_id: booking.id,
        p_notification_date: today,
        p_kind: kind,
      });

      if (claimError) throw claimError;
      if (!claim) {
        results.push({ code: booking.code, kind, status: "already_sent_or_in_progress" });
        continue;
      }

      try {
        const providerResponse = await sendFonnte(target, buildMessage(booking, kind));

        const { error: logError } = await supabase
          .from("rental_notification_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_response: providerResponse,
            updated_at: new Date().toISOString(),
          })
          .eq("id", claim);

        if (logError) throw logError;

        results.push({ code: booking.code, kind, status: "sent" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await supabase
          .from("rental_notification_logs")
          .update({
            status: "failed",
            last_error: message.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", claim);

        results.push({ code: booking.code, kind, status: "failed", error: message });
      }
    }

    return Response.json({
      ok: true,
      date: today,
      found: notifications.length,
      results,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
