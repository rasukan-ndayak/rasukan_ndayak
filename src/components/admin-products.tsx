import { FolderPlus, ImageUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  const [activeCat, setActiveCat] = useState<Category>(categories[0]!);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(categories[0]!));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<Array<{ file: File; preview: string; name: string; price: string; stock: string; description: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const rowFileRef = useRef<HTMLInputElement>(null);
  const rowTargetRef = useRef<Product | null>(null);

  const handleBulkFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!selected.length) {
      toast.error("Folder tidak berisi file gambar yang didukung.");
      return;
    }
    setBulkDrafts(selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim(),
      price: "",
      stock: "",
      description: "",
    })));
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
        if (name.length < 2 || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
          toast.error(`Lengkapi nama, harga, dan stok untuk ${item.file.name}.`);
          continue;
        }
        const image = await uploadToCloudinary(await optimizeImage(item.file));
        await addProductRemote({
          name, category: activeCat, unit: activeCat === "Kostum" ? "stell" : "pcs",
          price, stock, image, description: item.description.trim().slice(0, 600), details: [], id: "",
        });
        added += 1;
      }
      if (added) {
        toast.success(`${added} produk berhasil ditambahkan ke kategori ${activeCat}.`);
        setBulkDrafts([]);
        setBulkOpen(false);
        refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambahkan produk dari folder.");
    } finally {
      setBulkLoading(false);
    }
  };


  const handleDraftFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadToCloudinary(await optimizeImage(file));
      setDraft((d) => ({ ...d, image }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses gambar.");
    } finally {
      setUploading(false);
    }
  };

  const handleRowFile = async (file: File | undefined) => {
    const target = rowTargetRef.current;
    if (!file || !target) return;
    try {
      const image = await uploadToCloudinary(await optimizeImage(file));
      await updateProductRemote(target.id, { image });
      refresh();
      toast.success(`Foto ${target.name} diperbarui`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses gambar.");
    } finally {
      rowTargetRef.current = null;
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft(activeCat));
    setError(null);
    setOpen(true);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setDraft(toDraft(p));
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    const name = draft.name.trim();
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    if (name.length < 2 || name.length > 80) {
      setError("Nama produk wajib diisi (2–80 karakter).");
      return;
    }
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) {
      setError("Harga sewa harus angka yang wajar.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 10_000) {
      setError("Stok harus bilangan bulat 0–10.000.");
      return;
    }
    const payload = {
      name,
      category: draft.category,
      unit: draft.unit,
      price,
      stock,
      image: draft.image.trim(),
      description: draft.description.trim().slice(0, 600),
      details: draft.details
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 10),
    };

    try {
      if (editingId) {
        await updateProductRemote(editingId, payload as Partial<Product>);
        toast.success(`${name} diperbarui`);
      } else {
        await addProductRemote(payload as Product);
        toast.success(`${name} ditambahkan ke katalog`);
      }
      refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan produk.");
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan produk.");
    }
  };

  const visible = products.filter((p) => p.category === activeCat);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg">Kelola Produk — {activeCat}</h2>
          <p className="text-sm text-muted-foreground">
            {visible.length} koleksi {activeCat.toLowerCase()} · {products.length} total di katalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-full" onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" /> Tambah {activeCat}
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={bulkLoading}
            onClick={() => bulkFileRef.current?.click()}
          >
            <FolderPlus className="mr-2 h-4 w-4" /> Tambah Folder
          </Button>
          <input
            ref={bulkFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => { handleBulkFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </div>




      <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
        {categories.map((c) => {
          const count = products.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCat(c)}
              className={
                activeCat === c
                  ? "shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
                  : "shrink-0 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              }
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Produk</th>
              <th className="px-5 py-3">Kategori</th>
              <th className="px-5 py-3">Harga</th>
              <th className="px-5 py-3">Stok</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Belum ada produk pada kategori {activeCat}.
                </td>
              </tr>
            ) : null}
            {visible.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImage
                      src={p.image}
                      alt={p.name}
                      className="h-10 w-10 shrink-0 rounded-lg"
                    />
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{p.category}</td>
                <td className="px-5 py-3">
                  {formatIDR(p.price)} / {p.unit}
                </td>
                <td className="px-5 py-3">
                  {p.stock} {p.unit}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={statusOf(p.stock)} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      aria-label={`Ganti foto ${p.name}`}
                      onClick={() => {
                        rowTargetRef.current = p;
                        rowFileRef.current?.click();
                      }}
                    >
                      <ImageUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      aria-label={`Ubah ${p.name}`}
                      onClick={() => startEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full text-destructive"
                      aria-label={`Hapus ${p.name}`}
                      onClick={() => {
                        void removeProductRemote(p.id)
                          .then(() => { refresh(); toast.success(`${p.name} dihapus dari katalog`); })
                          .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus produk"));
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

      <input
        ref={rowFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleRowFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tambah Produk dari Folder — {activeCat}</DialogTitle>
            <DialogDescription>
              Foto dari folder sudah dipilih. Lengkapi nama, harga, stok, dan deskripsi tiap produk sebelum disimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {bulkDrafts.map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[80px_1fr_140px_110px]">
                <ProductImage src={item.preview} alt={item.file.name} className="h-20 w-20 rounded-lg" />
                <div className="space-y-2">
                  <p className="truncate text-xs text-muted-foreground">{item.file.name}</p>
                  <Input placeholder="Nama kostum/produk" value={item.name} onChange={(e) => setBulkDrafts((all) => all.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} className="rounded-xl" />
                  <Textarea placeholder="Deskripsi produk" rows={2} value={item.description} onChange={(e) => setBulkDrafts((all) => all.map((x, i) => i === index ? { ...x, description: e.target.value } : x))} className="rounded-xl" />
                </div>
                <Input type="number" min={0} placeholder="Harga" value={item.price} onChange={(e) => setBulkDrafts((all) => all.map((x, i) => i === index ? { ...x, price: e.target.value } : x))} className="rounded-xl" />
                <Input type="number" min={0} placeholder="Jumlah" value={item.stock} onChange={(e) => setBulkDrafts((all) => all.map((x, i) => i === index ? { ...x, stock: e.target.value } : x))} className="rounded-xl" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setBulkOpen(false)}>Batal</Button>
            <Button className="rounded-full" disabled={bulkLoading} onClick={() => void submitBulk()}>
              {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan {bulkDrafts.length} Produk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ubah Produk" : "Tambah Produk"}</DialogTitle>
            <DialogDescription>
              Perubahan langsung tampil di katalog, halaman produk, dan booking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-nama">Nama Produk</Label>
              <Input
                id="p-nama"
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              {editingId ? (
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft((d) => ({ ...d, category: v as Category }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-9 items-center rounded-xl border border-border bg-secondary/50 px-3 text-sm">
                  {draft.category}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Satuan</Label>
              <Select
                value={draft.unit}
                onValueChange={(v) => setDraft((d) => ({ ...d, unit: v as "pcs" | "stell" }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="stell">stell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-harga">Harga Sewa (Rp)</Label>
              <Input
                id="p-harga"
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-stok">Stok</Label>
              <Input
                id="p-stok"
                type="number"
                min={0}
                value={draft.stock}
                onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Gambar</Label>
              <div className="flex flex-wrap items-center gap-3">
                <ProductImage
                  src={draft.image}
                  alt="Pratinjau foto produk"
                  className="h-20 w-20 rounded-xl ring-1 ring-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="mr-2 h-4 w-4" />
                  )}
                  Unggah Foto
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleDraftFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <span className="text-xs text-muted-foreground">JPG/PNG/WebP, maks 6 MB</span>
              </div>
              <Input
                value={draft.image}
                onChange={(e) => setDraft((d) => ({ ...d, image: e.target.value }))}
                placeholder="URL Cloudinary akan terisi otomatis setelah upload"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-desk">Deskripsi</Label>
              <Textarea
                id="p-desk"
                rows={3}
                maxLength={600}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-detail">Detail (satu poin per baris)</Label>
              <Textarea
                id="p-detail"
                rows={3}
                value={draft.details}
                onChange={(e) => setDraft((d) => ({ ...d, details: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button className="rounded-full" onClick={() => void submit()}>
              {editingId ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}