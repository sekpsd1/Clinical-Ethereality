import { GlassSurface } from "@/components/ui/GlassSurface";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";

type StitchedScreenPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusItems: string[];
};

export function StitchedScreenPlaceholder({
  eyebrow,
  title,
  description,
  statusItems
}: StitchedScreenPlaceholderProps) {
  return (
    <Screen className="gap-5">
      <div className="space-y-2 pt-2">
        <p className="text-label font-semibold uppercase tracking-[0.08em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-title font-semibold text-text">{title}</h1>
        <p className="max-w-sm text-body leading-6 text-muted">{description}</p>
      </div>

      <GlassSurface className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-section font-semibold text-text">Stitch navigation plan</h2>
          <StatusBadge tone="warning">Scaffold</StatusBadge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {statusItems.map((item) => (
            <div
              key={item}
              className="rounded-card border border-border bg-surface/75 px-3 py-3 text-sm font-medium text-text"
            >
              {item}
            </div>
          ))}
        </div>
      </GlassSurface>
    </Screen>
  );
}
