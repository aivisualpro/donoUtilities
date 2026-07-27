"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconFolders, IconPlus, IconSearch } from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { DataTable, type ColumnDef } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ProgressBar, StatusPill } from "@/components/fiber-app/fa-kit";
import { BUILD_TYPES, compactMoney, humanizeStatus } from "@/lib/fiber-app";

interface Project {
  _id: string;
  projectNumber: string;
  name: string;
  customerName: string;
  city: string;
  state: string;
  status: string;
  buildType: string;
  foreman: string;
  crewSize: number;
  budget: number;
  markerCount: number;
  photoCount: number;
  reportedValue: number;
  invoicedValue: number;
  percentComplete: number;
  budgetUsedPercent: number;
  startDate: string;
  dueDate: string;
}

const columns: ColumnDef<Project>[] = [
  { label: "#", key: "projectNumber", width: "90px" },
  { label: "Project", key: "name", width: "230px" },
  { label: "Customer", key: "customerName", width: "170px" },
  { label: "Location", key: "_loc", width: "150px" },
  { label: "Build", key: "buildType", width: "150px" },
  { label: "Status", key: "status", width: "120px" },
  { label: "Progress", key: "percentComplete", width: "150px" },
  { label: "Markers", key: "markerCount", type: "number", width: "90px" },
  { label: "Reported", key: "reportedValue", type: "dollar", width: "120px" },
  { label: "Budget", key: "budget", type: "dollar", width: "120px" },
  { label: "Used", key: "budgetUsedPercent", width: "140px" },
  { label: "Foreman", key: "foreman", width: "150px" },
  { label: "Due", key: "dueDate", type: "date", width: "120px" },
];

const EMPTY_FORM = {
  name: "",
  customerName: "",
  city: "",
  state: "IN",
  buildType: "underground",
  status: "active",
  foreman: "",
  crewSize: "",
  budget: "",
  dueDate: "",
};

export function ProjectsContent() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState("all");
  const [customer, setCustomer] = React.useState("all");
  const [buildType, setBuildType] = React.useState("all");

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });

  const serverFilters = React.useMemo(
    () => ({ q: debounced, status, customer, buildType }),
    [debounced, status, customer, buildType]
  );

  const {
    records,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    filterOptions,
    reset,
  } = useInfiniteData<Project>({
    apiUrl: "/api/fiber-app/projects",
    filters: serverFilters,
  });

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error("Give the project a name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/fiber-app/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          crewSize: Number(form.crewSize) || 0,
          budget: Number(form.budget) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Create failed");
      toast.success("Project " + json.projectNumber + " created");
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  }

  const totals = React.useMemo(() => {
    return records.reduce(
      (a, p) => ({
        budget: a.budget + (p.budget || 0),
        reported: a.reported + (p.reportedValue || 0),
        invoiced: a.invoiced + (p.invoicedValue || 0),
        markers: a.markers + (p.markerCount || 0),
      }),
      { budget: 0, reported: 0, invoiced: 0, markers: 0 }
    );
  }, [records]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every job, from first print to final invoice"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, customers, cities..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
        filters={
          <>
            <FilterSelect
              value={status}
              onValueChange={setStatus}
              placeholder="status"
              allLabel="All Statuses"
              options={filterOptions.statuses || []}
              className="w-[140px]"
            />
            <FilterSelect
              value={customer}
              onValueChange={setCustomer}
              placeholder="customer"
              allLabel="All Customers"
              options={filterOptions.customers || []}
              className="w-[170px]"
            />
            <FilterSelect
              value={buildType}
              onValueChange={setBuildType}
              placeholder="build type"
              allLabel="All Build Types"
              options={filterOptions.buildTypes || []}
              className="w-[165px]"
            />
          </>
        }
        actions={
          <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
            <IconPlus className="mr-1 size-3.5" />
            New Project
          </Button>
        }
      />

      <DataTable<Project>
        columns={columns}
        data={records}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        totalCount={totalCount}
        onLoadMore={loadMore}
        emptyIcon={<IconFolders className="size-8 opacity-40" />}
        emptyMessage="No projects yet — create one to get started"
        onRowClick={(row) => router.push("/fiber-app/projects/" + row._id)}
        footerRow={{
          projectNumber: "Totals",
          markerCount: totals.markers.toLocaleString(),
          reportedValue: compactMoney(totals.reported),
          budget: compactMoney(totals.budget),
        }}
        renderCell={(row, col) => {
          if (col.key === "_loc") {
            return (
              <span className="whitespace-nowrap">
                {row.city ? row.city + ", " + row.state : "—"}
              </span>
            );
          }
          if (col.key === "status") return <StatusPill status={row.status} />;
          if (col.key === "buildType") {
            return <span className="whitespace-nowrap">{humanizeStatus(row.buildType)}</span>;
          }
          if (col.key === "percentComplete") {
            return <ProgressBar value={row.percentComplete} showLabel tone="var(--chart-2)" />;
          }
          if (col.key === "budgetUsedPercent") {
            return (
              <ProgressBar
                value={row.budgetUsedPercent}
                showLabel
                tone={row.budgetUsedPercent > 90 ? "var(--chart-5)" : "var(--chart-1)"}
              />
            );
          }
          return undefined;
        }}
      />

      {/* ---- Create project dialog ---- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>
              Upload prints and billing codes later — this takes under two minutes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="fa-name" className="text-xs">Project name</Label>
              <Input
                id="fa-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Fishers FTTH Phase 4"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fa-cust" className="text-xs">Customer</Label>
                <Input
                  id="fa-cust"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Metronet"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fa-foreman" className="text-xs">Foreman</Label>
                <Input
                  id="fa-foreman"
                  value={form.foreman}
                  onChange={(e) => setForm({ ...form, foreman: e.target.value })}
                  placeholder="Tony Alvarez"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5 col-span-2">
                <Label htmlFor="fa-city" className="text-xs">City</Label>
                <Input
                  id="fa-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Fishers"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fa-state" className="text-xs">State</Label>
                <Input
                  id="fa-state"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Build type</Label>
                <Select
                  value={form.buildType}
                  onValueChange={(v) => setForm({ ...form, buildType: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILD_TYPES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {humanizeStatus(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["active", "pending", "completed", "archived"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {humanizeStatus(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fa-budget" className="text-xs">Budget ($)</Label>
                <Input
                  id="fa-budget"
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  placeholder="250000"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fa-crew" className="text-xs">Crew size</Label>
                <Input
                  id="fa-crew"
                  type="number"
                  value={form.crewSize}
                  onChange={(e) => setForm({ ...form, crewSize: e.target.value })}
                  placeholder="4"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fa-due" className="text-xs">Due date</Label>
                <Input
                  id="fa-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
