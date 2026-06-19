import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-10 text-center">
      <div>
        <p className="text-6xl font-extrabold gradient-text">404</p>
        <h1 className="mt-4 text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          That route isn&apos;t part of the registry.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn-primary">
            Home
          </Link>
          <Link href="/services" className="btn-ghost">
            Browse services
          </Link>
        </div>
      </div>
    </div>
  );
}
