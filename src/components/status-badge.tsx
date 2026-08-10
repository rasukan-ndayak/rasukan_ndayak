import type { Status } from "@/data/products";
import { cn } from "@/lib/utils";

const styles: Record<Status, string> = {
  Tersedia: "bg-success/10 text-success",
  Terbatas: "bg-warning/15 text-warning",
  Habis: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        styles[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}