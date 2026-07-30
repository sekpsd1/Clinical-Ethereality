export default function CommunityLoading() {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#e0f2f1_0%,#f7f9fb_100%)] px-7 pb-28 pt-8">
      <div className="mx-auto w-full max-w-mobile animate-pulse space-y-6">
        <div className="h-10 w-48 rounded-full bg-white/70" />
        <div className="h-16 rounded-full bg-white/70" />
        <div className="aspect-[16/10] rounded-[24px] bg-white/70" />
        <div className="h-48 rounded-[24px] bg-white/70" />
      </div>
    </div>
  );
}
