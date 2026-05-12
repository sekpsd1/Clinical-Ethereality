import { FooterNav } from "@/components/navigation/FooterNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-text">
      <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        {children}
      </main>
      <FooterNav />
    </div>
  );
}
