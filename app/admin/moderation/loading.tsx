export default function AdminModerationLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-32 rounded-[8px] bg-primary/15" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-24 rounded-[8px] bg-white/75" />
        <div className="h-24 rounded-[8px] bg-white/75" />
        <div className="h-24 rounded-[8px] bg-white/75" />
      </div>
      <div className="h-40 rounded-[8px] bg-white/75" />
    </div>
  );
}
