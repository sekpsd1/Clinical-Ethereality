import { FooterNav } from "@/components/navigation/FooterNav";
import { TopAppBar } from "@/components/layout/TopAppBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-app text-text">
      <TopAppBar />
      <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))]">
        {children}
      </main>
      <FooterNav />
    </div>
  );
}
