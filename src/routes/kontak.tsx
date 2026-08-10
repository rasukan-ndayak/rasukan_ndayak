import { createFileRoute } from "@tanstack/react-router";
import { Clock, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/kontak")({
  head: () => ({
    meta: [
      { title: "Kontak — Rasukan Ndayak" },
      {
        name: "description",
        content:
          "Hubungi Rasukan Ndayak untuk konsultasi sewa busana adat Dayak, jadwal fitting, dan pengantaran.",
      },
      { property: "og:title", content: "Kontak — Rasukan Ndayak" },
      {
        property: "og:description",
        content: "Alamat galeri, WhatsApp, email, dan jam operasional Rasukan Ndayak.",
      },
    ],
  }),
  component: Kontak,
});

const infos = [
  { icon: MapPin, title: "Galeri", text: "Semawe, Sokorini, Muntilan, Magelang, Jawa Tengah" },
  { icon: Phone, title: "WhatsApp", text: "0857-2601-9040" },
  { icon: Mail, title: "Email", text: "halo@rasukanndayak.id" },
  { icon: Clock, title: "Jam Buka", text: "Senin – Sabtu, 09.00 – 18.00 WIB" },
  { icon: Instagram, title: "Instagram", text: "@rasukanndayak" },
];

function Kontak() {
  const [sending, setSending] = useState(false);

  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Kontak"
        title="Mari Berdiskusi"
        description="Ceritakan kebutuhan acara Anda, tim kami membantu memilih koleksi yang paling sesuai."
      />

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_1.2fr] lg:px-8">
        <div className="space-y-4">
          {infos.map(({ icon: Icon, title, text }) => (
            <div key={title} className="surface-card flex items-start gap-4 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <form
          className="surface-card space-y-5 p-7"
          onSubmit={(e) => {
            e.preventDefault();
            setSending(true);
            setTimeout(() => {
              setSending(false);
              toast.success("Pesan terkirim", {
                description: "Tim kami akan membalas dalam 1x24 jam.",
              });
              (e.target as HTMLFormElement).reset();
            }, 700);
          }}
        >
          <h2 className="text-2xl">Kirim Pesan</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input id="nama" required placeholder="Nama Anda" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telepon">Nomor WhatsApp</Label>
              <Input id="telepon" required placeholder="08xx xxxx xxxx" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required placeholder="nama@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pesan">Pesan</Label>
            <Textarea id="pesan" required rows={5} placeholder="Ceritakan kebutuhan acara Anda…" />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={sending}>
            {sending ? "Mengirim…" : "Kirim Pesan"}
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
}