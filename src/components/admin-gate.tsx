import { Lock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADMIN_PASSWORD = "Diandra08";
const SESSION_KEY = "rn-admin-unlocked";

export function AdminGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem(SESSION_KEY) === "1");
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value === ADMIN_PASSWORD) {
              window.sessionStorage.setItem(SESSION_KEY, "1");
              setUnlocked(true);
              setError(null);
            } else {
              setError("Password salah.");
            }
          }}
          className="surface-card w-full max-w-sm space-y-4 p-6"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl">Masuk Admin</h1>
            <p className="text-sm text-muted-foreground">
              Halaman ini dilindungi password. Masukkan password admin untuk melanjutkan.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-pass">Password</Label>
            <Input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-xl"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full rounded-full">
            Masuk
          </Button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
