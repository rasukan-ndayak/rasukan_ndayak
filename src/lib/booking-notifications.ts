import { selectRows, supabaseConfigured } from "@/lib/supabase-rest";

export type BookingNotification = {
  id: string;
  code: string;
  kind: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

export async function loadBookingNotifications(code: string): Promise<BookingNotification[]> {
  if (!supabaseConfigured || !code.trim()) return [];
  const rows = await selectRows<any>(
    "booking_notifications",
    `select=id,code,kind,title,message,created_at,read_at&code=eq.${encodeURIComponent(code.trim())}&order=created_at.desc&limit=20`,
  );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    kind: row.kind,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
  }));
}

export function requestBrowserNotifications() {
  if (typeof window === "undefined" || !("Notification" in window))
    return Promise.resolve("unsupported");
  if (Notification.permission === "granted") return Promise.resolve("granted");
  return Notification.requestPermission();
}

export function showBookingNotification(notification: BookingNotification) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  new Notification(notification.title, {
    body: notification.message,
    tag: `booking-${notification.id}`,
  });
}
