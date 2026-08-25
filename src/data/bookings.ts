import {
  addDays,
  format,
  isAfter,
  parseISO,
} from "date-fns";
import { useCallback, useEffect, useState } from "react";

import {
  deleteRows,
  insertRows,
  rpc,
  selectRows,
  supabaseConfigured,
  updateRows,
} from "@/lib/supabase-rest";

import {
  products,
  type Product,
} from "@/data/products";


/* =========================================================
   TYPE BOOKING
========================================================= */

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

  /* =========================
     MEMBER
  ========================= */

  memberStatus?: "new" | "member";

  /* =========================
     PEMBAYARAN
  ========================= */

  dpRequired: boolean;
  dpAmount: number;

  paymentStatus:
    | "not_required"
    | "unpaid"
    | "pending"
    | "paid"
    | "rejected";

  paymentMethod:
    | "qris"
    | "cash_offline"
    | "transfer_offline"
    | null;

  /* =========================
     BUKTI PEMBAYARAN
  ========================= */

  paymentProofUrl: string | null;

  paymentProofPublicId: string | null;

  paymentSubmittedAt: string | null;

  paymentNote: string | null;

  /* =========================
     VERIFIKASI PEMBAYARAN
  ========================= */

  paymentVerifiedAt: string | null;

  paymentVerifiedBy: string | null;

  /* =========================
     KONFIRMASI BOOKING
  ========================= */

  confirmedAt: string | null;

  confirmedBy: string | null;
};


/* =========================================================
   DATE HELPER
========================================================= */

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


/* =========================================================
   ROW → BOOKING
========================================================= */

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

    code:
      r.code ??
      "",

    productId:
      r.product_id ??
      "",

    qty:
      Number(r.qty ?? 0),

    priceAtBooking:
      Number(
        r.price_at_booking ??
        r.priceAtBooking ??
        0,
      ),

    start:
      r.start_date ??
      r.start ??
      "",

    end:
      r.end_date ??
      r.end ??
      "",

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
      r.createdAt ??
      new Date().toISOString(),

    status:
      r.status ??
      "pending",

    /* =========================
       MEMBER
    ========================= */

    memberStatus:
      r.member_status ??
      r.memberStatus ??
      "new",

    /* =========================
       PEMBAYARAN
    ========================= */

    dpRequired:
      Boolean(
        r.dp_required ??
        r.dpRequired ??
        false,
      ),

    dpAmount:
      Number(
        r.dp_amount ??
        r.dpAmount ??
        0,
      ),

    paymentStatus:
      r.payment_status ??
      r.paymentStatus ??
      "not_required",

    paymentMethod:
      r.payment_method ??
      r.paymentMethod ??
      null,

    /* =========================
       BUKTI PEMBAYARAN
    ========================= */

    paymentProofUrl:
      r.payment_proof_url ??
      r.paymentProofUrl ??
      null,

    paymentProofPublicId:
      r.payment_proof_public_id ??
      r.paymentProofPublicId ??
      null,

    paymentSubmittedAt:
      r.payment_submitted_at ??
      r.paymentSubmittedAt ??
      null,

    paymentNote:
      r.payment_note ??
      r.paymentNote ??
      null,

    /* =========================
       VERIFIKASI
    ========================= */

    paymentVerifiedAt:
      r.payment_verified_at ??
      r.paymentVerifiedAt ??
      null,

    paymentVerifiedBy:
      r.payment_verified_by ??
      r.paymentVerifiedBy ??
      null,

    /* =========================
       KONFIRMASI
    ========================= */

    confirmedAt:
      r.confirmed_at ??
      r.confirmedAt ??
      null,

    confirmedBy:
      r.confirmed_by ??
      r.confirmedBy ??
      null,
  };
}


/* =========================================================
   LOAD BOOKINGS
========================================================= */

export async function loadBookings(): Promise<
  Booking[]
> {
  if (!supabaseConfigured) return [];

  const rows =
    await selectRows<any>(
      "booking_items",
      [
        "select=" +
          [
            "id",
            "qty",
            "price_at_booking",
            "product_id",
            "booking_id",

            "bookings(" +
              [
                "id",
                "code",
                "start_date",
                "end_date",
                "status",
                "created_at",
                "customer_id",

                /* PAYMENT */
                "dp_required",
                "dp_amount",
                "payment_status",
                "payment_method",
                "payment_proof_url",
                "payment_proof_public_id",
                "payment_submitted_at",
                "payment_note",
                "payment_verified_at",
                "payment_verified_by",

                /* CONFIRM */
                "confirmed_at",
                "confirmed_by",

                /* CUSTOMER */
                "customers(" +
                  [
                    "name",
                    "phone",
                    "description",
                    "member_status",
                  ].join(",") +
                ")",
              ].join(",") +
            ")",
          ].join(",") +

          "&bookings.status=neq.cancelled" +

          "&order=created_at.desc",
      ].join(""),
    );

  return rows
    .map((r: any) => {
      const b =
        Array.isArray(r.bookings)
          ? r.bookings[0]
          : (
              r.bookings ??
              r.booking ??
              null
            );

      if (!b?.id) return null;

      const customer =
        Array.isArray(b.customers)
          ? b.customers[0]
          : (
              b.customers ??
              null
            );

      return fromRow({
        ...r,

        id:
          r.id,

        booking_id:
          r.booking_id,

        code:
          b.code ?? "",

        product_id:
          r.product_id,

        start_date:
          b.start_date ?? "",

        end_date:
          b.end_date ?? "",

        status:
          b.status ?? "pending",

        created_at:
          b.created_at ?? "",

        name:
          customer?.name ?? "",

        phone:
          customer?.phone ?? "",

        description:
          customer?.description ?? "",

        member_status:
          customer?.member_status ??
          "new",

        /* =========================
           PAYMENT
        ========================= */

        dp_required:
          b.dp_required ??
          false,

        dp_amount:
          b.dp_amount ??
          0,

        payment_status:
          b.payment_status ??
          "not_required",

        payment_method:
          b.payment_method ??
          null,

        payment_proof_url:
          b.payment_proof_url ??
          null,

        payment_proof_public_id:
          b.payment_proof_public_id ??
          null,

        payment_submitted_at:
          b.payment_submitted_at ??
          null,

        payment_note:
          b.payment_note ??
          null,

        payment_verified_at:
          b.payment_verified_at ??
          null,

        payment_verified_by:
          b.payment_verified_by ??
          null,

        /* =========================
           CONFIRM
        ========================= */

        confirmed_at:
          b.confirmed_at ??
          null,

        confirmed_by:
          b.confirmed_by ??
          null,
      });
    })
    .filter(
      (b): b is Booking =>
        b !== null,
    );
}


/* =========================================================
   SAVE BOOKING GROUP
========================================================= */

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
        p_name:
          common.name,

        p_phone:
          common.phone,

        p_description:
          common.description,

        p_start:
          common.start,

        p_end:
          common.end,

        p_items:
          items,
      },
    );

  const code =
    result.code as string;

  const bookings =
    (
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

        qty:
          Number(
            x.qty ?? 0,
          ),

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
          result.status ??
          "pending",

        /* =========================
           MEMBER
        ========================= */

        memberStatus:
          result.memberStatus ??
          "new",

        /* =========================
           PAYMENT
        ========================= */

        dpRequired:
          Boolean(
            result.dpRequired ??
            false,
          ),

        dpAmount:
          Number(
            result.dpAmount ??
            0,
          ),

        paymentStatus:
          result.paymentStatus ??
          "not_required",

        paymentMethod:
          result.paymentMethod ??
          null,

        paymentProofUrl:
          null,

        paymentProofPublicId:
          null,

        paymentSubmittedAt:
          null,

        paymentNote:
          null,

        paymentVerifiedAt:
          null,

        paymentVerifiedBy:
          null,

        confirmedAt:
          null,

        confirmedBy:
          null,
      }),
    );

  return {
    code,

    bookingId:
      result.bookingId as
        | string
        | undefined,

    customerId:
      result.customerId as
        | string
        | undefined,

    memberStatus:
      result.memberStatus ??
      "new",

    dpRequired:
      Boolean(
        result.dpRequired ??
        false,
      ),

    totalAmount:
      Number(
        result.totalAmount ??
        0,
      ),

    dpAmount:
      Number(
        result.dpAmount ??
        0,
      ),

    paymentStatus:
      result.paymentStatus ??
      "not_required",

    status:
      result.status ??
      "pending",

    bookings,
  };
}


/* =========================================================
   SAVE SINGLE BOOKING
========================================================= */

export async function saveBooking(
  b: Omit<
    Booking,
    | "id"
    | "bookingId"
    | "code"
    | "createdAt"
    | "dpRequired"
    | "dpAmount"
    | "paymentStatus"
    | "paymentMethod"
    | "paymentProofUrl"
    | "paymentProofPublicId"
    | "paymentSubmittedAt"
    | "paymentNote"
    | "paymentVerifiedAt"
    | "paymentVerifiedBy"
    | "confirmedAt"
    | "confirmedBy"
    | "memberStatus"
  >,
) {
  return (
    await saveBookingGroup(
      b,
      [
        {
          productId:
            b.productId,

          qty:
            b.qty,
        },
      ],
    ).then(
      (result) =>
        result.bookings[0]!,
    )
  );
}


/* =========================================================
   PAYMENT METHOD TYPE
========================================================= */

export type PaymentMethod =
  | "qris"
  | "cash_offline"
  | "transfer_offline";


/* =========================================================
   SUBMIT PEMBAYARAN ONLINE
   =========================================================
   Digunakan setelah penyewa upload bukti transfer
   ke Cloudinary.

   Cloudinary upload dilakukan oleh frontend.
   Fungsi ini hanya menyimpan hasil URL/public_id
   ke Supabase.
========================================================= */

export type SubmitPaymentProofOptions = {
  bookingId: string;

  paymentMethod:
    | "qris"
    | "transfer_offline";

  paymentProofUrl: string;

  paymentProofPublicId?: string | null;

  paymentNote?: string | null;
};


export async function submitPaymentProof(
  options: SubmitPaymentProofOptions,
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  if (
    !options.bookingId
      .trim()
  ) {
    throw new Error(
      "Booking ID tidak ditemukan.",
    );
  }

  if (
    !options.paymentProofUrl
      .trim()
  ) {
    throw new Error(
      "Bukti pembayaran belum tersedia.",
    );
  }

  if (
    options.paymentMethod !==
      "qris" &&
    options.paymentMethod !==
      "transfer_offline"
  ) {
    throw new Error(
      "Metode pembayaran tidak valid.",
    );
  }

  await updateRows(
    "bookings",
    `id=eq.${encodeURIComponent(
      options.bookingId,
    )}`,
    {
      payment_method:
        options.paymentMethod,

      payment_status:
        "pending",

      payment_proof_url:
        options.paymentProofUrl,

      payment_proof_public_id:
        options.paymentProofPublicId ??
        null,

      payment_submitted_at:
        new Date().toISOString(),

      payment_note:
        options.paymentNote ??
        null,

      updated_at:
        new Date().toISOString(),
    },
  );

  return {
    success: true,

    bookingId:
      options.bookingId,

    paymentMethod:
      options.paymentMethod,

    paymentStatus:
      "pending",

    paymentProofUrl:
      options.paymentProofUrl,
  };
}


/* =========================================================
   SUBMIT PEMBAYARAN OFFLINE
========================================================= */

export type SubmitOfflinePaymentOptions = {
  bookingId: string;

  paymentMethod:
    | "cash_offline"
    | "transfer_offline";

  paymentNote?: string | null;
};


export async function submitOfflinePayment(
  options: SubmitOfflinePaymentOptions,
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  if (
    !options.bookingId
      .trim()
  ) {
    throw new Error(
      "Booking ID tidak ditemukan.",
    );
  }

  if (
    options.paymentMethod !==
      "cash_offline" &&
    options.paymentMethod !==
      "transfer_offline"
  ) {
    throw new Error(
      "Metode pembayaran offline tidak valid.",
    );
  }

  await updateRows(
    "bookings",
    `id=eq.${encodeURIComponent(
      options.bookingId,
    )}`,
    {
      payment_method:
        options.paymentMethod,

      payment_status:
        "pending",

      payment_proof_url:
        null,

      payment_proof_public_id:
        null,

      payment_submitted_at:
        new Date().toISOString(),

      payment_note:
        options.paymentNote ??
        null,

      updated_at:
        new Date().toISOString(),
    },
  );

  return {
    success: true,

    bookingId:
      options.bookingId,

    paymentMethod:
      options.paymentMethod,

    paymentStatus:
      "pending",
  };
}


/* =========================================================
   UPDATE PAYMENT STATUS
   =========================================================
   Dipakai ADMIN.

   Untuk paid:
   - payment_status = paid
   - payment_verified_at = now
   - payment_verified_by = admin

   Untuk rejected:
   - payment_status = rejected
   - payment_verified_at = now
   - payment_verified_by = admin
========================================================= */

export type UpdatePaymentStatusOptions = {
  bookingId: string;

  status:
    | "pending"
    | "paid"
    | "rejected";

  admin?: string;

  note?: string | null;
};


export async function updatePaymentStatus(
  options: UpdatePaymentStatusOptions,
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  const paymentStatus =
    options.status;

  const patch: Record<
    string,
    any
  > = {
    payment_status:
      paymentStatus,

    updated_at:
      new Date().toISOString(),
  };

  if (
  paymentStatus ===
    "paid" ||
  paymentStatus ===
    "rejected"
) {
  patch["payment_verified_at"] =
    new Date().toISOString();

  patch["payment_verified_by"] =
    options.admin ??
    "admin";
} else {
  patch["payment_verified_at"] =
    null;

  patch["payment_verified_by"] =
    null;
}

if (
  options.note !==
  undefined
) {
  patch["payment_note"] =
    options.note;
}

  await updateRows(
    "bookings",
    `id=eq.${encodeURIComponent(
      options.bookingId,
    )}`,
    patch,
  );

  return {
    success: true,

    bookingId:
      options.bookingId,

    paymentStatus,
  };
}


/* =========================================================
   CONFIRM BOOKING
========================================================= */

export type ConfirmBookingOptions = {
  bookingId: string;

  paymentMethod?:
    | "qris"
    | "cash_offline"
    | "transfer_offline";

  dpPaid?: boolean;

  admin?: string;
};


export async function confirmBooking(
  options: ConfirmBookingOptions,
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  const result =
    await rpc<any>(
      "confirm_booking",
      {
        p_booking_id:
          options.bookingId,

        p_payment_method:
          options.paymentMethod ??
          null,

        p_dp_paid:
          options.dpPaid ??
          false,

        p_admin:
          options.admin ??
          "admin",
      },
    );

  return result;
}


/* =========================================================
   CONFIRM PAYMENT + BOOKING
   =========================================================
   Helper untuk admin.

   Untuk member lama:
   - RPC akan melewati DP
   - booking langsung confirmed

   Untuk member baru:
   - DP harus sudah diterima
   - dpPaid harus true
========================================================= */

export async function confirmPaymentAndBooking(
  options: {
    bookingId: string;

    paymentMethod:
      | "qris"
      | "cash_offline"
      | "transfer_offline";

    admin?: string;
  },
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  const result =
    await confirmBooking({
      bookingId:
        options.bookingId,

      paymentMethod:
        options.paymentMethod,

      dpPaid:
        true,

      admin:
        options.admin ??
        "admin",
    });

  return result;
}


/* =========================================================
   REMOVE BOOKING GROUP
========================================================= */

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


/* =========================================================
   REMOVE BOOKING ITEM
========================================================= */

export async function removeBooking(
  id: string,
) {
  await deleteRows(
    "booking_items",
    `id=eq.${encodeURIComponent(id)}`,
  );
}


/* =========================================================
   UPDATE BOOKING
========================================================= */

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


  /* =========================
     UPDATE QTY
  ========================= */

  if (
    patch.qty !== undefined
  ) {
    const qty =
      Math.max(
        1,
        Math.floor(
          Number(
            patch.qty,
          ),
        ),
      );

    await updateRows(
      "booking_items",
      `id=eq.${encodeURIComponent(
        id,
      )}`,
      {
        qty,
      },
    );
  }


  /* =========================
     AMBIL BOOKING ID
  ========================= */

  const current =
    await selectRows<any>(
      "booking_items",
      `select=booking_id,bookings(id,code,customer_id)&id=eq.${encodeURIComponent(
        id,
      )}`,
    );

  const bookingId =
    current[0]?.booking_id;


  /* =========================
     UPDATE BOOKING
  ========================= */

  if (
    bookingId &&
    (
      patch.start !==
        undefined ||
      patch.end !==
        undefined ||
      patch.name !==
        undefined ||
      patch.phone !==
        undefined ||
      patch.description !==
        undefined
    )
  ) {
    const bPatch: any = {};


    if (
      patch.start !==
      undefined
    ) {
      bPatch.start_date =
        patch.start;
    }


    if (
      patch.end !==
      undefined
    ) {
      bPatch.end_date =
        patch.end;
    }


    if (
      Object.keys(
        bPatch,
      ).length
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


    /* =========================
       UPDATE CUSTOMER
    ========================= */

    if (
      patch.name !==
        undefined ||
      patch.phone !==
        undefined ||
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
          Object.keys(
            cp,
          ).length
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


/* =========================================================
   ADD BOOKING ITEM
========================================================= */

export async function addBookingItem(
  bookingId: string,
  productId: string,
  qty: number,
  start?: string,
  end?: string,
) {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase belum dikonfigurasi.",
    );
  }

  const product =
    products.find(
      (p) =>
        p.id ===
        productId,
    );

  if (!product) {
    throw new Error(
      "Produk tidak ditemukan.",
    );
  }

  const safeQty =
    Math.max(
      1,
      Math.floor(
        Number(qty),
      ),
    );


  await insertRows(
    "booking_items",
    [
      {
        booking_id:
          bookingId,

        product_id:
          productId,

        qty:
          safeQty,

        price_at_booking:
          product.price,
      },
    ],
  );


  if (
    start !== undefined ||
    end !== undefined
  ) {
    const bookingPatch:
      Record<
        string,
        string
      > = {
        updated_at:
          new Date().toISOString(),
      };


    if (
      start !== undefined
    ) {
      bookingPatch[
        "start_date"
      ] = start;
    }


    if (
      end !== undefined
    ) {
      bookingPatch[
        "end_date"
      ] = end;
    }


    await updateRows(
      "bookings",
      `id=eq.${encodeURIComponent(
        bookingId,
      )}`,
      bookingPatch,
    );
  }
}


/* =========================================================
   BOOKING BY CODE
========================================================= */

export function bookingsByCode(
  bookings: Booking[],
  code: string,
) {
  return bookings.filter(
    (b) =>
      b.code.toLowerCase() ===
      code
        .trim()
        .toLowerCase(),
  );
}


/* =========================================================
   HOOK BOOKINGS
========================================================= */

export function useBookings() {
  const [
    bookings,
    setBookings,
  ] =
    useState<Booking[]>(
      [],
    );


  const refresh =
    useCallback(
      async () => {
        try {
          const next =
            await loadBookings();

          setBookings(
            next,
          );
        } catch {
          setBookings(
            [],
          );
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


/* =========================================================
   BOOKED QTY
========================================================= */

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
        ).includes(
          dayKey,
        ) &&
        b.status !==
          "cancelled",
    )
    .reduce(
      (s, b) =>
        s +
        b.qty,
      0,
    );
}


/* =========================================================
   TOTAL OUT
========================================================= */

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
        ).includes(
          dayKey,
        ) &&
        b.status !==
          "cancelled",
    )
    .reduce(
      (s, b) =>
        s +
        b.qty,
      0,
    );
}


/* =========================================================
   BOOKINGS ON
========================================================= */

export function bookingsOn(
  bookings: Booking[],
  dayKey: string,
) {
  return bookings.filter(
    (b) =>
      occupiedDays(
        b.start,
        b.end,
      ).includes(
        dayKey,
      ) &&
      b.status !==
        "cancelled",
  );
}


/* =========================================================
   STOCK
========================================================= */

export function stockOf(
  productId: string,
) {
  return (
    products.find(
      (p) =>
        p.id ===
        productId,
    )?.stock ??
    0
  );
}


/* =========================================================
   AVAILABLE IN RANGE
========================================================= */

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
    stockOf(
      productId,
    );

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
    days.map(
      (day) => ({
        day,

        available:
          stock -
          bookedQtyOn(
            scoped,
            productId,
            day,
          ),
      }),
    );


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
          d.available <=
          0,
      ),

    maintenanceConflicts,
  };
}


/* =========================================================
   DAY STATUS
========================================================= */

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
      stockOf(
        productId,
      );

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
          : out >=
              capacity
            ? "Penuh"
            : ("Terisi" as DayStatus),

      out,

      capacity,
    };
  }


  const capacity =
    products.reduce(
      (s, p) =>
        s +
        p.stock,
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
        : out >=
            capacity
          ? "Penuh"
          : ("Terisi" as DayStatus),

    out,

    capacity,
  };
}


/* =========================================================
   RENTAL COUNT MAP
========================================================= */

export function getRentalCountMap(
  bookings: Booking[],
) {
  const map: Record<
    string,
    number
  > = {};


  for (
    const b of bookings
  ) {
    if (
      b.status ===
      "cancelled"
    ) {
      continue;
    }


    map[
      b.productId
    ] =
      (
        map[
          b.productId
        ] ||
        0
      ) +
      Number(
        b.qty ||
        0,
      );
  }


  return map;
}


/* =========================================================
   TERLARIS PER KATEGORI
========================================================= */

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


  for (
    const p of products
  ) {
    const rawKat =
      (p as any)
        .kategori ||
      (p as any)
        .category ||
      "lainnya";


    const kat =
      String(
        rawKat,
      ).toLowerCase();


    if (
      !grouped.has(
        kat,
      )
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
    const [
      kat,
      list,
    ] of grouped.entries()
  ) {
    const sorted =
      [...list].sort(
        (a, b) =>
          (
            countMap[
              b.id
            ] ||
            0
          ) -
          (
            countMap[
              a.id
            ] ||
            0
          ),
      );


    result[kat] =
      sorted.slice(
        0,
        limit,
      );
  }


  return result;
}


/* =========================================================
   TERLARIS GLOBAL
========================================================= */

export function getTerlarisGlobal(
  bookings: Booking[],
  limit = 8,
) {
  const countMap =
    getRentalCountMap(
      bookings,
    );


  return [
    ...products,
  ]
    .sort(
      (a: any, b: any) =>
        (
          countMap[
            b.id
          ] ||
          0
        ) -
        (
          countMap[
            a.id
          ] ||
          0
        ),
    )
    .slice(
      0,
      limit,
    );
}