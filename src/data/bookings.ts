import { addDays, format, isAfter, parseISO } from "date-fns";
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

export type Booking = {
  id: string;
  bookingId: string;
  code: string;
  productId: string;
  qty: number;
  priceAtBooking: number;
  start: string;
  end: string;
  name: string;
  phone: string;
  description: string;
  createdAt: string;
  status?: string;
};

export const toKey = (date: Date) =>
  format(date, "yyyy-MM-dd");

export function occupiedDays(
  start?: string | null,
  end?: string | null,
) {
  if (!start || !end) return [];

  const from = parseISO(start);
  const to = parseISO(end);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    isAfter(from, to)
  ) {
    return [];
  }

  const days: string[] = [];
  let c = from;

  while (!isAfter(c, to)) {
    days.push(toKey(c));

    if (toKey(c) === toKey(to)) {
      break;
    }

    c = addDays(c, 1);
  }

  return days.length > 1
    ? days.slice(0, -1)
    : days;
}

function fromRow(r: any): Booking {
  return {
    id:
      r.id ??
      crypto.randomUUID(),

    bookingId:
      r.booking_id ??
      r.bookingId ??
      r.id ??
      crypto.randomUUID(),

    code: r.code ?? "",

    productId:
      r.product_id ?? "",

    qty: Number(r.qty ?? 0),

    priceAtBooking:
      Number(
        r.price_at_booking ?? 0,
      ),

    start:
      r.start_date ?? "",

    end:
      r.end_date ?? "",

    name:
      r.name ??
      r.customer?.name ??
      "",

    phone:
      r.phone ??
      r.customer?.phone ??
      "",

    description:
      r.description ??
      r.customer?.description ??
      "",

    createdAt:
      r.created_at ??
      new Date().toISOString(),

    status:
      r.status ??
      "confirmed",
  };
}

export async function loadBookings(): Promise<
  Booking[]
> {
  if (!supabaseConfigured) return [];

  const rows =
    await selectRows<any>(
      "booking_items",
      "select=id,qty,price_at_booking,product_id,booking_id,bookings(id,code,start_date,end_date,status,created_at,customer_id,customers(name,phone,description))&bookings.status=neq.cancelled&order=created_at.desc",
    );

  return rows
    .map((r: any) => {
      const b =
        Array.isArray(r.bookings)
          ? r.bookings[0]
          : (r.bookings ??
            r.booking ??
            null);

      if (!b?.id) return null;

      return fromRow({
        ...r,
        id: r.id,
        booking_id: r.booking_id,
        code: b.code ?? "",
        product_id: r.product_id,
        start_date:
          b.start_date ?? "",
        end_date:
          b.end_date ?? "",
        status:
          b.status ??
          "confirmed",
        created_at:
          b.created_at ?? "",
        name:
          b.customers?.name ??
          "",
        phone:
          b.customers?.phone ??
          "",
        description:
          b.customers?.description ??
          "",
      });
    })
    .filter(
      (b): b is Booking =>
        b !== null,
    );
}

export async function saveBookingGroup(
  common: Pick<
    Booking,
    | "start"
    | "end"
    | "name"
    | "phone"
    | "description"
  >,
  items: {
    productId: string;
    qty: number;
  }[],
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  const result =
    await rpc<any>(
      "create_booking",
      {
        p_name: common.name,
        p_phone: common.phone,
        p_description:
          common.description,
        p_start: common.start,
        p_end: common.end,
        p_items: items,
      },
    );

  const code =
    result.code as string;

  const bookings = (
    result.items ??
    items.map(
      (x: any) => ({
        ...common,
        ...x,
        code,
      }),
    )
  ).map(
    (x: any) => ({
      id:
        x.id ??
        crypto.randomUUID(),

      bookingId:
        result.bookingId ??
        x.bookingId ??
        x.booking_id ??
        crypto.randomUUID(),

      code,

      productId:
        x.productId ??
        x.product_id,

      qty: Number(x.qty),

      priceAtBooking:
        Number(
          x.priceAtBooking ??
            x.price_at_booking ??
            0,
        ),

      start:
        common.start,

      end:
        common.end,

      name:
        common.name,

      phone:
        common.phone,

      description:
        common.description,

      createdAt:
        new Date().toISOString(),

      status:
        "confirmed",
    }),
  );

  return {
    code,
    bookingId:
      result.bookingId as
        | string
        | undefined,
    bookings,
  };
}

export async function saveBooking(
  b: Omit<
    Booking,
    | "id"
    | "bookingId"
    | "code"
    | "createdAt"
  >,
) {
  return (
    await saveBookingGroup(
      b,
      [
        {
          productId:
            b.productId,
          qty: b.qty,
        },
      ],
    )
  ).bookings[0]!;
}

export async function removeBookingGroup(
  code: string,
) {
  await rpc(
    "cancel_booking",
    {
      p_code:
        code.trim(),
    },
  );
}

export async function removeBooking(
  id: string,
) {
  await deleteRows(
    "booking_items",
    `id=eq.${encodeURIComponent(id)}`,
  );
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
    >
  >,
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  if (patch.qty !== undefined) {
    const qty = Math.max(
      1,
      Math.floor(
        Number(patch.qty),
      ),
    );

    await updateRows(
      "booking_items",
      `id=eq.${encodeURIComponent(id)}`,
      { qty },
    );
  }

  const current =
    await selectRows<any>(
      "booking_items",
      `select=booking_id,bookings(id,code,customer_id)&id=eq.${encodeURIComponent(id)}`,
    );

  const bookingId =
    current[0]?.booking_id;

  if (
    bookingId &&
    (
      patch.start !== undefined ||
      patch.end !== undefined ||
      patch.name !== undefined ||
      patch.phone !== undefined ||
      patch.description !==
        undefined
    )
  ) {
    const bPatch: any = {};

    if (
      patch.start !== undefined
    ) {
      bPatch.start_date =
        patch.start;
    }

    if (
      patch.end !== undefined
    ) {
      bPatch.end_date =
        patch.end;
    }

    if (
      Object.keys(bPatch)
        .length
    ) {
      bPatch.updated_at =
        new Date().toISOString();

      await updateRows(
        "bookings",
        `id=eq.${encodeURIComponent(
          bookingId,
        )}`,
        bPatch,
      );
    }

    if (
      patch.name !== undefined ||
      patch.phone !== undefined ||
      patch.description !==
        undefined
    ) {
      const customerId =
        current[0]?.bookings
          ?.customer_id;

      if (customerId) {
        const cp: any = {};

        if (
          patch.name !==
          undefined
        ) {
          cp.name =
            patch.name;
        }

        if (
          patch.phone !==
          undefined
        ) {
          cp.phone =
            patch.phone;
        }

        if (
          patch.description !==
          undefined
        ) {
          cp.description =
            patch.description;
        }

        if (
          Object.keys(cp)
            .length
        ) {
          cp.updated_at =
            new Date().toISOString();

          await updateRows(
            "customers",
            `id=eq.${encodeURIComponent(
              customerId,
            )}`,
            cp,
          );
        }
      }
    }
  }
}

export function bookingsByCode(
  bookings: Booking[],
  code: string,
) {
  return bookings.filter(
    (b) =>
      b.code.toLowerCase() ===
      code.trim().toLowerCase(),
  );
}

export function useBookings() {
  const [
    bookings,
    setBookings,
  ] = useState<Booking[]>(
    [],
  );

  const refresh =
    useCallback(
      async () => {
        try {
          const next =
            await loadBookings();

          setBookings(next);
        } catch {
          setBookings([]);
        }
      },
      [],
    );

  useEffect(() => {
    refresh();

    const t =
      window.setInterval(
        refresh,
        15000,
      );

    return () =>
      window.clearInterval(
        t,
      );
  }, [refresh]);

  return {
    bookings,
    refresh,
  };
}

export function bookedQtyOn(
  bookings: Booking[],
  productId: string,
  dayKey: string,
) {
  return bookings
    .filter(
      (b) =>
        b.productId ===
          productId &&
        occupiedDays(
          b.start,
          b.end,
        ).includes(dayKey) &&
        b.status !==
          "cancelled",
    )
    .reduce(
      (s, b) =>
        s + b.qty,
      0,
    );
}

export function totalOutOn(
  bookings: Booking[],
  dayKey: string,
) {
  return bookings
    .filter(
      (b) =>
        occupiedDays(
          b.start,
          b.end,
        ).includes(dayKey) &&
        b.status !==
          "cancelled",
    )
    .reduce(
      (s, b) =>
        s + b.qty,
      0,
    );
}

export function bookingsOn(
  bookings: Booking[],
  dayKey: string,
) {
  return bookings.filter(
    (b) =>
      occupiedDays(
        b.start,
        b.end,
      ).includes(dayKey) &&
      b.status !==
        "cancelled",
  );
}

export function stockOf(
  productId: string,
) {
  return (
    products.find(
      (p) =>
        p.id === productId,
    )?.stock ?? 0
  );
}

export function availableInRange(
  bookings: Booking[],
  productId: string,
  start: string,
  end: string,
  excludeBookingId?: string,
  maintenance: Array<{
    productId: string;
    startDate: string;
    endDate: string;
  }> = [],
) {
  const stock =
    stockOf(productId);

  const days =
    occupiedDays(
      start,
      end,
    );

  const maintenanceConflicts =
    maintenance.filter(
      (m) =>
        m.productId ===
          productId &&
        m.startDate <
          end &&
        m.endDate >=
          start,
    );

  const scoped =
    excludeBookingId
      ? bookings.filter(
          (b) =>
            b.bookingId !==
            excludeBookingId,
        )
      : bookings;

  const perDay =
    days.map((day) => ({
      day,
      available:
        stock -
        bookedQtyOn(
          scoped,
          productId,
          day,
        ),
    }));

  const available =
    perDay.length
      ? Math.min(
          ...perDay.map(
            (d) =>
              d.available,
          ),
        )
      : stock;

  return {
    available:
      maintenanceConflicts.length
        ? 0
        : available,
    conflicts:
      perDay.filter(
        (d) =>
          d.available <= 0,
      ),
    maintenanceConflicts,
  };
}

export type DayStatus =
  | "Kosong"
  | "Terisi"
  | "Penuh";

export function dayStatusFor(
  bookings: Booking[],
  dayKey: string,
  productId?: string,
) {
  if (productId) {
    const capacity =
      stockOf(productId);

    const out =
      bookedQtyOn(
        bookings,
        productId,
        dayKey,
      );

    return {
      status:
        out === 0
          ? "Kosong"
          : out >= capacity
            ? "Penuh"
            : ("Terisi" as DayStatus),
      out,
      capacity,
    };
  }

  const capacity =
    products.reduce(
      (s, p) =>
        s + p.stock,
      0,
    );

  const out =
    totalOutOn(
      bookings,
      dayKey,
    );

  return {
    status:
      out === 0
        ? "Kosong"
        : out >= capacity
          ? "Penuh"
          : ("Terisi" as DayStatus),
    out,
    capacity,
  };
}

export function getRentalCountMap(
  bookings: Booking[],
) {
  const map: Record<
    string,
    number
  > = {};

  for (const b of bookings) {
    if (
      b.status ===
      "cancelled"
    )
      continue;

    map[b.productId] =
      (map[b.productId] || 0) +
      Number(b.qty || 0);
  }

  return map;
}

export function getTerlarisByKategori(
  bookings: Booking[],
  limit = 4,
) {
  const countMap =
    getRentalCountMap(
      bookings,
    );

  const grouped =
    new Map<
      string,
      Product[]
    >();

  for (const p of products) {
    const rawKat =
      (p as any).kategori ||
      (p as any).category ||
      "lainnya";

    const kat =
      String(
        rawKat,
      ).toLowerCase();

    if (
      !grouped.has(kat)
    ) {
      grouped.set(
        kat,
        [],
      );
    }

    grouped
      .get(kat)!
      .push(p);
  }

  const result: Record<
    string,
    Product[]
  > = {};

  for (
    const [kat, list] of
      grouped.entries()
  ) {
    const sorted =
      [...list].sort(
        (a, b) =>
          (countMap[
            b.id
          ] || 0) -
          (countMap[
            a.id
          ] || 0),
      );

    result[kat] =
      sorted.slice(
        0,
        limit,
      );
  }

  return result;
}

export function getTerlarisGlobal(
  bookings: Booking[],
  limit = 8,
) {
  const countMap =
    getRentalCountMap(
      bookings,
    );

  return [...products]
    .sort(
      (a: any, b: any) =>
        (countMap[
          b.id
        ] || 0) -
        (countMap[
          a.id
        ] || 0),
    )
    .slice(
      0,
      limit,
    );
}