import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; search?: { kategori?: string } };

const navItems: NavItem[] = [
  { label: "Beranda", to: "/" },
  { label: "Katalog", to: "/katalog" },
  { label: "Kostum", to: "/katalog", search: { kategori: "Kostum" } },
  { label: "Kuluk Lancur", to: "/katalog", search: { kategori: "Kuluk Lancur" } },
  { label: "Kuluk Mentok", to: "/katalog", search: { kategori: "Kuluk Mentok" } },
  { label: "Klinting", to: "/katalog", search: { kategori: "Klinting" } },
  { label: "Aksesoris", to: "/katalog", search: { kategori: "Aksesoris" } },
  { label: "Jadwal", to: "/jadwal" },
  { label: "Cek Booking", to: "/kelola-booking" },
  { label: "Kontak", to: "/kontak" },
  { label: "Admin", to: "/admin" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center">
          <img
            src="/rasukan.png"
            alt="Rasukan Ndayak"
            className="h-11 w-auto shrink-0 object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              search={item.search as never}
              activeOptions={{ exact: item.to === "/", includeSearch: Boolean(item.search) }}
              className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Button asChild size="sm" className="ml-2 rounded-full">
            <Link to="/booking">Booking Sekarang</Link>
          </Button>
        </nav>

        <button
          type="button"
          aria-label="Buka menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border/70 transition-all duration-300 lg:hidden",
          open ? "max-h-[32rem]" : "max-h-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-5 py-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              search={item.search as never}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}