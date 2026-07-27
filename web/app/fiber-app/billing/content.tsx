"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  IconDownload,
  IconReceipt2,
  IconSearch,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  BarList,
  EmptyState,
  SectionCard,
  StatCard,
  StatusPill,
} from "@/components/fiber-app/fa-kit";
import { compactMoney, money } from "@/lib/fiber-app";

interface Entry {
  _id: string;
  projectName: string;
  codeName: string;
  unit: string;
  quantity: number;
  adminRate: number;
  total: number;
  teamTotal: number;
  status: string;
  reportedBy: string;
  reportedAt: string;
  batchNumber?: string;
}

interface Batch {
  _id: string;
  projectName: string;
  batchNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  total: number;
  entryCount: number;
  invoiceNumber: string;
  generatedBy: string;
  generatedAt: string;
}

interface CodeSummary {
  code: string;
  unit: string;
  qty: number;
  total: number;
  teamTotal: number;
  count: number;
}

interface Summary {
  grand: { total: number; teamTotal: number; qty: number; count: number };
  margin: number;
  marginPercent: number;
  readyToBill: number;
  readyToBillCount: number;
  invoiced: number;
}

interface Payload {
  data: Entry[];
  totalCount: number;
  filterOptions?: Record<string, string[]>;
  summary?: Summary;
  codeSummary?: CodeSummary[];
  batches?: Batch[];
}

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toCsv(rows: Entry[]): string {
  const head = ["Project", "Code", "Qty", "Unit", "Rate", "Total", "Status", "Reported By", "Reported"];
  const body = rows.map((r) =>
    [
      r.projectName,
      r.codeName,
      r.quantity,
      r.unit,
      r.adminRate,
      r.total,
      r.status,
      r.reportedBy,
      r.reportedAt ? new Date(r.reportedAt).toISOString().slice(0, 10) : "",
    ]
      .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"')
      .join(",")
  );
  return [head.join(","), ...body].join("\n");
}

export function BillingContent() {
  const [payload, setPayload] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [project, setProject] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1" });
      if (debounced) params.set("q", debounced);
      if (project !== "all") params.set("project", project);
      if (status !== "all") params.set("status", status);
      const res = await fetch("/api/fiber-app/billing?" + params.toString());
      if (!res.ok) throw new Error("bad response");
      setPayload(await res.json());
    } catch {
      toast.error("Could not load billing data");
    } finally {
      setLoading(false);
    }
  }, [debounced, project, status]);

  React.useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!payload?.data?.length) {
      toast.error("Nothing to export");
      return;
    }
    const blob = new Blob([toCsv(payload.data)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fiberapp-billing-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Billing export downloaded");
  }

  const s = payload?.summary;
  const opts = payload?.filterOptions || {};

  return (
    <>
      <PageHeader
        title="Billing"
        description="Every billable unit, batch and invoice across all projects"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search codes, projects, crew..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
        filters={
          <>
            <FilterSelect
              value={project}
              onValueChange={setProject}
              placeholder="project"
              allLabel="All Projects"
              options={opts.projects || []}
              className="w-[180px]"
            />
            <FilterSelect
              value={status}
              onValueChange={setStatus}
              placeholder="status"
              allLabel="All Statuses"
              options={opts.statuses || []}
              className="w-[170px]"
            />
          </>
        }
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv}>
            <IconDownload className="mr-1 size-3.5" />
            Export Excel
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <FiberLoadingAnimation />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex flex-col gap-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Total Reported" value={compactMoney(s?.grand.total || 0)} hint={(s?.grand.count || 0).toLocaleString() + " entries"} icon={IconReceipt2} accent="chart1" />
              <StatCard label="Ready to Bill" value={compactMoney(s?.readyToBill || 0)} hint={(s?.readyToBillCount || 0) + " approved items"} accent="chart4" />
              <StatCard label="Invoiced" value={compactMoney(s?.invoiced || 0)} hint={(payload?.batches?.length || 0) + " batches"} accent="chart3" />
              <StatCard label="Crew Cost" value={compactMoney(s?.grand.teamTotal || 0)} hint="What the field is paid" accent="chart5" />
              <StatCard label="Margin" value={compactMoney(s?.margin || 0)} hint={(s?.marginPercent || 0) + "% of reported"} accent="chart2" progress={s?.marginPercent} />
            </div>

            <Tabs defaultValue="entries">
              <TabsList>
                <TabsTrigger value="entries" className="text-xs">
                  Entries ({payload?.totalCount || 0})
                </TabsTrigger>
                <TabsTrigger value="batches" className="text-xs">
                  Batches ({payload?.batches?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="codes" className="text-xs">
                  Code Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="entries" className="mt-4">
                <Card className="overflow-hidden">
                  <div className="max-h-[520px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Project</TableHead>
                          <TableHead className="text-xs">Code</TableHead>
                          <TableHead className="text-xs">Qty</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs">Rate</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Batch</TableHead>
                          <TableHead className="text-xs">Reported By</TableHead>
                          <TableHead className="text-xs">Reported</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(payload?.data || []).map((e) => (
                          <TableRow key={e._id}>
                            <TableCell className="text-xs">{e.projectName}</TableCell>
                            <TableCell className="text-xs">{e.codeName}</TableCell>
                            <TableCell className="text-xs tabular-nums">{e.quantity?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{e.unit}</TableCell>
                            <TableCell className="text-xs tabular-nums">{money(e.adminRate)}</TableCell>
                            <TableCell><StatusPill status={e.status} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{e.batchNumber || "—"}</TableCell>
                            <TableCell className="text-xs">{e.reportedBy}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(e.reportedAt)}</TableCell>
                            <TableCell className="text-right text-xs font-medium tabular-nums">{money(e.total)}</TableCell>
                          </TableRow>
                        ))}
                        {!payload?.data?.length && (
                          <TableRow>
                            <TableCell colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                              No billing entries match these filters
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {!!payload?.data?.length && (
                    <div className="border-t px-4 py-2 text-right text-xs text-muted-foreground">
                      Showing {payload.data.length.toLocaleString()} of {payload.totalCount.toLocaleString()} entries
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="batches" className="mt-4">
                <Card className="overflow-hidden">
                  {!payload?.batches?.length ? (
                    <div className="p-4">
                      <EmptyState
                        icon={IconReceipt2}
                        title="No billing batches yet"
                        message="Open a project and hit Generate Billing Doc to roll approved work into a batch."
                      />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Batch</TableHead>
                          <TableHead className="text-xs">Project</TableHead>
                          <TableHead className="text-xs">Period</TableHead>
                          <TableHead className="text-xs">Items</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Invoice</TableHead>
                          <TableHead className="text-xs">Generated By</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payload.batches.map((b) => (
                          <TableRow key={b._id}>
                            <TableCell className="text-xs font-medium">{b.batchNumber}</TableCell>
                            <TableCell className="text-xs">{b.projectName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {b.periodStart} → {b.periodEnd}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">{b.entryCount ?? "—"}</TableCell>
                            <TableCell><StatusPill status={b.status} /></TableCell>
                            <TableCell className="text-xs">{b.invoiceNumber || "—"}</TableCell>
                            <TableCell className="text-xs">{b.generatedBy}</TableCell>
                            <TableCell className="text-right text-xs font-medium tabular-nums">{money(b.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="codes" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SectionCard title="Value by Code" description="Where revenue is concentrated">
                    {!payload?.codeSummary?.length ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">No data</p>
                    ) : (
                      <BarList
                        items={payload.codeSummary.slice(0, 12).map((c) => ({
                          label: c.code,
                          value: c.total,
                          sub: c.qty.toLocaleString() + " " + c.unit + " · " + c.count + " entries",
                        }))}
                        valueFormatter={compactMoney}
                      />
                    )}
                  </SectionCard>

                  <SectionCard title="Code Detail" bodyClassName="p-0">
                    <div className="max-h-[420px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Code</TableHead>
                            <TableHead className="text-xs">Qty</TableHead>
                            <TableHead className="text-xs">Crew Cost</TableHead>
                            <TableHead className="text-right text-xs">Billed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(payload?.codeSummary || []).map((c) => (
                            <TableRow key={c.code}>
                              <TableCell className="text-xs">{c.code}</TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {c.qty.toLocaleString()} {c.unit}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-muted-foreground">
                                {money(c.teamTotal)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium tabular-nums">
                                {money(c.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </SectionCard>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </>
  );
}
