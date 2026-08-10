import { Link } from "@tanstack/react-router";
import { MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <h3 className="font-display text-xl">Rasukan Ndayak</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Dalam setiap tarian tersimpan filosofi kehidupan. Kami merawat dan menyewakan kostum
            ndayakan untuk panggung, upacara, dan dokumentasi budaya.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Katalog</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {["Kostum", "Kuluk Lancur", "Kuluk Mentok", "Klinting", "Aksesoris"].map((c) => (
              <li key={c}>
                <Link to="/katalog" search={{ kategori: c }} className="hover:text-primary">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Layanan</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/jadwal" className="hover:text-primary">
                Jadwal Keluar & Masuk
              </Link>
            </li>
            <li>
              <Link to="/booking" className="hover:text-primary">
                Booking & Cek Ketersediaan
              </Link>
            </li>
            <li>
              <Link to="/kontak" className="hover:text-primary">
                Kontak
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-primary">
                Dashboard Admin
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Hubungi Kami</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Semawe, Sokorini, Muntilan,
              Magelang, Jawa Tengah
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" /> 0857-2601-9040
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Rasukan Ndayak. Seluruh hak cipta dilindungi.
      </div>
    </footer>
  );
}