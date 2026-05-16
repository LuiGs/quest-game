import Link from "next/link";

/**
 * Minimal top-bar used across pages so users always have a clear path back to
 * the home screen. Renders a brand mark on the left and an optional slot on
 * the right (eg. host code, "salir" button, etc).
 */
export function PageHeader({
  right,
  backHref = "/",
  backLabel = "Inicio",
}: {
  right?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex items-center justify-between mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-purple-100/70 hover:text-white transition"
      >
        <span aria-hidden="true">←</span>
        <span>{backLabel}</span>
      </Link>
      {right ? <div className="text-sm">{right}</div> : null}
    </header>
  );
}
