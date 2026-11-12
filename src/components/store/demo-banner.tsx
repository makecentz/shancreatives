export function StoreDemoBanner() {
  return (
    <div className="border-b border-store-border bg-store-cream px-4 py-2 text-center text-[12px] text-store-muted">
      <strong className="font-semibold text-store-ink">Preview mode:</strong> products shown are labelled demo items and checkout is disabled until the store database and payments are connected.
    </div>
  );
}
