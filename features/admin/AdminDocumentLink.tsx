import type { ReactNode } from "react";
import { Download, Printer } from "lucide-react";

export function AdminDocumentLink({ href, children, print = false }: {
  href: string;
  children: ReactNode;
  print?: boolean;
}) {
  const Icon = print ? Printer : Download;
  return (
    <a
      href={href}
      target={print ? "_blank" : undefined}
      rel={print ? "noopener noreferrer" : undefined}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </a>
  );
}
