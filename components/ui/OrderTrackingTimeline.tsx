import { Check } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

export type OrderTrackingTimelineStep = {
  title: string;
  description: string | null;
  status: "done" | "active" | "pending";
};

type OrderTrackingTimelineProps = {
  steps: OrderTrackingTimelineStep[];
  className?: string;
};

export function OrderTrackingTimeline({ steps, className }: OrderTrackingTimelineProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {steps.map((step, index) => (
        <TrackingStepRow key={`${step.title}-${index}`} step={step} isLast={index === steps.length - 1} />
      ))}
    </div>
  );
}

function TrackingStepRow({ step, isLast }: { step: OrderTrackingTimelineStep; isLast: boolean }) {
  const isDone = step.status === "done";
  const isActive = step.status === "active";

  return (
    <div className="relative flex gap-4">
      {!isLast ? (
        <span
          aria-hidden="true"
          className={cn("absolute left-[11px] top-8 h-[calc(100%+0.75rem)] w-0.5", isDone ? "bg-primary" : "bg-[#e0e3e5]")}
        />
      ) : null}

      <span
        className={cn(
          "z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
          isDone && "bg-primary text-white shadow-sm",
          isActive && "border-4 border-primary bg-white",
          step.status === "pending" && "bg-[#e6e8ea]"
        )}
      >
        {isDone ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
        {isActive ? <span className="size-1.5 animate-pulse rounded-full bg-primary" /> : null}
        {step.status === "pending" ? <span className="size-1.5 rounded-full bg-[#bdc9ca]" /> : null}
      </span>

      <div>
        <h3
          className={cn(
            "text-sm leading-5",
            isActive && "font-bold text-primary",
            isDone && "font-bold text-[#191c1e]",
            step.status === "pending" && "font-medium text-[#6e797a]"
          )}
        >
          {step.title}
        </h3>
        {step.description ? <p className="mt-1 text-xs leading-5 text-[#3e494a]">{step.description}</p> : null}
      </div>
    </div>
  );
}
