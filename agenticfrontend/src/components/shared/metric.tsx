import type { ReactNode } from "react";

interface MetricProps {
  label: string;
  value: ReactNode;
  detail?: string;
}

export function Metric({ label, value, detail }: MetricProps) {
  return (
    <div className="rounded-md border bg-background/65 p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
