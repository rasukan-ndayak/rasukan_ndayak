import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

/* =========================================================
   ADMIN WHATSAPP
========================================================= */

export const ADMIN_WA = "6285726019040";


/* =========================================================
   DATE HELPER
========================================================= */

const tgl = (v: string) => {
  if (!v) return "-";

  try {
    return format(
      parseISO(v),
      "EEEE, d MMMM yyyy",
      {
        locale: localeId,
      },
    );
  } catch {
    return v;
  }
};


/* =========================================================
   CURRENCY HELPER
========================================================= */

export function formatRupiah(
  value: number | string | null | undefined,
): string {
  const amount =
    Number(value ?? 0);

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0,
  );
}


/* =========================================================
   SINGLE BOOKING
========================================================= */

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

  /* =========================
     PAYMENT
  ========================= */

  dpRequired?: boolean;

  dpAmount?: number;

  paymentStatus?:
    | "not_required"
    | "unpaid"
    | "pending"
    | "paid"
    | "rejected";

  paymentMethod?:
    | "qris"
    | "cash_offline"
    | "transfer_offline"
    | null;
};


/* =========================================================
   BUILD SINGLE BOOKING MESSAGE
========================================================= */

export function buildWaMessage(
  b: WaBooking,
): string {
  const paymentLines: string[] = [];

  if (
    b.dpRequired === true
  ) {
    paymentLines.push(
      `DP: ${formatRupiah(
        b.dpAmount ?? 0,
      )}`,
    );

    paymentLines.push(
      `Status pembayaran: ${
        b.paymentStatus ??
        "unpaid"
      }`,
    );

    if (b.paymentMethod) {
      paymentLines.push(
        `Metode pembayaran: ${b.paymentMethod}`,
      );
    }
  }

  return [
    "Halo Rasukan Ndayak, saya ingin konfirmasi booking:",
    "",

    `Kode: ${b.code}`,

    `Koleksi: ${b.productName}`,

    `Jumlah: ${b.qty} ${b.unit}`,

    `Tanggal keluar: ${tgl(
      b.start,
    )}`,

    `Tanggal masuk: ${tgl(
      b.end,
    )}`,

    `Durasi: ${b.days} hari`,

    `Total biaya: ${b.total}`,

    ...(paymentLines.length
      ? [
          "",
          ...paymentLines,
        ]
      : []),

    "",

    `Nama: ${
      b.name || "-"
    }`,

    `WhatsApp: ${
      b.phone || "-"
    }`,

    `Deskripsi: ${
      b.description || "-"
    }`,
  ].join("\n");
}


/* =========================================================
   SINGLE BOOKING WA LINK
========================================================= */

export function waLink(
  b: WaBooking,
): string {
  return (
    `https://wa.me/${ADMIN_WA}` +
    `?text=${encodeURIComponent(
      buildWaMessage(b),
    )}`
  );
}


/* =========================================================
   MULTI ITEM
========================================================= */

export type WaItem = {
  productName: string;

  qty: number;

  unit: string;

  subtotal: string;
};


/* =========================================================
   MULTI ITEM BOOKING
========================================================= */

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

  /* =========================
     PAYMENT
  ========================= */

  dpRequired?: boolean;

  dpAmount?: number;

  paymentStatus?:
    | "not_required"
    | "unpaid"
    | "pending"
    | "paid"
    | "rejected";

  paymentMethod?:
    | "qris"
    | "cash_offline"
    | "transfer_offline"
    | null;
};


/* =========================================================
   PAYMENT LABEL
========================================================= */

function paymentStatusLabel(
  status:
    | "not_required"
    | "unpaid"
    | "pending"
    | "paid"
    | "rejected"
    | undefined,
): string {
  switch (status) {
    case "not_required":
      return "Tidak diperlukan";

    case "unpaid":
      return "Belum dibayar";

    case "pending":
      return "Menunggu verifikasi";

    case "paid":
      return "Sudah dibayar";

    case "rejected":
      return "Ditolak";

    default:
      return "-";
  }
}


/* =========================================================
   PAYMENT METHOD LABEL
========================================================= */

function paymentMethodLabel(
  method:
    | "qris"
    | "cash_offline"
    | "transfer_offline"
    | null
    | undefined,
): string {
  switch (method) {
    case "qris":
      return "QRIS";

    case "cash_offline":
      return "Cash / Tunai";

    case "transfer_offline":
      return "Transfer";

    default:
      return "-";
  }
}


/* =========================================================
   BUILD MULTI ITEM MESSAGE
========================================================= */

export function buildWaOrderMessage(
  o: WaOrder,
): string {
  const paymentLines: string[] = [];

  if (
    o.dpRequired === true
  ) {
    paymentLines.push(
      `DP: ${formatRupiah(
        o.dpAmount ?? 0,
      )}`,
    );

    paymentLines.push(
      `Status pembayaran: ${paymentStatusLabel(
        o.paymentStatus,
      )}`,
    );

    if (o.paymentMethod) {
      paymentLines.push(
        `Metode pembayaran: ${paymentMethodLabel(
          o.paymentMethod,
        )}`,
      );
    }
  } else {
    paymentLines.push(
      "DP: Tidak diperlukan",
    );
  }

  return [
    "Halo Rasukan Ndayak, saya ingin konfirmasi booking:",
    "",

    `Kode: ${o.code}`,

    "",

    "Item yang disewa:",

    ...o.items.map(
      (it, i) =>
        `${i + 1}. ${it.productName} — ${it.qty} ${it.unit} (${it.subtotal})`,
    ),

    "",

    `Tanggal keluar: ${tgl(
      o.start,
    )}`,

    `Tanggal masuk: ${tgl(
      o.end,
    )}`,

    `Durasi: ${o.days} hari`,

    `Total biaya: ${o.total}`,

    "",

    ...paymentLines,

    "",

    `Nama: ${
      o.name || "-"
    }`,

    `WhatsApp: ${
      o.phone || "-"
    }`,

    `Deskripsi: ${
      o.description || "-"
    }`,
  ].join("\n");
}


/* =========================================================
   MULTI ITEM WA LINK
========================================================= */

export function waOrderLink(
  o: WaOrder,
): string {
  return (
    `https://wa.me/${ADMIN_WA}` +
    `?text=${encodeURIComponent(
      buildWaOrderMessage(o),
    )}`
  );
}


/* =========================================================
   BOOKING CONFIRMATION MESSAGE
========================================================= */

export type WaConfirmation = {
  code: string;

  name: string;

  start: string;

  end: string;

  days: number;

  total: string;

  dpRequired: boolean;

  dpAmount: number;

  paymentStatus:
    | "not_required"
    | "unpaid"
    | "pending"
    | "paid"
    | "rejected";
};


/* =========================================================
   BUILD CONFIRMATION MESSAGE
========================================================= */

export function buildWaConfirmationMessage(
  b: WaConfirmation,
): string {
  const paymentText =
    b.dpRequired
      ? [
          `DP: ${formatRupiah(
            b.dpAmount,
          )}`,
          `Status pembayaran: ${paymentStatusLabel(
            b.paymentStatus,
          )}`,
        ]
      : [
          "DP: Tidak diperlukan",
          "Status pembayaran: Tidak diperlukan",
        ];

  return [
    "Halo,",

    "",

    "Booking Rasukan Ndayak Anda telah diproses.",

    "",

    `Kode booking: ${b.code}`,

    `Nama: ${
      b.name || "-"
    }`,

    "",

    `Tanggal keluar: ${tgl(
      b.start,
    )}`,

    `Tanggal masuk: ${tgl(
      b.end,
    )}`,

    `Durasi: ${b.days} hari`,

    "",

    `Total biaya: ${b.total}`,

    ...paymentText,

    "",

    "Terima kasih telah menggunakan Rasukan Ndayak.",
  ].join("\n");
}


/* =========================================================
   CONFIRMATION WA LINK
========================================================= */

export function waConfirmationLink(
  b: WaConfirmation,
): string {
  return (
    `https://wa.me/${ADMIN_WA}` +
    `?text=${encodeURIComponent(
      buildWaConfirmationMessage(b),
    )}`
  );
}


/* =========================================================
   PAYMENT REMINDER
========================================================= */

export type WaPaymentReminder = {
  code: string;

  name: string;

  dpAmount: number;

  paymentMethod?:
    | "qris"
    | "cash_offline"
    | "transfer_offline"
    | null;
};


/* =========================================================
   BUILD PAYMENT REMINDER
========================================================= */

export function buildWaPaymentReminderMessage(
  b: WaPaymentReminder,
): string {
  return [
    `Halo ${
      b.name || ""
    },`,

    "",

    "Kami mengingatkan pembayaran DP booking Rasukan Ndayak Anda.",

    "",

    `Kode booking: ${b.code}`,

    `Jumlah DP: ${formatRupiah(
      b.dpAmount,
    )}`,

    `Metode pembayaran: ${paymentMethodLabel(
      b.paymentMethod,
    )}`,

    "",

    "Silakan melakukan pembayaran dan mengirimkan bukti pembayaran jika diperlukan.",

    "",

    "Terima kasih.",
  ].join("\n");
}


/* =========================================================
   PAYMENT REMINDER WA LINK
========================================================= */

export function waPaymentReminderLink(
  b: WaPaymentReminder,
): string {
  return (
    `https://wa.me/${ADMIN_WA}` +
    `?text=${encodeURIComponent(
      buildWaPaymentReminderMessage(
        b,
      ),
    )}`
  );
}


/* =========================================================
   GENERIC WA LINK
========================================================= */

export function waTextLink(
  message: string,
): string {
  return (
    `https://wa.me/${ADMIN_WA}` +
    `?text=${encodeURIComponent(
      message,
    )}`
  );
}