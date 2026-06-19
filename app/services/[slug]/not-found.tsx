import Link from "next/link";

export default function ServiceNotFound() {
  return (
    <div className="container-page grid min-h-[50vh] place-items-center py-10 text-center">
      <div>
        <h1 className="text-2xl font-bold">Service not found</h1>
        <p className="mt-2 text-sm text-muted">
          This service isn&apos;t in the registry — it may have been removed.
        </p>
        <Link href="/services" className="btn-primary mt-6">
          ← Back to registry
        </Link>
      </div>
    </div>
  );
}
