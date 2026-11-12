"use client";

import { Download } from "lucide-react";

function esc(v: string | number) {
  const s = String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function CsvButton({ filename, rows, label = "Export CSV" }: { filename: string; rows: (string | number)[][]; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-admin-border bg-white px-4 text-sm font-medium hover:bg-admin-lavender"
    >
      <Download className="size-4" />{label}
    </button>
  );
}
