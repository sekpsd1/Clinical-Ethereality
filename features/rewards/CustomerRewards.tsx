import Link from "next/link";
import { ArrowLeft, Gift, Sparkles } from "lucide-react";
import { redeemWellnessCreditAction } from "@/features/rewards/actions";
import { rewardRules } from "@/features/rewards/rules";
import type { CustomerRewardLedgerItem, CustomerRewardsData } from "@/features/rewards/types";

export function CustomerRewards({ data }: { data: CustomerRewardsData }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <RewardsHeader />

      <main className="mx-auto w-full max-w-mobile space-y-7 px-6 py-7">
        <section className="overflow-hidden rounded-[24px] border border-white/40 bg-primary p-6 text-white shadow-[0_10px_30px_rgba(0,96,103,0.16)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Reward Balance</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-extrabold leading-none">{data.balance}</p>
              <p className="mt-2 text-sm font-semibold text-white/75">available points</p>
            </div>
            <span className="flex size-14 items-center justify-center rounded-full bg-white/15">
              <Sparkles aria-hidden="true" className="size-7" />
            </span>
          </div>
          <p className="mt-6 rounded-[18px] bg-white/10 px-4 py-3 text-sm leading-6 text-white/80">
            {data.expiringSoon > 0 ? `${data.expiringSoon} points expire within 30 days.` : "No points expiring within 30 days."}
          </p>
        </section>

        <section className="rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
          <h2 className="text-base font-extrabold text-primary">Reward rules</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#3e494a]">
            <p>{rewardRules.orderEarnRate.label}</p>
            <p>{rewardRules.communityComment.label}</p>
            <p>{rewardRules.wellnessCredit.label}</p>
          </div>
          <form action={redeemWellnessCreditAction} className="mt-5">
            <button
              type="submit"
              disabled={data.balance < rewardRules.wellnessCredit.points || data.unavailable}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary-gradient text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#6e797a]"
            >
              ใช้ 50 แต้ม
            </button>
          </form>
        </section>

        {data.unavailable ? (
          <EmptyRewards title="ไม่สามารถโหลดแต้มได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล" />
        ) : null}

        {!data.unavailable && data.ledger.length === 0 ? (
          <EmptyRewards title="ยังไม่มีรายการแต้ม" body="แต้มจากคำสั่งซื้อและคอมเมนต์จะแสดงที่นี่" />
        ) : null}

        <section className="space-y-4">
          {data.ledger.map((item) => (
            <RewardLedgerRow key={item.id} item={item} />
          ))}
        </section>
      </main>
    </div>
  );
}

function RewardsHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/profile" aria-label="Back to profile" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">Rewards</p>
        </div>
        <Gift aria-hidden="true" className="size-6 text-primary" />
      </div>
    </header>
  );
}

function RewardLedgerRow({ item }: { item: CustomerRewardLedgerItem }) {
  const isSpend = item.direction === "spend" || item.direction === "expire";

  return (
    <article className="flex items-center justify-between gap-4 rounded-[22px] border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-[#191c1e]">{item.sourceLabel}</h2>
        <p className="mt-1 text-xs leading-5 text-[#3e494a]">
          {item.createdAt}
          {item.expiresAt ? ` / expires ${item.expiresAt}` : ""}
        </p>
      </div>
      <p className={isSpend ? "text-lg font-extrabold text-[#ba1a1a]" : "text-lg font-extrabold text-primary"}>
        {item.signedPoints}
      </p>
    </article>
  );
}

function EmptyRewards({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 text-center shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
    </section>
  );
}
