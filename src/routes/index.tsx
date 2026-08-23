import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck,
  ImagePlus,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProductCard } from "@/components/product-card";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { categories, useCatalog } from "@/data/products";
import { optimizeImage } from "@/lib/image-upload";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { insertRows, rpc } from "@/lib/supabase-rest";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rasukan Ndayak — Sewa Busana Adat Dayak" },
      {
        name: "description",
        content:
          "Sewa kostum tari, kuluk lancur, dan kuluk mentok. Koleksi premium, stok real-time, booking cepat.",
      },
      {
        property: "og:title",
        content: "Rasukan Ndayak — Sewa Busana Adat Dayak",
      },
      {
        property: "og:description",
        content:
          "Koleksi busana adat Dayak untuk panggung, upacara, dan dokumentasi budaya.",
      },
    ],
  }),
  component: Index,
});

const advantages = [
  {
    icon: Sparkles,
    title: "Koleksi Terawat",
    text: "Dicuci dan disetrika ulang setiap selesai sewa.",
  },
  {
    icon: CalendarCheck,
    title: "Booking Fleksibel",
    text: "Pilih tanggal pakai dan durasi sesuai acara.",
  },
  {
    icon: ShieldCheck,
    title: "Tanpa Deposit Ribet",
    text: "Cukup identitas dan konfirmasi pesanan.",
  },
  {
    icon: Truck,
    title: "Antar Dalam Kota",
    text: "Pengantaran gratis untuk pesanan tertentu.",
  },
];

type GalleryItem = {
  id: number;
  image_url: string;
  public_id: string;
  name: string;
  alamat: string;
  created_at?: string | null;
  judul_atas?: string | null;
};

type GalleryRow = {
  id: number;
  image_url?: string | null;
  public_id?: string | null;
  name?: string | null;
  alamat?: string | null;
  created_at?: string | null;
  judul_atas?: string | null;
};

function Index() {
  const { products } = useCatalog();

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryName, setGalleryName] = useState("");
  const [galleryAddress, setGalleryAddress] = useState("");
  const [galleryFile, setGalleryFile] = useState<File | null>(null);

  async function loadGallery() {
    try {
      setGalleryLoading(true);

      const rows = await rpc<GalleryRow[]>("get_gallery", {});

      const normalized: GalleryItem[] = Array.isArray(rows)
        ? rows
            .map((row) => ({
              id: Number(row.id),
              image_url: row.image_url || "",
              public_id: row.public_id || "",
              name: row.name || "",
              alamat: row.alamat || "",
              created_at: row.created_at || null,
              judul_atas: row.judul_atas || "",
            }))
            .filter((row) => row.image_url.length > 0)
        : [];

      setGallery(normalized);
    } catch (error) {
      console.error("Gagal mengambil gallery:", error);

      setGallery([]);

      toast.error(
        error instanceof Error
          ? error.message
          : "Gallery gagal dimuat.",
      );
    } finally {
      setGalleryLoading(false);
    }
  }

  useEffect(() => {
    void loadGallery();
  }, []);

  async function handleUploadGallery() {
    if (!galleryTitle.trim()) {
      toast.error("Nama sanggar / judul wajib diisi.");
      return;
    }

    if (!galleryName.trim()) {
      toast.error("Nama penyewa wajib diisi.");
      return;
    }

    if (!galleryAddress.trim()) {
      toast.error("Alamat penyewa wajib diisi.");
      return;
    }

    if (!galleryFile) {
      toast.error("Silakan pilih foto terlebih dahulu.");
      return;
    }

    if (galleryFile.size > 8 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 8 MB.");
      return;
    }

    try {
      setUploading(true);

      toast.loading("Mengupload foto...", {
        id: "gallery-upload",
      });

      const optimized = await optimizeImage(galleryFile);

      const imageUrl = await uploadToCloudinary(
        optimized,
        "rasukan-ndayak/gallery",
      );

      /*
       * Cloudinary URL dan public_id.
       *
       * Jika uploadToCloudinary hanya mengembalikan URL,
       * public_id diambil dari URL sebagai fallback.
       */
      let publicId = "";

      try {
        const url = new URL(imageUrl);

        const uploadIndex = url.pathname.indexOf("/upload/");

        if (uploadIndex !== -1) {
          let path = url.pathname.substring(
            uploadIndex + "/upload/".length,
          );

          path = path.replace(/^v\d+\//, "");

          const lastDot = path.lastIndexOf(".");

          if (lastDot > -1) {
            path = path.substring(0, lastDot);
          }

          publicId = decodeURIComponent(path);
        }
      } catch {
        publicId = "";
      }

      const inserted = await insertRows<GalleryRow>(
        "gallery_penyewa",
        {
          image_url: imageUrl,
          public_id: publicId,
          name: galleryName.trim(),
          alamat: galleryAddress.trim(),
          judul_atas: galleryTitle.trim(),
        },
      );

      if (!inserted) {
        throw new Error("Data gallery gagal disimpan.");
      }

      toast.success("Foto berhasil ditambahkan.", {
        id: "gallery-upload",
      });

      setGalleryTitle("");
      setGalleryName("");
      setGalleryAddress("");
      setGalleryFile(null);
      setUploadOpen(false);

      await loadGallery();
    } catch (error) {
      console.error("Upload gallery gagal:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Upload gallery gagal.",
        {
          id: "gallery-upload",
        },
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteGallery(item: GalleryItem) {
    const confirmed = window.confirm(
      `Hapus foto gallery "${item.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      toast.loading("Menghapus foto...", {
        id: `gallery-delete-${item.id}`,
      });

      await rpc("delete_gallery", {
        p_id: item.id,
      });

      toast.success("Foto berhasil dihapus.", {
        id: `gallery-delete-${item.id}`,
      });

      await loadGallery();
    } catch (error) {
      console.error("Hapus gallery gagal:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Foto gagal dihapus.",
        {
          id: `gallery-delete-${item.id}`,
        },
      );
    }
  }

  return (
    <SiteLayout>
      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div className="animate-rise">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              SEWA KOSTUM NDAYAKAN
            </p>

            <h1 className="mt-5 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              Rasukan Ndayak
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Dalam setiap tarian tersimpan filosofi kehidupan.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link to="/katalog">Lihat Katalog</Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full px-7"
              >
                <Link to="/booking">Booking Sekarang</Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-full px-7"
              >
                <Link to="/jadwal">Cek Jadwal</Link>
              </Button>
            </div>

            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
              <div>
                <dt className="font-display text-2xl text-primary">
                  {products.length}
                </dt>

                <dd className="text-xs uppercase tracking-widest text-muted-foreground">
                  Koleksi
                </dd>
              </div>

              <div>
                <dt className="font-display text-2xl text-primary">
                  {products.reduce((s, p) => s + p.stock, 0)}
                </dt>

                <dd className="text-xs uppercase tracking-widest text-muted-foreground">
                  Unit siap
                </dd>
              </div>

              <div>
                <dt className="font-display text-2xl text-primary">
                  <a
                    href="https://www.google.com/maps/place/Cinze+art_production/@-7.6148053,110.2531306,17z"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Lihat lokasi di Google Maps"
                    className="inline-flex items-center justify-center rounded-full bg-primary-soft p-2 text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    <MapPin className="h-6 w-6" />
                  </a>
                </dt>

                <dd className="text-xs uppercase tracking-widest text-muted-foreground">
                  Magelang
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative animate-rise">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-primary-soft blur-2xl" />

            <img
              src="/header.png"
              alt="Header Rasukan Ndayak - Kostum adat Dayak"
              className="mx-auto w-full max-w-lg rounded-[2.5rem] object-contain"
            />
          </div>
        </div>
      </section>

      {/* =========================================================
          GALLERY PENYEWA
      ========================================================= */}
      <section className="mx-auto max-w-7xl px-5 pt-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              GALLERY PENYEWA
            </p>

            <h2 className="mt-2 text-3xl sm:text-4xl">
              Gallery Penyewa
            </h2>

            <p className="mt-2 text-muted-foreground">
              Dokumentasi penyewa setelah menggunakan koleksi Rasukan Ndayak.
            </p>
          </div>

          <Button
            type="button"
            className="rounded-full"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>

        {/* =======================================================
            UPLOAD FORM
        ======================================================= */}
        {uploadOpen ? (
          <div className="surface-card mt-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h3 className="text-xl">
                  Upload Foto Penyewa
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Foto akan disimpan di Cloudinary dan datanya di Supabase.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!uploading) {
                    setUploadOpen(false);
                  }
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Nama Sanggar / Judul
                  </label>

                  <input
                    value={galleryTitle}
                    onChange={(e) =>
                      setGalleryTitle(e.target.value)
                    }
                    placeholder="Contoh: Cinze art_production"
                    className="mt-2 flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Nama Penyewa
                  </label>

                  <input
                    value={galleryName}
                    onChange={(e) =>
                      setGalleryName(e.target.value)
                    }
                    placeholder="Contoh:  Rasukan Ndayak"
                    className="mt-2 flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Alamat Penyewa
                  </label>

                  <textarea
                    value={galleryAddress}
                    onChange={(e) =>
                      setGalleryAddress(e.target.value)
                    }
                    placeholder="Contoh: Muntilan, Magelang. 088xxx"
                    rows={3}
                    className="mt-2 flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Foto
                </label>

                <label className="mt-2 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 p-5 text-center transition hover:border-primary hover:bg-primary-soft/30">
                  <ImagePlus className="h-10 w-10 text-primary" />

                  <p className="mt-3 text-sm font-semibold">
                    {galleryFile
                      ? galleryFile.name
                      : "Pilih foto penyewa"}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG atau WebP · maksimal 8 MB
                  </p>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file =
                        e.target.files?.[0] ?? null;

                      setGalleryFile(file);
                    }}
                  />
                </label>

                <Button
                  type="button"
                  disabled={uploading}
                  onClick={handleUploadGallery}
                  className="mt-4 w-full rounded-full"
                >
                  {uploading
                    ? "Mengupload..."
                    : "Simpan Foto"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* =======================================================
            GALLERY LIST
        ======================================================= */}
        <div className="mt-8">
          {galleryLoading ? (
            <div className="surface-card p-10 text-center text-sm text-muted-foreground">
              Memuat gallery penyewa...
            </div>
          ) : gallery.length === 0 ? (
            <div className="surface-card p-10 text-center">
              <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground" />

              <p className="mt-4 font-medium">
                Gallery penyewa masih kosong.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Upload foto penyewa pertama.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gallery.map((item) => {
                if (!item.image_url) {
                  return null;
                }

                return (
                  <article
                    key={item.id}
                    className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-secondary shadow-sm"
                  >
                    <img
                      src={item.image_url}
                      alt={`${item.name} - ${item.judul_atas || "Rasukan Ndayak"}`}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />

                    {/* Overlay supaya tulisan mudah dibaca */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/55" />

                    {/* JUDUL ATAS */}
                    <div className="absolute left-1/2 top-5 w-[82%] -translate-x-1/2 rounded-xl border border-white/30 bg-black/20 px-4 py-3 text-center backdrop-blur-[2px]">
                      <p className="font-display text-xl font-bold text-white drop-shadow-md sm:text-2xl">
                        {item.judul_atas ||
                          "Rasukan Ndayak"}
                      </p>
                    </div>

                    {/* NAMA + ALAMAT BAWAH KIRI */}
                    <div className="absolute bottom-16 left-5 max-w-[78%] text-white drop-shadow-lg">
                      <p className="font-display text-2xl font-bold leading-tight">
                        {item.name || "Nama Penyewa"}
                      </p>

                      <p className="mt-2 text-sm leading-relaxed text-white/95">
                        {item.alamat || "Alamat penyewa"}
                      </p>
                    </div>

                    {/* TOMBOL HAPUS */}
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteGallery(item)
                      }
                      className="absolute bottom-5 right-5 grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur-sm transition hover:bg-red-600"
                      aria-label={`Hapus foto ${item.name}`}
                      title="Hapus foto"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          KATEGORI KOLEKSI
      ========================================================= */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl">
              Kategori Koleksi
            </h2>

            <p className="mt-2 text-muted-foreground">
              Telusuri berdasarkan jenis perlengkapan.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c}
              to="/katalog"
              search={{ kategori: c }}
              className="surface-card group flex items-center justify-between p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]"
            >
              <span className="font-display text-xl">
                {c}
              </span>

              <span className="text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Lihat
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* =========================================================
          PRODUK PER KATEGORI
      ========================================================= */}
      {categories.map((c) => {
        const items = products.filter(
          (p) => p.category === c,
        );

        if (items.length === 0) {
          return null;
        }

        return (
          <section
            key={c}
            className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl sm:text-4xl">
                  {c}
                </h2>

                <p className="mt-2 text-muted-foreground">
                  {items.length} koleksi tersedia.
                </p>
              </div>

              <Button
                asChild
                variant="ghost"
                className="rounded-full"
              >
                <Link
                  to="/katalog"
                  search={{ kategori: c }}
                >
                  Lihat semua {c}
                </Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 3).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* =========================================================
          CTA
      ========================================================= */}
      <section className="mx-auto mt-20 max-w-7xl px-5 lg:px-8">
        <div className="rounded-[2.5rem] bg-primary px-8 py-14 text-center text-primary-foreground shadow-[var(--shadow-glow)] sm:px-16">
          <h2 className="text-3xl sm:text-4xl">
            Siap tampil memukau di panggung?
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Amankan tanggal pemakaian Anda sekarang, stok
            koleksi terbatas untuk musim festival.
          </p>

          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-8 rounded-full px-8"
          >
            <Link to="/booking">
              Booking Sekarang
            </Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}