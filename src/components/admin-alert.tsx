import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Bell, CalendarCheck, MessageCircle } from "lucide-react";
import { useMemo } from "react";

import { useBookings, type Booking } from "@/data/bookings";

const ADMIN_WA = "6285726019040";

function jakartaDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
}

function pickupDateKey(booking: Booking) {
  return booking.pickupAt ? jakartaDateKey(booking.pickupAt) : booking.start.slice(0, 10);
}

function bookingGroup(bookings: Booking[]) {
  return [...new Map(bookings.map((booking) => [booking.bookingId, booking])).values()];
}

export function AdminAlert() {
  const { bookings } = useBookings();
  const today = jakartaDateKey(new Date());
  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy", { locale: localeId });

  const { newBookings, pickups } = useMemo(() => {
    const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
    return {
      newBookings: bookingGroup(
        activeBookings.filter((booking) => jakartaDateKey(booking.createdAt) === today),
      ),
      pickups: bookingGroup(activeBookings.filter((booking) => pickupDateKey(booking) === today)),
    };
  }, [bookings, today]);

  if (newBookings.length === 0 && pickups.length === 0) return null;

  return (
    <section className="rounded-2xl border border-warning/40 bg-warning/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-warning">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-bold">Notifikasi Admin</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        <a
          href={`https://wa.me/${ADMIN_WA}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp Admin
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {newBookings.length > 0 ? (
          <div className="rounded-xl border border-warning/30 bg-background p-4">
            <p className="font-semibold">{newBookings.length} booking baru hari ini</p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {newBookings.slice(0, 4).map((booking) => (
                <p key={`new-${booking.bookingId}`}>
                  {booking.name || "Penyewa"} · {booking.code}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {pickups.length > 0 ? (
          <div className="rounded-xl border border-warning/30 bg-background p-4">
            <div className="flex items-center gap-2 font-semibold">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {pickups.length} jadwal keluar hari ini
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {pickups.slice(0, 4).map((booking) => (
                <p key={`pickup-${booking.bookingId}`}>
                  {booking.name || "Penyewa"} · {booking.code}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}