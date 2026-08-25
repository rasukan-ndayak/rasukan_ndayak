import {
  CalendarRange,
  Camera,
  FolderPlus,
  ImageUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { optimizeImage } from "@/lib/image-upload";
import { useMaintenance } from "@/data/maintenance";
import { uploadToCloudinary } from "@/lib/cloudinary";

import {
  addProductRemote,
  categories,
  defaultImages,
  formatIDR,
  removeProductRemote,
  statusOf,
  updateProductRemote,
  type Category,
  type Product,
} from "@/data/products";

type Draft = {
  name: string;
  category: Category;
  unit: "pcs" | "stell";
  price: string;
  stock: string;
  image: string;
  description: string;
  details: string;
};

type BulkDraft = {
  file: File;
  preview: string;
  name: string;
  price: string;
  stock: string;
  description: string;
};

const emptyDraft = (category: Category = "Kostum"): Draft => ({
  name: "",
  category,
  unit: "pcs",
  price: "",
  stock: "",
  image: defaultImages[0] ?? "",
  description: "",
  details: "",
});

const toDraft = (p: Product): Draft => ({
  name: p.name,
  category: p.category,
  unit: p.unit,
  price: String(p.price),
  stock: String(p.stock),
  image: p.image,
  description: p.description,
  details: p.details.join("\n"),
});

export function AdminProducts({
  products,
  refresh,
}: {
  products: Product[];
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [activeCat, setActiveCat] = useState<Category>(
    categories[0]!,
  );

  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft(categories[0]!),
  );

  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);

  const [cameraLoading, setCameraLoading] = useState(false);

  const {
    maintenance,
    add: addMaintenance,
    remove: removeMaintenance,
  } = useMaintenance();

  const [maintenanceProduct, setMaintenanceProduct] =
    useState<Product | null>(null);

  const [maintenanceStart, setMaintenanceStart] = useState("");
  const [maintenanceEnd, setMaintenanceEnd] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [bulkDrafts, setBulkDrafts] = useState<BulkDraft[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const rowFileRef = useRef<HTMLInputElement>(null);

  const rowTargetRef = useRef<Product | null>(null);

  /**
   * ============================
   * UPLOAD FILE FORM PRODUK
   * ============================
   */
  const handleDraftFile = async (
    file: File | undefined,
  ) => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const optimized = await optimizeImage(file);
      const image = await uploadToCloudinary(optimized);

      setDraft((current) => ({
        ...current,
        image,
      }));

      toast.success("Foto berhasil diunggah.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memproses gambar.";

      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  /**
   * ============================
   * UPLOAD FILE BARIS PRODUK
   * ============================
   */
  const handleRowFile = async (
    file: File | undefined,
  ) => {
    const target = rowTargetRef.current;

    if (!file || !target) return;

    try {
      const optimized = await optimizeImage(file);
      const image = await uploadToCloudinary(optimized);

      await updateProductRemote(target.id, {
        image,
      });

      refresh();

      toast.success(`Foto ${target.name} diperbarui.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memproses gambar.",
      );
    } finally {
      rowTargetRef.current = null;
    }
  };

  /**
   * ============================
   * TAMBAH PRODUK
   * ============================
   */
  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft(activeCat));
    setError(null);
    setOpen(true);
  };

  /**
   * ============================
   * EDIT PRODUK
   * ============================
   */
  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setDraft(toDraft(product));
    setError(null);
    setOpen(true);
  };

  /**
   * ============================
   * MAINTENANCE
   * ============================
   */
  const openMaintenance = (product: Product) => {
    setMaintenanceProduct(product);
    setMaintenanceStart("");
    setMaintenanceEnd("");
    setMaintenanceNote("");
  };

  const submitMaintenance = async () => {
    if (!maintenanceProduct) return;

    if (!maintenanceStart || !maintenanceEnd) {
      toast.error(
        "Tanggal mulai dan tanggal selesai wajib diisi.",
      );
      return;
    }

    if (maintenanceEnd < maintenanceStart) {
      toast.error(
        "Tanggal selesai tidak boleh sebelum tanggal mulai.",
      );
      return;
    }

    setMaintenanceSaving(true);

    try {
      await addMaintenance({
        productId: maintenanceProduct.id,
        startDate: maintenanceStart,
        endDate: maintenanceEnd,
        note: maintenanceNote.trim(),
      });

      toast.success(
        `${maintenanceProduct.name} ditandai dalam masa perawatan.`,
      );

      setMaintenanceStart("");
      setMaintenanceEnd("");
      setMaintenanceNote("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan jadwal perawatan.",
      );
    } finally {
      setMaintenanceSaving(false);
    }
  };

  /**
   * ============================
   * BULK / FOLDER
   * ============================
   */
  const handleBulkFiles = (
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) return;

    const selected = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (!selected.length) {
      toast.error(
        "Folder tidak berisi file gambar yang didukung.",
      );
      return;
    }

    setBulkDrafts(
      selected.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim(),
        price: "",
        stock: "",
        description: "",
      })),
    );

    setBulkOpen(true);
  };

  const submitBulk = async () => {
    if (!bulkDrafts.length) return;

    setBulkLoading(true);

    try {
      let added = 0;

      for (const item of bulkDrafts) {
        const name = item.name.trim();
        const price = Number(item.price);
        const stock = Number(item.stock);

        if (
          name.length < 2 ||
          !Number.isFinite(price) ||
          price < 0 ||
          !Number.isInteger(stock) ||
          stock < 0
        ) {
          toast.error(
            `Lengkapi nama, harga, dan stok untuk ${item.file.name}.`,
          );
          continue;
        }

        const optimized = await optimizeImage(item.file);
        const image = await uploadToCloudinary(optimized);

        await addProductRemote({
          name,
          category: activeCat,
          unit:
            activeCat === "Kostum"
              ? "stell"
              : "pcs",
          price,
          stock,
          image,
          description: item.description
            .trim()
            .slice(0, 600),
          details: [],
          id: "",
        });

        added += 1;
      }

      if (added) {
        toast.success(
          `${added} produk berhasil ditambahkan ke kategori ${activeCat}.`,
        );

        setBulkDrafts([]);
        setBulkOpen(false);
        refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menambahkan produk dari folder.",
      );
    } finally {
      setBulkLoading(false);
    }
  };

  /**
   * ============================
   * SIMPAN PRODUK
   * ============================
   */
  const submit = async () => {
    const name = draft.name.trim();
    const price = Number(draft.price);
    const stock = Number(draft.stock);

    if (name.length < 2 || name.length > 80) {
      setError(
        "Nama produk wajib diisi (2â€“80 karakter).",
      );
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      price > 100_000_000
    ) {
      setError(
        "Harga sewa harus angka yang wajar.",
      );
      return;
    }

    if (
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > 10_000
    ) {
      setError(
        "Stok harus bilangan bulat 0â€“10.000.",
      );
      return;
    }

    const payload = {
      name,
      category: draft.category,
      unit: draft.unit,
      price,
      stock,
      image: draft.image.trim(),
      description: draft.description
        .trim()
        .slice(0, 600),
      details: draft.details
        .split("\n")
        .map((detail) => detail.trim())
        .filter(Boolean)
        .slice(0, 10),
    };

    try {
      if (editingId) {
        await updateProductRemote(
          editingId,
          payload as Partial<Product>,
        );

        toast.success(
          `${name} diperbarui.`,
        );
      } else {
        await addProductRemote(
          payload as Product,
        );

        toast.success(
          `${name} ditambahkan ke katalog.`,
        );
      }

      refresh();
      setOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan produk.";

      setError(message);
      toast.error(message);
    }
  };

  const visible = products.filter(
    (product) =>
      product.category === activeCat,
  );

  return (
    <div className="surface-card overflow-hidden">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg">
            Kelola Produk â€” {activeCat}
          </h2>

          <p className="text-sm text-muted-foreground">
            {visible.length} koleksi{" "}
            {activeCat.toLowerCase()} Â·{" "}
            {products.length} total di katalog
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            onClick={startCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah {activeCat}
          </Button>

          <Button
            variant="outline"
            className="rounded-full"
            disabled={bulkLoading}
            onClick={() =>
              bulkFileRef.current?.click()
            }
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Tambah Folder
          </Button>

          <input
            ref={bulkFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            {...({
              webkitdirectory: "",
              directory: "",
            } as any)}
            onChange={(event) => {
              handleBulkFiles(
                event.target.files,
              );
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {/* CATEGORY */}
      <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
        {categories.map((category) => {
          const count = products.filter(
            (product) =>
              product.category === category,
          ).length;

          return (
            <button
              key={category}
              type="button"
              onClick={() =>
                setActiveCat(category)
              }
              className={
                activeCat === category
                  ? "shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
                  : "shrink-0 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              }
            >
              {category} ({count})
            </button>
          );
        })}
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">
                Produk
              </th>

              <th className="px-5 py-3">
                Kategori
              </th>

              <th className="px-5 py-3">
                Harga
              </th>

              <th className="px-5 py-3">
                Stok
              </th>

              <th className="px-5 py-3">
                Status
              </th>

              <th className="px-5 py-3 text-right">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>
            {visible.length === 0 ? (
              <tr className="border-t border-border">
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-muted-foreground"
                >
                  Belum ada produk pada
                  kategori {activeCat}.
                </td>
              </tr>
            ) : null}

            {visible.map((product) => (
              <tr
                key={product.id}
                className="border-t border-border"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      className="h-10 w-10 shrink-0 rounded-lg"
                    />

                    <span className="font-medium">
                      {product.name}
                    </span>
                  </div>
                </td>

                <td className="px-5 py-3 text-muted-foreground">
                  {product.category}
                </td>

                <td className="px-5 py-3">
                  {formatIDR(product.price)} /{" "}
                  {product.unit}
                </td>

                <td className="px-5 py-3">
                  {product.stock}{" "}
                  {product.unit}
                </td>

                <td className="px-5 py-3">
                  <StatusBadge
                    status={statusOf(
                      product.stock,
                    )}
                  />
                </td>

                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">

                    {/* FILE / GALERI */}
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      aria-label={`Pilih foto ${product.name}`}
                      onClick={() => {
                        rowTargetRef.current =
                          product;
                        rowFileRef.current?.click();
                      }}
                    >
                      <ImageUp className="h-4 w-4" />
                    </Button>

                    {/* MAINTENANCE */}
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      aria-label={`Atur perawatan ${product.name}`}
                      onClick={() =>
                        openMaintenance(
                          product,
                        )
                      }
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>

                    {/* EDIT */}
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      aria-label={`Ubah ${product.name}`}
                      onClick={() =>
                        startEdit(product)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    {/* DELETE */}
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full text-destructive"
                      aria-label={`Hapus ${product.name}`}
                      onClick={() => {
                        void removeProductRemote(
                          product.id,
                        )
                          .then(() => {
                            refresh();

                            toast.success(
                              `${product.name} dihapus dari katalog.`,
                            );
                          })
                          .catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Gagal menghapus produk.",
                            ),
                          );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HIDDEN ROW FILE */}
      <input
        ref={rowFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleRowFile(
            event.target.files?.[0],
          );

          event.target.value = "";
        }}
      />

      {/* ============================
          MAINTENANCE DIALOG
          ============================ */}
      <Dialog
        open={Boolean(maintenanceProduct)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setMaintenanceProduct(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Jadwal Perawatan â€”{" "}
              {maintenanceProduct?.name}
            </DialogTitle>

            <DialogDescription>
              Pada tanggal perawatan,
              koleksi ini otomatis tidak
              dapat dibooking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
              <p className="font-semibold">
                Cara kerja
              </p>

              <p className="mt-1 text-muted-foreground">
                Contoh 30â€“31: koleksi
                diblokir untuk booking pada
                periode tersebut. Sistem juga
                menolak booking di server agar
                tidak bisa ditembus dari
                halaman lain.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maintenance-start">
                  Tanggal mulai
                </Label>

                <Input
                  id="maintenance-start"
                  type="date"
                  value={maintenanceStart}
                  onChange={(event) =>
                    setMaintenanceStart(
                      event.target.value,
                    )
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance-end">
                  Tanggal selesai
                </Label>

                <Input
                  id="maintenance-end"
                  type="date"
                  min={
                    maintenanceStart ||
                    undefined
                  }
                  value={maintenanceEnd}
                  onChange={(event) =>
                    setMaintenanceEnd(
                      event.target.value,
                    )
                  }
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-note">
                Keterangan (opsional)
              </Label>

              <Textarea
                id="maintenance-note"
                rows={2}
                maxLength={200}
                placeholder="Contoh: cuci, reparasi, cek kelengkapan"
                value={maintenanceNote}
                onChange={(event) =>
                  setMaintenanceNote(
                    event.target.value,
                  )
                }
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />

                <p className="font-semibold">
                  Jadwal perawatan tersimpan
                </p>
              </div>

              {maintenanceProduct &&
              maintenance.filter(
                (item) =>
                  item.productId ===
                  maintenanceProduct.id,
              ).length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Belum ada jadwal
                  perawatan.
                </p>
              ) : (
                <div className="space-y-2">
                  {maintenance
                    .filter(
                      (item) =>
                        item.productId ===
                        maintenanceProduct?.id,
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            {item.startDate} â†’{" "}
                            {item.endDate}
                          </p>

                          {item.note ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.note}
                            </p>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 rounded-full text-destructive"
                          onClick={() => {
                            void removeMaintenance(
                              item.id,
                            )
                              .then(() =>
                                toast.success(
                                  "Jadwal perawatan dihapus.",
                                ),
                              )
                              .catch(
                                (error) =>
                                  toast.error(
                                    error instanceof
                                      Error
                                      ? error.message
                                      : "Gagal menghapus jadwal.",
                                  ),
                              );
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setMaintenanceProduct(null)
              }
            >
              Tutup
            </Button>

            <Button
              className="rounded-full"
              disabled={maintenanceSaving}
              onClick={() =>
                void submitMaintenance()
              }
            >
              {maintenanceSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}

              Simpan Perawatan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================
          BULK FOLDER DIALOG
          ============================ */}
      <Dialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Tambah Produk dari Folder â€”{" "}
              {activeCat}
            </DialogTitle>

            <DialogDescription>
              Foto dari folder sudah dipilih.
              Lengkapi nama, harga, stok,
              dan deskripsi tiap produk
              sebelum disimpan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {bulkDrafts.map(
              (item, index) => (
                <div
                  key={`${item.file.name}-${index}`}
                  className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[80px_1fr_140px_110px]"
                >
                  <ProductImage
                    src={item.preview}
                    alt={item.file.name}
                    className="h-20 w-20 rounded-lg"
                  />

                  <div className="space-y-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {item.file.name}
                    </p>

                    <Input
                      placeholder="Nama kostum/produk"
                      value={item.name}
                      onChange={(event) =>
                        setBulkDrafts(
                          (all) =>
                            all.map(
                              (current, i) =>
                                i === index
                                  ? {
                                      ...current,
                                      name: event
                                        .target
                                        .value,
                                    }
                                  : current,
                            ),
                        )
                      }
                      className="rounded-xl"
                    />

                    <Textarea
                      placeholder="Deskripsi produk"
                      rows={2}
                      value={item.description}
                      onChange={(event) =>
                        setBulkDrafts(
                          (all) =>
                            all.map(
                              (current, i) =>
                                i === index
                                  ? {
                                      ...current,
                                      description:
                                        event.target
                                          .value,
                                    }
                                  : current,
                            ),
                        )
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <Input
                    type="number"
                    min={0}
                    placeholder="Harga"
                    value={item.price}
                    onChange={(event) =>
                      setBulkDrafts(
                        (all) =>
                          all.map(
                            (current, i) =>
                              i === index
                                ? {
                                    ...current,
                                    price: event
                                      .target
                                      .value,
                                  }
                                : current,
                          ),
                      )
                    }
                    className="rounded-xl"
                  />

                  <Input
                    type="number"
                    min={0}
                    placeholder="Jumlah"
                    value={item.stock}
                    onChange={(event) =>
                      setBulkDrafts(
                        (all) =>
                          all.map(
                            (current, i) =>
                              i === index
                                ? {
                                    ...current,
                                    stock: event
                                      .target
                                      .value,
                                  }
                                : current,
                          ),
                      )
                    }
                    className="rounded-xl"
                  />
                </div>
              ),
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setBulkOpen(false)
              }
            >
              Batal
            </Button>

            <Button
              className="rounded-full"
              disabled={bulkLoading}
              onClick={() =>
                void submitBulk()
              }
            >
              {bulkLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}

              Simpan {bulkDrafts.length}{" "}
              Produk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================
          ADD / EDIT PRODUCT DIALOG
          ============================ */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Ubah Produk"
                : "Tambah Produk"}
            </DialogTitle>

            <DialogDescription>
              Perubahan langsung tampil di
              katalog, halaman produk, dan
              booking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* NAMA */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-nama">
                Nama Produk
              </Label>

              <Input
                id="p-nama"
                maxLength={80}
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>

            {/* KATEGORI */}
            <div className="space-y-2">
              <Label>Kategori</Label>

              {editingId ? (
                <Select
                  value={draft.category}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      category:
                        value as Category,
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {categories.map(
                      (category) => (
                        <SelectItem
                          key={category}
                          value={category}
                        >
                          {category}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-9 items-center rounded-xl border border-border bg-secondary/50 px-3 text-sm">
                  {draft.category}
                </div>
              )}
            </div>

            {/* SATUAN */}
            <div className="space-y-2">
              <Label>Satuan</Label>

              <Select
                value={draft.unit}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    unit:
                      value as
                        | "pcs"
                        | "stell",
                  }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="pcs">
                    pcs
                  </SelectItem>

                  <SelectItem value="stell">
                    stell
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HARGA */}
            <div className="space-y-2">
              <Label htmlFor="p-harga">
                Harga Sewa (Rp)
              </Label>

              <Input
                id="p-harga"
                type="number"
                min={0}
                value={draft.price}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    price:
                      event.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>

            {/* STOK */}
            <div className="space-y-2">
              <Label htmlFor="p-stok">
                Stok
              </Label>

              <Input
                id="p-stok"
                type="number"
                min={0}
                value={draft.stock}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    stock:
                      event.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>

            {/* FOTO */}
            <div className="space-y-3 sm:col-span-2">
              <Label>Foto Produk</Label>

              <div className="flex flex-wrap items-center gap-3">
                <ProductImage
                  src={draft.image}
                  alt="Pratinjau foto produk"
                  className="h-20 w-20 rounded-xl ring-1 ring-border"
                />

                {/* GALERI / FILE */}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={
                    uploading ||
                    cameraLoading
                  }
                  onClick={() =>
                    fileRef.current?.click()
                  }
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="mr-2 h-4 w-4" />
                  )}

                  Pilih Foto
                </Button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleDraftFile(
                      event.target.files?.[0],
                    );

                    event.target.value = "";
                  }}
                />

                <span className="text-xs text-muted-foreground">
                  JPG/PNG/WebP, maks 6 MB
                </span>
              </div>

              <Input
                value={draft.image}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    image:
                      event.target.value,
                  }))
                }
                placeholder="URL Cloudinary akan terisi otomatis setelah upload"
                className="rounded-xl"
              />
            </div>

            {/* DESKRIPSI */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-desk">
                Deskripsi
              </Label>

              <Textarea
                id="p-desk"
                rows={3}
                maxLength={600}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>

            {/* DETAIL */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-detail">
                Detail (satu poin per baris)
              </Label>

              <Textarea
                id="p-detail"
                rows={3}
                value={draft.details}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    details:
                      event.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setOpen(false)
              }
            >
              Batal
            </Button>

            <Button
              className="rounded-full"
              disabled={
                uploading ||
                cameraLoading
              }
              onClick={() =>
                void submit()
              }
            >
              {editingId
                ? "Simpan Perubahan"
                : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}











