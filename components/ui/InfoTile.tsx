import type { ReactNode } from "react";
import { cn } from "@/lib/design-system/variants";

type InfoTileProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  density?: "compact" | "comfortable";
  descriptionList?: boolean;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
};

export function InfoTile({
  label,
  value,
  icon,
  density = "compact",
  descriptionList = false,
  className,
  labelClassName,
  valueClassName
}: InfoTileProps) {
  const Label = descriptionList ? "dt" : "p";
  const Value = descriptionList ? "dd" : "p";

  return (
    <div className={cn("rounded-[8px] bg-primary/5", density === "comfortable" ? "p-3" : "px-3 py-2", className)}>
      <Label className={cn(icon && "flex items-center gap-1.5", "text-[10px] font-bold uppercase text-muted", labelClassName)}>
        {icon}
        {label}
      </Label>
      <Value className={cn("mt-0.5 truncate font-bold text-primary", valueClassName)}>{value}</Value>
    </div>
  );
}
