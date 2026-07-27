"use client";

import * as React from "react";
import { type Icon } from "@tabler/icons-react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { humanizeStatus, statusTone } from "@/lib/fiber-app";

/* ---------- Status pill ---------- */

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusTone(status)} className={cn("whitespace-nowrap", className)}>
      {humanizeStatus(status)}
    </Badge>
  );
}

/* ---------- KPI stat card ---------- */

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: Icon;
  delta?: number;
  accent?: "primary" | "chart1" | "chart2" | "chart3" | "chart4" | "chart5";
  progress?: number;
  className?: string;
}

const ACCENTS: Record<string, string> = {
  primary: "var(--primary)",
  chart1: "var(--chart-1)",
  chart2: "var(--chart-2)",
  chart3: "var(--chart-3)",
  chart4: "var(--chart-4)",
  chart5: "var(--chart-5)",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  accent = "primary",
  progress,
  className,
}: StatCardProps) {
  const tint = ACCENTS[accent] || ACCENTS.primary;
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* accent rail */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: tint }}
      />
      <CardContent className="flex flex-col gap-1.5 py-4 pl-5 pr-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {Icon && (
            <Icon className="size-4 shrink-0 opacity-60" style={{ color: tint }} />
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums leading-none">{value}</span>
          {typeof delta === "number" && delta !== 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                delta > 0 ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"
              )}
            >
              {delta > 0 ? (
                <IconTrendingUp className="size-3" />
              ) : (
                <IconTrendingDown className="size-3" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>

        {typeof progress === "number" && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: Math.max(0, Math.min(100, progress)) + "%",
                background: tint,
              }}
            />
          </div>
        )}

        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

/* ---------- Progress bar ---------- */

export function ProgressBar({
  value,
  className,
  tone = "var(--primary)",
  showLabel,
}: {
  value: number;
  className?: string;
  tone?: string;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 min-w-[52px] flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: v + "%", background: v > 100 ? "var(--destructive)" : tone }}
        />
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {v}%
        </span>
      )}
    </div>
  );
}

/* ---------- Section card ---------- */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("min-h-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon?: Icon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      {Icon && (
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {message && <p className="max-w-sm text-xs text-muted-foreground">{message}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Horizontal bar list (code / project breakdowns) ---------- */

export function BarList({
  items,
  valueFormatter,
  tone = "var(--chart-1)",
}: {
  items: { label: string; value: number; sub?: string }[];
  valueFormatter?: (n: number) => string;
  tone?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-xs font-medium" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {valueFormatter ? valueFormatter(i.value) : i.value.toLocaleString()}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700 group-hover:opacity-80"
              style={{ width: (i.value / max) * 100 + "%", background: tone }}
            />
          </div>
          {i.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{i.sub}</p>}
        </div>
      ))}
    </div>
  );
}
