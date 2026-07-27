"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  IconActivity,
  IconAlertTriangle,
  IconCamera,
  IconCheck,
  IconChecklist,
  IconCircleCheck,
  IconClipboardCheck,
  IconCurrencyDollar,
  IconDatabaseImport,
  IconFolders,
  IconMapPin,
  IconReceipt2,
  IconRefresh,
  IconSparkles,
  IconTopologyStar3,
  IconUsersGroup,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import {
  BarList,
  EmptyState,
  ProgressBar,
  SectionCard,
  StatCard,
} from "@/components/fiber-app/fa-kit";
import { compactMoney, humanizeStatus, money } from "@/lib/fiber-app";

/* ---------- Types ---------- */

interface Kpis {
  activeProjects: number;
  completedProjects: number;
  pendingProjects: number;
  archivedProjects: number;
  totalProjects: number;
  totalBudget: number;
  reportedValue: number;
  reportedUnits: number;
  billingEntries: number;
  invoicedValue: number;
  readyToBillValue: number;
  unbilledValue: number;
  markerCount: number;
  awaitingInspection: number;
  photoCount: number;
  crewCount: number;
  formCount: number;
  batchCount: number;
  budgetUsedPercent: number;
}

interface DashboardPayload {
  kpis: Kpis;
  trend: { date: string; reported: number; invoiced: number; units: number }[];
  byCode: { code: string; total: number; qty: number }[];
  byProject: { project: string; total: number }[];
  projectsByStatus: { status: string; count: number }[];
  activity: { _id: string; type: string; message: string; actor: string; createdAt: string }[];
}

const chartConfig = {
  reported: { label: "Reported", color: "var(--chart-1)" },
  invoiced: { label: "Invoiced", color: "var(--chart-2)" },
} satisfies ChartConfig;

const ACTIVITY_ICON: Record<string, typeof IconActivity> = {
  project_created: IconFolders,
  work_reported: IconMapPin,
  photo_uploaded: IconCamera,
  inspection: IconClipboardCheck,
  marker_status: IconCircleCheck,
  billing_generated: IconReceipt2,
  invoice: IconCurrencyDollar,
  form_submitted: IconChecklist,
  sync: IconRefresh,
  status_changed: IconActivity,
};

function relTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.round(hrs / 24);
  if (days < 30) return days + "d ago";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---------- Component ---------- */

export function DashboardContent() {
  const router = useRouter();
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState("30d");
  const [seeding, setSeeding] = React.useState(false);

  const load = React.useCallback(async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/fiber-app/dashboard?range=" + r);
      if (!res.ok) throw new Error("bad response");
      setData(await res.json());
    } catch {
      toast.error("Could not load the FiberApp dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(range);
  }, [load, range]);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/fiber-app/seed?reset=1", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Seed failed");
      toast.success(
        "Demo data loaded — " +
          json.inserted.projects +
          " projects, " +
          json.inserted.markers +
          " markers, " +
          json.inserted.billingEntries +
          " billing entries"
      );
      await load(range);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  const k = data?.kpis;
  const isEmpty = !loading && (!k || k.totalProjects === 0);

  return (
    <>
      <PageHeader
        title="FiberApp"
        description="Field to invoice. In minutes."
        filters={
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="7d" className="text-xs px-2.5">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d" className="text-xs px-2.5">30d</ToggleGroupItem>
            <ToggleGroupItem value="90d" className="text-xs px-2.5">90d</ToggleGroupItem>
            <ToggleGroupItem value="all" className="text-xs px-2.5">All</ToggleGroupItem>
          </ToggleGroup>
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link href="/fiber-app/field">
                <IconMapPin className="mr-1 size-3.5" />
                Field Mode
              </Link>
            </Button>
            <Button size="sm" className="h-8 text-xs" asChild>
              <Link href="/fiber-app/projects">
                <IconFolders className="mr-1 size-3.5" />
                Projects
              </Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <FiberLoadingAnimation />
        </div>
      ) : isEmpty ? (
        <div className="flex-1 overflow-auto p-6">
          <EmptyState
            icon={IconTopologyStar3}
            title="No FiberApp data yet"
            message="Create your first project, or load a realistic demo dataset to see every screen populated — projects, markers, photos, billing codes, batches and activity."
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSeed} disabled={seeding}>
                  <IconDatabaseImport className="mr-1.5 size-4" />
                  {seeding ? "Loading demo data..." : "Load demo data"}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/fiber-app/projects">Create a project</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex flex-col gap-4 p-4">
            {/* ---- KPI row ---- */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard
                label="Active Projects"
                value={k!.activeProjects}
                hint={k!.totalProjects + " total · " + k!.completedProjects + " complete"}
                icon={IconFolders}
                accent="chart1"
              />
              <StatCard
                label="Reported Value"
                value={compactMoney(k!.reportedValue)}
                hint={k!.billingEntries.toLocaleString() + " billing entries"}
                icon={IconCurrencyDollar}
                accent="chart2"
              />
              <StatCard
                label="Ready to Bill"
                value={compactMoney(k!.readyToBillValue)}
                hint="Approved, not yet invoiced"
                icon={IconReceipt2}
                accent="chart4"
              />
              <StatCard
                label="Invoiced"
                value={compactMoney(k!.invoicedValue)}
                hint={k!.batchCount + " billing batches"}
                icon={IconCheck}
                accent="chart3"
              />
              <StatCard
                label="Awaiting Inspection"
                value={k!.awaitingInspection}
                hint="Completed work pending QC"
                icon={IconAlertTriangle}
                accent="chart5"
              />
              <StatCard
                label="Budget Used"
                value={k!.budgetUsedPercent + "%"}
                hint={compactMoney(k!.reportedValue) + " of " + compactMoney(k!.totalBudget)}
                icon={IconActivity}
                accent="primary"
                progress={k!.budgetUsedPercent}
              />
            </div>

            {/* ---- Chart + code breakdown ---- */}
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard
                title="Reported vs Invoiced"
                description="Billing value flowing in from the field"
                className="lg:col-span-2"
                bodyClassName="p-3"
              >
                {data!.trend.length === 0 ? (
                  <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
                    No activity in this range
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
                    <AreaChart data={data!.trend}>
                      <defs>
                        <linearGradient id="faReported" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-reported)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-reported)" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="faInvoiced" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-invoiced)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-invoiced)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={28}
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        }
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={(v) => compactMoney(Number(v))}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(v) =>
                              new Date(v).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            }
                            formatter={(value, name) => (
                              <div className="flex w-full justify-between gap-4">
                                <span className="capitalize text-muted-foreground">{name}</span>
                                <span className="font-medium tabular-nums">
                                  {money(Number(value))}
                                </span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Area
                        dataKey="reported"
                        type="natural"
                        fill="url(#faReported)"
                        stroke="var(--color-reported)"
                        strokeWidth={2}
                        stackId="a"
                      />
                      <Area
                        dataKey="invoiced"
                        type="natural"
                        fill="url(#faInvoiced)"
                        stroke="var(--color-invoiced)"
                        strokeWidth={2}
                        stackId="b"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </SectionCard>

              <SectionCard
                title="Top Billing Codes"
                description="Where the value is coming from"
              >
                {data!.byCode.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No billing entries yet
                  </p>
                ) : (
                  <BarList
                    items={data!.byCode.map((c) => ({
                      label: c.code,
                      value: c.total,
                      sub: c.qty.toLocaleString() + " units",
                    }))}
                    valueFormatter={compactMoney}
                    tone="var(--chart-1)"
                  />
                )}
              </SectionCard>
            </div>

            {/* ---- Projects, pipeline, activity ---- */}
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard title="Top Projects" description="By reported value">
                {data!.byProject.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No projects yet</p>
                ) : (
                  <BarList
                    items={data!.byProject.map((p) => ({ label: p.project, value: p.total }))}
                    valueFormatter={compactMoney}
                    tone="var(--chart-2)"
                  />
                )}
              </SectionCard>

              <SectionCard title="Field Coverage" description="What the crews have banked">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Markers", value: k!.markerCount, icon: IconMapPin },
                    { label: "Photos", value: k!.photoCount, icon: IconCamera },
                    { label: "Forms", value: k!.formCount, icon: IconChecklist },
                    { label: "Crew Seats", value: k!.crewCount, icon: IconUsersGroup },
                  ].map((s) => (
                    <Card key={s.label} className="border-dashed shadow-none">
                      <CardContent className="flex items-center gap-3 px-3 py-3">
                        <s.icon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-lg font-semibold leading-none tabular-nums">
                            {s.value.toLocaleString()}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-4 space-y-2.5">
                  {data!.projectsByStatus.map((s) => {
                    const pct = k!.totalProjects
                      ? Math.round((s.count / k!.totalProjects) * 100)
                      : 0;
                    return (
                      <div key={s.status}>
                        <div className="mb-1 flex items-baseline justify-between">
                          <span className="text-xs font-medium">{humanizeStatus(s.status)}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {s.count}
                          </span>
                        </div>
                        <ProgressBar value={pct} tone="var(--chart-3)" />
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard
                title="Latest Activity"
                description="Across all projects"
                bodyClassName="p-0"
              >
                {data!.activity.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">
                    Activity will appear here as work gets done
                  </p>
                ) : (
                  <ul className="max-h-[330px] divide-y overflow-auto">
                    {data!.activity.map((a) => {
                      const Icon = ACTIVITY_ICON[a.type] || IconActivity;
                      return (
                        <li key={a._id} className="flex gap-3 px-4 py-2.5">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-snug">{a.message}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {a.actor} · {relTime(a.createdAt)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* ---- Demo data control ---- */}
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <IconSparkles className="size-4" />
                  Demo controls — rebuild the FiberApp_* collections with a fresh, realistic dataset.
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSeed} disabled={seeding}>
                  <IconDatabaseImport className="mr-1.5 size-3.5" />
                  {seeding ? "Rebuilding..." : "Reload demo data"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
