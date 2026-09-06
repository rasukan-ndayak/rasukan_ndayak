import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, differenceInCalendarDays, format, getDaysInMonth, startOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site-layout";
import { ProductImage } from "@/components/product-image";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  availableInRange,
  saveBookingGroup,
  toKey,
  toWibDateTime,
  useBookings,
  getTerlarisGlobal,
  getRentalCountMap,
} from "@/data/bookings";

import { formatIDR, useCatalog, type ProductComponent } from "@/data/products";
import { useMaintenance } from "@/data/maintenance";
import { cn } from "@/lib/utils";
import { waOrderLink } from "@/lib/whatsapp";

type BookingSearch = {
  produk?: string | undefined;
};

const only24HourCharacters = (value: string) => value.replace(/[^\d:]/g, "").slice(0, 5);

export const Route = createFileRoute("/booking")({
  validateSearch: (search: Record<string, unknown>): BookingSearch => ({
    produk: typeof search["produk"] === "string" ? search["produk"] : undefined,
  }),

  component: Booking,
});

/* =========================================================
   SCROLL DATE PICKER
========================================================= */

function ScrollDatePicker({
  date,
  onChange,
  minDate,
}: {
  date: Date | undefined;
  onChange: (d: Date) => void;
  minDate?: Date;
}) {
  const initialDate = date ?? minDate ?? new Date();

  const [day, setDay] = useState(initialDate.getDate());

  const [month, setMonth] = useState(initialDate.getMonth());

  const [year, setYear] = useState(initialDate.getFullYear());

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const currentYear = new Date().getFullYear();

  const years = Array.from({ length: 7 }, (_, i) => currentYear + i);

  const maxDay = getDaysInMonth(new Date(year, month));

  useEffect(() => {
    const safeDay = Math.min(day, maxDay);

    const next = startOfDay(new Date(year, month, safeDay));

    if (minDate && next < startOfDay(minDate)) {
      onChange(startOfDay(minDate));
      return;
    }

    onChange(next);
  }, [day, month, year, maxDay, minDate, onChange]);

  useEffect(() => {
    if (!date) return;

    setDay(date.getDate());

    setMonth(date.getMonth());

    setYear(date.getFullYear());
  }, [date]);

  return (
    <div className="grid grid-cols-3 gap-3 py-4">
      <div>
        <Label className="text-xs">Tanggal</Label>

        <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
          <SelectTrigger className="mt-1 h-12 rounded-xl text-base">
            <SelectValue />
          </SelectTrigger>

          <SelectContent className="max-h-60">
            {Array.from(
              {
                length: maxDay,
              },
              (_, i) => i + 1,
            ).map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Bulan</Label>

        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="mt-1 h-12 rounded-xl text-base">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {months.map((m, i) => (
              <SelectItem key={m} value={String(i)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Tahun</Label>

        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="mt-1 h-12 rounded-xl text-base">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* =========================================================
   BOOKING PAGE
========================================================= */

function Booking() {
  const { produk } = Route.useSearch();

  const { bookings, refresh } = useBookings();

  const { products } = useCatalog();

  const { maintenance } = useMaintenance();

  const navigate = useNavigate();

  /* =======================================================
     ITEMS
  ======================================================== */

  const [items, setItems] = useState<
    {
      productId: string;
      qty: number;
      components: ProductComponent[];
      activeCategory: "Semua" | (typeof products)[number]["category"];
    }[]
  >([]);

  /* =======================================================
     RANKING
  ======================================================== */

  const countMap = useMemo(() => getRentalCountMap(bookings), [bookings]);

  const terlaris = useMemo(() => getTerlarisGlobal(bookings, 6), [bookings]);

  /* =======================================================
     PRODUCT FILTER
  ======================================================== */

  const getVisibleProducts = (category: "Semua" | (typeof products)[number]["category"]) => {
    const activeProducts = products.filter((p) => p.active);
    const base =
      category === "Semua" ? activeProducts : activeProducts.filter((p) => p.category === category);

    return [...base].sort((a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0));
  };

  /* =======================================================
     CHANGE CATEGORY
  ======================================================== */

  const setItemCategory = (
    index: number,
    category: "Semua" | (typeof products)[number]["category"],
  ) => {
    setItems((prev) => {
      const updated = [...prev];

      const currentItem = updated[index];

      if (!currentItem) {
        return prev;
      }

      const visible = getVisibleProducts(category);

      const isStillVisible = visible.some((p) => p.id === currentItem.productId);

      const fallbackId = visible[0]?.id ?? products[0]?.id ?? currentItem.productId;
      const nextProduct = products.find((product) => product.id === (isStillVisible ? currentItem.productId : fallbackId));

      updated[index] = {
        ...currentItem,

        activeCategory: category,

        productId: isStillVisible ? currentItem.productId : fallbackId,

        components: nextProduct?.components ?? [],
      };

      return updated;
    });
  };

  /* =======================================================
     DEFAULT ITEM
  ======================================================== */

  useEffect(() => {
    if (!products.length) {
      return;
    }

    if (items.length) {
      return;
    }

    const mostLarisId =
      produk ?? terlaris[0]?.id ?? getVisibleProducts("Kostum")[0]?.id ?? products[0]!.id;

    setItems([
      {
        productId: mostLarisId,

        qty: 1,

        components: products.find((product) => product.id === mostLarisId)?.components ?? [],

        activeCategory: "Kostum",
      },
    ]);
  }, [products, produk, terlaris]);

  /* =======================================================
     DATE
  ======================================================== */

  const todayOnly = useMemo(() => startOfDay(new Date()), []);

  const [start, setStart] = useState<Date | undefined>(todayOnly);

  const [end, setEnd] = useState<Date | undefined>(addDays(todayOnly, 1));

  const [pickupTime, setPickupTime] = useState("16:00");
  const [performanceDate, setPerformanceDate] = useState(toKey(todayOnly));
  const [performanceTime, setPerformanceTime] = useState("19:00");
  const [returnTime, setReturnTime] = useState("13:00");

  useEffect(() => {
    if (!start) return;
    const min = toKey(start);
    const max = end ? toKey(end) : min;
    setPerformanceDate((current) => current < min || current > max ? min : current || min);
  }, [start, end]);

  /* =======================================================
     CUSTOMER
  ======================================================== */

  const [nama, setNama] = useState("");

  const [wa, setWa] = useState("");

  const [deskripsi, setDeskripsi] = useState("");

  /* =======================================================
     DIALOG
  ======================================================== */

  const [zoom, setZoom] = useState<{
    src: string;
    name: string;
  } | null>(null);

  const [openStart, setOpenStart] = useState(false);

  const [openEnd, setOpenEnd] = useState(false);

  const [pickerModeStart, setPickerModeStart] = useState<"kalender" | "scroll">("kalender");

  const [pickerModeEnd, setPickerModeEnd] = useState<"kalender" | "scroll">("kalender");

  /* =======================================================
     RENTAL DAYS
  ======================================================== */

  const days = useMemo(() => {
    if (!start || !end) {
      return 1;
    }

    return Math.max(differenceInCalendarDays(end, start), 1);
  }, [start, end]);

  /* =======================================================
     ROWS
  ======================================================== */

  const rows = useMemo(() => {
    return items.map((item) => {
      const product = products.find((p) => p.id === item.productId) ?? products[0]!;
      const components = item.components.length ? item.components : product.components;
      const componentProducts = components
        .map((component) => products.find((candidate) => candidate.id === component.productId))
        .filter((component): component is NonNullable<typeof component> => Boolean(component));

      const range =
        start && end
          ? product.category === "Fullset" && componentProducts.length
            ? componentProducts.reduce(
                (result, component, componentIndex) => {
                  const componentRange = availableInRange(
                    bookings,
                    component.id,
                    toKey(start),
                    toKey(end),
                    undefined,
                    maintenance,
                    {
                      pickupAt: toWibDateTime(toKey(start), pickupTime),
                      performanceAt: toWibDateTime(performanceDate, performanceTime),
                      returnAt: toWibDateTime(toKey(end), returnTime),
                    },
                  );
                  const requiredQty = components[componentIndex]?.qty ?? 1;
                  result.available = Math.min(
                    result.available,
                    Math.floor(componentRange.available / requiredQty),
                  );
                  result.conflicts.push(...componentRange.conflicts);
                  result.maintenanceConflicts.push(...(componentRange.maintenanceConflicts ?? []));
                  return result;
                },
                {
                  available: Number.MAX_SAFE_INTEGER,
                  conflicts: [] as { day: string; available: number }[],
                  maintenanceConflicts: [] as {
                    productId: string;
                    startDate: string;
                    endDate: string;
                  }[],
                },
              )
            : availableInRange(
                bookings,
                product.id,
                toKey(start),
                toKey(end),
                undefined,
                maintenance,
                {
                  pickupAt: toWibDateTime(toKey(start), pickupTime),
                  performanceAt: toWibDateTime(performanceDate, performanceTime),
                  returnAt: toWibDateTime(toKey(end), returnTime),
                },
              )
          : {
              available: product.stock,

              conflicts: [] as { day: string; available: number }[],

              maintenanceConflicts: [] as { productId: string; startDate: string; endDate: string }[],
            };

      const maintenanceConflicts = range.maintenanceConflicts ?? [];

      const maxQty = Math.max(range.available, 0);

      const qty = maxQty <= 0 ? 1 : Math.min(Math.max(item.qty, 1), maxQty);

      return {
        product,
        components,
        componentProducts,

        maxQty,

        qty,

        conflicts: range.conflicts,

        maintenanceConflicts,

        subtotal: product.price * qty * days,

        visibleProducts: getVisibleProducts(item.activeCategory),
      };
    });
  }, [
    items,
    bookings,
    start,
    end,
    days,
    products,
    countMap,
    maintenance,
    pickupTime,
    performanceDate,
    performanceTime,
    returnTime,
  ]);

  /* =======================================================
     TOTAL
  ======================================================== */

  const total = rows.reduce((sum, row) => sum + row.subtotal, 0);

  const anyFull = rows.some((row) => row.maxQty === 0);

  const anyMaintenance = rows.some((row) => row.maintenanceConflicts.length > 0);

  const scheduleValues =
    start && end
      ? {
          pickupAt: toWibDateTime(toKey(start), pickupTime),
          performanceAt: toWibDateTime(performanceDate, performanceTime),
          returnAt: toWibDateTime(toKey(end), returnTime),
        }
      : null;

  const scheduleValid = Boolean(
    scheduleValues &&
    new Date(scheduleValues.pickupAt) < new Date(scheduleValues.performanceAt) &&
    new Date(scheduleValues.performanceAt) < new Date(scheduleValues.returnAt),
  );

  const canBook =
    rows.length > 0 &&
    !anyFull &&
    !anyMaintenance &&
    Boolean(start && end) &&
    scheduleValid &&
    nama.trim().length > 1;

  /* =======================================================
     AVAILABLE PRODUCT TO ADD
  ======================================================== */

  const availableToAdd = (index: number) =>
    getVisibleProducts(items[index]?.activeCategory ?? "Kostum").filter(
      (p) => !items.some((x) => x.productId === p.id),
    );

  /* =======================================================
     UPDATE ITEM
  ======================================================== */

  const setItem = (
    index: number,
    patch: Partial<{
      productId: string;
      qty: number;
      components: ProductComponent[];
    }>,
  ) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const setItemProduct = (index: number, productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    setItem(index, { productId, qty: 1, components: product?.components ?? [] });
  };

  const setItemComponents = (index: number, components: ProductComponent[]) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, components } : item)),
    );
  };

  /* =======================================================
     REMOVE ITEM
  ======================================================== */

  const removeItem = (index: number) => {
    if (rows.length <= 1) {
      toast.error("Minimal 1 item harus ada");
      return;
    }

    setItems((prev) => prev.filter((_, i) => i !== index));

    toast.success("Item dihapus");
  };

  /* =======================================================
     FORMAT DATE
  ======================================================== */

  const fmt = (date?: Date) =>
    date
      ? format(date, "d MMMM yyyy", {
          locale: localeId,
        }).toLowerCase()
      : "Pilih tanggal";

  /* =======================================================
     HANDLE BOOKING
  ======================================================== */

  const handleBooking = async () => {
    if (!start || !end) {
      toast.error("Silakan pilih tanggal ambil dan kembali.");
      return;
    }

    if (!scheduleValues || !scheduleValid) {
      toast.error("Urutan waktu tidak valid.", {
        description:
          "Jam ambil harus sebelum jam pentas, dan jam pentas harus sebelum jam kembali.",
      });
      return;
    }

    if (!nama.trim()) {
      toast.error("Nama penyewa wajib diisi.");
      return;
    }

    if (anyMaintenance) {
      toast.error("Ada koleksi yang sedang dalam masa perawatan.");
      return;
    }

    if (anyFull) {
      toast.error("Ada koleksi yang sudah penuh pada tanggal tersebut.");
      return;
    }

    try {
      const bookingItems = rows.flatMap((row) =>
        row.product.category === "Fullset" && row.components.length
          ? row.components.map((component) => ({
              productId: component.productId,
              qty: row.qty * component.qty,
            }))
          : [{ productId: row.product.id, qty: row.qty }],
      );

      const result = await saveBookingGroup(
        {
          start: toKey(start),

          end: toKey(end),

          pickupAt: scheduleValues.pickupAt,
          performanceAt: scheduleValues.performanceAt,
          returnAt: scheduleValues.returnAt,

          name: nama.trim(),

          phone: wa.trim(),

          description: deskripsi.trim(),
        },

        bookingItems,
      );

      /* =================================================
           REFRESH DATA
        ================================================== */

      await refresh();

      /* =================================================
           WHATSAPP
        ================================================== */

      const whatsappUrl = waOrderLink({
        code: result.code,

        items: rows.map((row) => ({
          productName: row.product.name,

          qty: row.qty,

          unit: row.product.unit,

          subtotal: formatIDR(row.subtotal),
        })),

        start: toKey(start),

        end: toKey(end),

        pickupAt: scheduleValues.pickupAt,
        performanceAt: scheduleValues.performanceAt,
        returnAt: scheduleValues.returnAt,

        days,

        total: formatIDR(total),

        name: nama.trim(),

        phone: wa.trim(),

        description: deskripsi.trim(),
      });

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      /* =================================================
           KE HALAMAN KONFIRMASI
           
           Kode booking digunakan untuk mengambil
           detail booking + status DP/QRIS.
        ================================================== */

      await navigate({
        to: "/konfirmasi",

        search: {
          kode: result.code,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Booking gagal disimpan.");
    }
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* =================================================
              1. TANGGAL
          ================================================== */}

          <div className="surface-card rounded-2xl border p-6 sm:p-8">
            <h2 className="text-2xl font-bold">1. Tanggal Ambil & Kembali</h2>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-base text-muted-foreground">Tanggal ambil</p>

                <button
                  type="button"
                  onClick={() => setOpenStart(true)}
                  className="mt-2 w-full rounded-xl border border-input bg-white px-4 py-3 text-left text-base font-normal text-muted-foreground transition hover:bg-accent"
                >
                  {fmt(start)}
                </button>
              </div>

              <div>
                <p className="text-base text-muted-foreground">Tanggal kembali</p>

                <button
                  type="button"
                  onClick={() => setOpenEnd(true)}
                  className="mt-2 w-full rounded-xl border border-input bg-white px-4 py-3 text-left text-base font-normal text-muted-foreground transition hover:bg-accent"
                >
                  {fmt(end)}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="performance-date">Tanggal pentas</Label>
              <Input
                id="performance-date"
                type="date"
                min={toKey(start ?? todayOnly)}
                max={toKey(end ?? todayOnly)}
                value={performanceDate}
                onChange={(e) => setPerformanceDate(e.target.value)}
                className="mt-2 h-12 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="performance-time">Jam pentas </Label>
              <Input
                id="performance-time"
                type="text"
                inputMode="numeric"
                maxLength={5}
                pattern="[0-2][0-9]:[0-5][0-9]"
                placeholder="HH:mm"
                value={performanceTime}
                onChange={(e) => setPerformanceTime(only24HourCharacters(e.target.value))}
                className="mt-2 h-12 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="pickup-time">Jam ambil </Label>
              <Input
                id="pickup-time"
                type="text"
                inputMode="numeric"
                maxLength={5}
                pattern="[0-2][0-9]:[0-5][0-9]"
                placeholder="HH:mm"
                value={pickupTime}
                onChange={(e) => setPickupTime(only24HourCharacters(e.target.value))}
                className="mt-2 h-12 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="return-time">Jam kembali </Label>
              <Input
                id="return-time"
                type="text"
                inputMode="numeric"
                maxLength={5}
                pattern="[0-2][0-9]:[0-5][0-9]"
                placeholder="HH:mm"
                value={returnTime}
                onChange={(e) => setReturnTime(only24HourCharacters(e.target.value))}
                className="mt-2 h-12 rounded-xl"
              />
            </div>
          </div>

          {!scheduleValid && start && end ? (
            <p className="mt-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">
              Urutan waktu belum valid. Gunakan format 24 jam: ambil → pentas → kembali.
            </p>
          ) : null}

          {/* =================================================
              2. PILIH KOLEKSI
          ================================================== */}

          <div className="surface-card p-5 sm:p-8">
            <h2 className="text-4xl font-black">2. Pilih Koleksi</h2>

            <p className="mt-3 text-base text-muted-foreground">
              Satu nota bisa berisi beberapa item.
            </p>

            <div className="mt-5 space-y-4">
              {rows.map((row, index) => {
                const cats = [
                  "Fullset",
                  "Kostum",
                  "Kuluk Lancur",
                  "Kuluk Mentok",
                  "Klinting",
                  "Aksesoris",
                ] as const;

                return (
                  <div
                    key={`${row.product.id}-${index}`}
                    className="space-y-4 rounded-2xl border bg-white p-5"
                  >
                    {/* CATEGORY */}

                    <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
                      {cats.map((cat) => (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => setItemCategory(index, cat)}
                          className={cn(
                            "shrink-0 rounded-full border px-3 py-2 text-sm",

                            items[index]?.activeCategory === cat
                              ? "border-[#E8488A] bg-[#E8488A] text-white"
                              : "border-gray-200 bg-gray-100",
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* PRODUCT */}

                    <div className="grid grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setZoom({
                            src: row.product.image,

                            name: row.product.name,
                          })
                        }
                        className="relative aspect-square w-full overflow-hidden"
                      >
                        <ProductImage
                          src={row.product.image}
                          alt={row.product.name}
                          className="h-full w-full"
                          imgClassName="object-cover"
                        />
                      </button>

                      <div className="space-y-4 p-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Koleksi</p>

                          <Select
                            value={row.product.id}
                            onValueChange={(value) =>
                              setItemProduct(index, value)
                            }
                          >
                            <SelectTrigger className="mt-1 h-auto w-full rounded-xl bg-white">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              {row.visibleProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} · {product.category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {row.product.category === "Fullset" ? (
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <p className="text-sm font-semibold">Rincian Fullset</p>
                            <div className="mt-2 space-y-2">
                              {row.components.map((component, componentIndex) => {
                                const componentProduct = row.componentProducts[componentIndex];
                                return (
                                  <div key={`${component.productId}-${componentIndex}`} className="flex gap-2">
                                    <Select
                                      value={component.productId}
                                      onValueChange={(value) =>
                                        setItemComponents(
                                          index,
                                          row.components.map((item, itemIndex) =>
                                            itemIndex === componentIndex
                                              ? { ...item, productId: value }
                                              : item,
                                          ),
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg bg-white text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {products
                                          .filter((candidate) => candidate.category !== "Fullset")
                                          .map((candidate) => (
                                            <SelectItem key={candidate.id} value={candidate.id}>
                                              {candidate.name} · {candidate.category}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <span className="flex items-center text-xs text-muted-foreground">
                                      x{component.qty}
                                    </span>
                                    <button
                                      type="button"
                                      className="px-2 text-xs font-semibold text-destructive"
                                      onClick={() =>
                                        setItemComponents(
                                          index,
                                          row.components.filter((_, itemIndex) => itemIndex !== componentIndex),
                                        )
                                      }
                                    >
                                      Hapus
                                    </button>
                                    <span className="sr-only">{componentProduct?.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              className="mt-3 text-sm font-semibold text-primary"
                              onClick={() => {
                                const first = products.find((candidate) => candidate.category !== "Fullset");
                                if (first) {
                                  setItemComponents(index, [
                                    ...row.components,
                                    { productId: first.id, qty: 1 },
                                  ]);
                                }
                              }}
                            >
                              + Tambah komponen
                            </button>
                          </div>
                        ) : null}

                        {/* STATUS */}

                        <div className="flex flex-col gap-2">
                          <StatusBadge
                            status={
                              row.maintenanceConflicts.length
                                ? "Habis"
                                : row.maxQty === 0
                                  ? "Habis"
                                  : row.maxQty <= 2
                                    ? "Terbatas"
                                    : "Tersedia"
                            }
                            className="w-fit rounded-full bg-green-100 px-4 py-2 font-black tracking-wide text-green-700"
                          />

                          {row.maintenanceConflicts.length ? (
                            <p className="text-sm font-semibold text-red-600">
                              Sedang dalam masa perawatan:{" "}
                              {row.maintenanceConflicts
                                .map((m) => `${m.startDate} → ${m.endDate}`)
                                .join(", ")}
                            </p>
                          ) : null}

                          <div className="flex items-center gap-6 pt-1">
                            <p className="font-bold text-foreground">
                              Keluar:{" "}
                              <span className="font-black text-red-600">
                                {Math.max(row.product.stock - row.maxQty, 0)} {row.product.unit}
                              </span>
                            </p>

                            <p className="font-bold text-foreground">
                              Sisa:{" "}
                              <span className="font-black text-green-600">
                                {row.maxQty} {row.product.unit}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* QTY */}

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-full"
                            onClick={() =>
                              setItem(index, {
                                qty: Math.max(1, row.qty - 1),
                              })
                            }
                            disabled={row.qty <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>

                          <Input
                            type="number"
                            inputMode="numeric"
                            value={row.maxQty === 0 ? 0 : row.qty}
                            onChange={(event) => {
                              const raw = event.target.value;

                              if (raw === "") {
                                setItem(index, {
                                  qty: 1,
                                });
                                return;
                              }

                              const value = Number(raw);

                              if (Number.isNaN(value)) {
                                return;
                              }

                              if (row.maxQty <= 0) {
                                return;
                              }

                              const clamped = Math.min(Math.max(Math.floor(value), 1), row.maxQty);

                              setItem(index, {
                                qty: clamped,
                              });
                            }}
                            onFocus={(event) => event.target.select()}
                            className="h-10 w-20 rounded-full border-2 text-center font-black focus-visible:ring-0"
                            min={1}
                            max={row.maxQty}
                            disabled={row.maxQty <= 0}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-full"
                            onClick={() =>
                              setItem(index, {
                                qty: Math.min(row.maxQty, row.qty + 1),
                              })
                            }
                            disabled={row.qty >= row.maxQty || row.maxQty <= 0}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>

                          <span className="text-sm text-gray-500">
                            maks. {row.maxQty} · {formatIDR(row.subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ITEM BUTTONS */}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 flex-1 rounded-xl bg-white"
                        disabled={availableToAdd(index).length === 0}
                        onClick={() => {
                          const next = availableToAdd(index)[0];

                          if (!next) {
                            return;
                          }

                          setItems((previous) => [
                            ...previous,

                            {
                              productId: next.id,

                              qty: 1,

                              activeCategory: items[index]?.activeCategory ?? "Kostum",
                            },
                          ]);
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Tambah Item
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl border-red-200 px-5 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => removeItem(index)}
                        disabled={rows.length <= 1}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =================================================
              3. DATA PENYEWA
          ================================================== */}

          <div className="surface-card rounded-2xl border p-6 sm:p-8">
            <h2 className="text-2xl font-bold">3. Data Penyewa</h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Nama</Label>

                <Input
                  value={nama}
                  onChange={(event) => setNama(event.target.value)}
                  className="mt-1 rounded-xl"
                  placeholder="Nama penyewa"
                />
              </div>

              <div>
                <Label>WA</Label>

                <Input
                  value={wa}
                  onChange={(event) => setWa(event.target.value)}
                  className="mt-1 rounded-xl"
                  placeholder="Nomor WhatsApp"
                  inputMode="tel"
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Deskripsi</Label>

                <Input
                  value={deskripsi}
                  onChange={(event) => setDeskripsi(event.target.value)}
                  className="mt-1 rounded-xl"
                  placeholder="Contoh: acara pernikahan, pentas seni, foto, dll."
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================
            RINGKASAN BOOKING
        ==================================================== */}

        <aside className="mt-6 lg:sticky lg:top-28">
          <div className="surface-card rounded-2xl border p-6">
            <h2 className="text-xl font-bold">Ringkasan Booking</h2>

            <div className="mt-5 space-y-4">
              {rows.map((row, index) => (
                <div key={`${row.product.id}-${index}`} className="flex gap-4">
                  <ProductImage
                    src={row.product.image}
                    alt={row.product.name}
                    className="h-20 w-16 rounded-xl"
                  />

                  <div className="flex-1">
                    <p className="truncate font-medium">{row.product.name}</p>

                    <p className="text-xs text-primary">{row.product.category}</p>

                    <p className="text-sm text-muted-foreground">
                      {row.qty} {row.product.unit} × {formatIDR(row.product.price)}
                    </p>
                  </div>

                  <p className="text-sm font-medium">{formatIDR(row.subtotal)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-between border-t pt-5">
              <span>Total</span>

              <span className="text-2xl text-primary">{formatIDR(total)}</span>
            </div>

            <Button
              type="button"
              size="lg"
              className="mt-6 w-full rounded-full"
              disabled={!canBook}
              onClick={() => void handleBooking()}
            >
              {anyMaintenance
                ? "Koleksi Dalam Perawatan"
                : anyFull
                  ? "Tanggal Penuh"
                  : "Konfirmasi Booking"}
            </Button>
          </div>
        </aside>
      </div>

      {/* =====================================================
          DIALOG TANGGAL AMBIL
      ====================================================== */}

      <Dialog open={openStart} onOpenChange={setOpenStart}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Tanggal Ambil</DialogTitle>
          </DialogHeader>

          <div className="flex w-fit gap-2 rounded-full bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setPickerModeStart("kalender")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium",
                pickerModeStart === "kalender" ? "bg-white shadow" : "",
              )}
            >
              Kalender
            </button>

            <button
              type="button"
              onClick={() => setPickerModeStart("scroll")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium",
                pickerModeStart === "scroll" ? "bg-white shadow" : "",
              )}
            >
              Scroll
            </button>
          </div>

          {pickerModeStart === "kalender" ? (
            <Calendar
              mode="single"
              selected={start}
              onSelect={(date) => {
                if (!date) {
                  return;
                }

                const safe = startOfDay(date);

                if (safe < todayOnly) {
                  toast.error("Tanggal ambil tidak boleh sebelum hari ini.");
                  return;
                }

                setStart(safe);

                if (end && end < safe) {
                  setEnd(safe);
                }
                setPerformanceDate(toKey(safe));

                setOpenStart(false);
              }}
              locale={localeId}
              disabled={{
                before: todayOnly,
              }}
              className="mx-auto"
            />
          ) : (
            <ScrollDatePicker
              date={start}
              minDate={todayOnly}
              onChange={(date) => {
                const safe = startOfDay(date);

                setStart(safe);

                if (end && end < safe) {
                  setEnd(safe);
                }
                setPerformanceDate(toKey(safe));
              }}
            />
          )}

          <Button
            type="button"
            className="mt-2 w-full rounded-xl"
            onClick={() => setOpenStart(false)}
          >
            Pilih
          </Button>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          DIALOG TANGGAL KEMBALI
      ====================================================== */}

      <Dialog open={openEnd} onOpenChange={setOpenEnd}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Tanggal Kembali</DialogTitle>
          </DialogHeader>

          <div className="flex w-fit gap-2 rounded-full bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setPickerModeEnd("kalender")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium",
                pickerModeEnd === "kalender" ? "bg-white shadow" : "",
              )}
            >
              Kalender
            </button>

            <button
              type="button"
              onClick={() => setPickerModeEnd("scroll")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium",
                pickerModeEnd === "scroll" ? "bg-white shadow" : "",
              )}
            >
              Scroll
            </button>
          </div>

          {pickerModeEnd === "kalender" ? (
            <Calendar
              mode="single"
              selected={end}
              onSelect={(date) => {
                if (!date) {
                  return;
                }

                const safe = startOfDay(date);

                if (start && safe < startOfDay(start)) {
                  toast.error("Tanggal kembali tidak boleh sebelum tanggal ambil.");
                  return;
                }

                setEnd(safe);

                setOpenEnd(false);
              }}
              locale={localeId}
              disabled={
                start
                  ? { before: start }
                  : { before: todayOnly }
              }
              className="mx-auto"
            />
          ) : (
            <ScrollDatePicker
              date={end}
              minDate={start ?? todayOnly}
              onChange={(date) => {
                const minimum = start ?? todayOnly;

                const safe = startOfDay(date);

                if (safe < startOfDay(minimum)) {
                  setEnd(startOfDay(minimum));
                  return;
                }

                setEnd(safe);
              }}
            />
          )}

          <Button
            type="button"
            className="mt-2 w-full rounded-xl"
            onClick={() => setOpenEnd(false)}
          >
            Pilih
          </Button>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          ZOOM GAMBAR
      ====================================================== */}

      <Dialog
        open={Boolean(zoom)}
        onOpenChange={(open) => {
          if (!open) {
            setZoom(null);
          }
        }}
      >
        <DialogContent className="max-w-lg overflow-hidden p-0">
          {zoom ? (
            <ProductImage
              src={zoom.src}
              alt={zoom.name}
              className="min-h-80 w-full"
              imgClassName="h-auto w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}
