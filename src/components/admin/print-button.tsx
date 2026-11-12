"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-black px-5 py-2.5 text-sm text-white">
      Print
    </button>
  );
}
