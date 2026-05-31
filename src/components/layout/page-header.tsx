import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({ title, subtitle, backHref }: { title: string; subtitle?: string; backHref?: string }) {
  return (
    <header className="mb-4 flex items-start gap-3">
      {backHref ? (
        <Link href={backHref} className="mt-1 grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-white">
          <ChevronLeft size={20} />
        </Link>
      ) : null}
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
    </header>
  );
}
