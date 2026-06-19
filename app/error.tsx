"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-10 text-center">
      <div className="card max-w-md p-8">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-danger/15 text-danger mx-auto">
          !
        </span>
        <h1 className="mt-4 text-xl font-bold">Something broke</h1>
        <p className="mt-2 break-words text-sm text-muted">
          {error.message || "An unexpected error occurred."}
        </p>
        <button className="btn-primary mt-6" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
