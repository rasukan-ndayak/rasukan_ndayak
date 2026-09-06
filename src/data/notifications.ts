import { useCallback, useEffect, useState } from "react";
import { rpc, supabaseConfigured } from "@/lib/supabase-rest";

export type BookingNotification = {
  id: string;
  kind: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export async function loadBookingNotifications(code: string) {
  if (!supabaseConfigured || !code.trim()) return [];
  const rows = await rpc<BookingNotification[]>("get_booking_notifications", {
    p_code: code.trim(),
  });
  return Array.isArray(rows) ? rows : [];
}

export function useBookingNotifications(code?: string) {
  const [notifications, setNotifications] = useState<BookingNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      setNotifications(await loadBookingNotifications(code));
    } catch {
      /* non-blocking */
    }
  }, [code]);

  useEffect(() => {
    void refresh();
    if (!code) return;
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [code, refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/notification-sw.js").catch(() => {
      /* Browser notifications still work without a service worker. */
    });
  }, []);

  useEffect(() => {
    if (!code || typeof window === "undefined" || !("Notification" in window)) return;
    const key = `rasukan-notification-seen:${code}`;
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      /* ignore */
    }
    for (const item of notifications) {
      if (seen.has(item.id) || permission !== "granted") continue;
      if (!("serviceWorker" in navigator)) {
        new Notification(item.title, { body: item.message });
      } else {
        void navigator.serviceWorker.ready
          .then((registration) =>
            registration.showNotification(item.title, {
              body: item.message,
              tag: `booking-${item.id}`,
              data: { url: `/konfirmasi?kode=${encodeURIComponent(code)}` },
            }),
          )
          .catch(() => {
            new Notification(item.title, { body: item.message });
          });
      }
      seen.add(item.id);
    }
    localStorage.setItem(key, JSON.stringify([...seen].slice(-100)));
  }, [notifications, code, permission]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    const next = await Notification.requestPermission();
    setPermission(next);
    return next;
  }, []);

  return { notifications, permission, requestPermission, refresh };
}
