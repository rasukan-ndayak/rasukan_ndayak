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

function jakartaDateKey(date = new Date()) {
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

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildMessage(booking: any) {
  const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;

  const items = Array.isArray(booking.booking_items) ? booking.booking_items : [];

  const itemLines = items.map((item: any, index: number) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    return `${index + 1}. ${product?.name ?? item.product_id} — ${item.qty} ${product?.unit ?? "unit"}`;
  });

  return [
    "🔔 PERSIAPAN SEWA HARI INI",
    "",
    `Kode: ${booking.code}`,
    `Tanggal keluar: ${formatDate(booking.start_date)}`,
    `Tanggal kembali: ${formatDate(booking.end_date)}`,
    `Penyewa: ${customer?.name ?? "-"}`,
    `WA penyewa: ${customer?.phone ?? "-"}`,
    "",
    "Item yang harus disiapkan:",
    ...(itemLines.length ? itemLines : ["-"]),
    "",
    "Silakan cek booking sebelum pelanggan datang.",
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
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep raw response when provider does not return JSON.
  }

  if (!response.ok || data?.status === false) {
    throw new Error(
      typeof data === "string"
        ? data
        : (data?.detail ?? data?.reason ?? `Fonnte HTTP ${response.status}`),
    );
  }

  return data;
}

Deno.serve(async (req) => {
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

    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        code,
        start_date,
        end_date,
        status,
        customers(name, phone),
        booking_items(
          qty,
          product_id,
          products(name, unit)
        )
      `,
      )
      .eq("start_date", today)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    if (bookingError) {
      throw bookingError;
    }

    const target = normalizePhone(NOTIFICATION_WA_TARGET);
    if (!target) {
      throw new Error("NOTIFICATION_WA_TARGET tidak valid");
    }

    const results: any[] = [];

    for (const booking of bookings ?? []) {
      const { data: claim, error: claimError } = await supabase.rpc("claim_rental_reminder", {
        p_booking_id: booking.id,
        p_notification_date: today,
        p_kind: "rental_preparation",
      });

      if (claimError) throw claimError;
      if (!claim) {
        results.push({ code: booking.code, status: "already_sent_or_in_progress" });
        continue;
      }

      try {
        const providerResponse = await sendFonnte(target, buildMessage(booking));

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

        results.push({ code: booking.code, status: "sent" });
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

        results.push({ code: booking.code, status: "failed", error: message });
      }
    }

    return Response.json({
      ok: true,
      date: today,
      found: bookings?.length ?? 0,
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
