"use client";

import Form from "next/form";

/** GET form that also submits when a [data-autosubmit] control changes. Works without JS. */
export function AutoSubmitForm({ action, className, children }: { action: string; className?: string; children: React.ReactNode }) {
  return (
    <Form
      action={action}
      className={className}
      scroll={false}
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t.hasAttribute("data-autosubmit")) (e.currentTarget as HTMLFormElement).requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}
