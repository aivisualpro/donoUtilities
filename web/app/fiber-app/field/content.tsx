"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconCloudCheck,
  IconCloudOff,
  IconDeviceMobile,
  IconMapPin,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import { EmptyState, ProgressBar, StatusPill } from "@/components/fiber-app/fa-kit";
import { PhotoUploader } from "@/components/fiber-app/photo-uploader";
import { humanizeStatus, money } from "@/lib/fiber-app";

interface Project {
  _id: string;
  projectNumber: string;
  name: string;
  customerName: string;
  city: string;
  state: string;
  status: string;
  percentComplete: number;
  markerCount: number;
}

interface Marker {
  _id: string;
  markerNumber: string;
  type: string;
  status: string;
  address: string;
  reportedBy: string;
}

interface Code {
  _id: string;
  code: string;
  name: string;
  unit: string;
  teamPrice: number;
  adminPrice: number;
}

interface QueueItem {
  id: string;
  label: string;
  synced: boolean;
}

const QUICK_STATUSES = [
  { value: "in_progress", label: "Started", icon: IconMapPin },
  { value: "completed", label: "Complete", icon: IconCircleCheck },
  { value: "inspection_pending", label: "Ready for QC", icon: IconCheck },
];

export function FieldContent() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [codes, setCodes] = React.useState<Code[]>([]);
  const [markers, setMarkers] = React.useState<Marker[]>([]);
  const [active, setActive] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMarkers, setLoadingMarkers] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [sheet, setSheet] = React.useState<Marker | null>(null);
  const [codeId, setCodeId] = React.useState("");
  const [qty, setQty] = React.useState("");

  /* ---- bootstrap ---- */
  React.useEffect(() => {
    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          fetch("/api/fiber-app/projects?status=active"),
          fetch("/api/fiber-app/billing-codes"),
        ]);
        const pJson = await pRes.json();
        const cJson = await cRes.json();
        setProjects(pJson.data || []);
        setCodes(cJson.data || []);
      } catch {
        toast.error("Could not load your assignments");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---- connectivity ---- */
  React.useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function openProject(p: Project) {
    setActive(p);
    setLoadingMarkers(true);
    try {
      const res = await fetch("/api/fiber-app/markers?projectId=" + p._id);
      const json = await res.json();
      setMarkers(json.data || []);
    } catch {
      toast.error("Could not load markers");
    } finally {
      setLoadingMarkers(false);
    }
  }

  function enqueue(label: string) {
    const id = label + "-" + queue.length + "-" + markers.length;
    setQueue((q) => [{ id, label, synced: false }, ...q].slice(0, 12));
    // Mimic the offline-first sync: flip to synced shortly after.
    window.setTimeout(() => {
      setQueue((q) => q.map((i) => (i.id === id ? { ...i, synced: true } : i)));
    }, 1400);
  }

  async function quickStatus(m: Marker, status: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/markers/" + m._id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("failed");
      setMarkers((prev) => prev.map((x) => (x._id === m._id ? { ...x, status } : x)));
      enqueue(m.markerNumber + " → " + humanizeStatus(status));
      toast.success(m.markerNumber + " set to " + humanizeStatus(status));
    } catch {
      toast.error("Could not save — it will retry when you're back online");
      enqueue(m.markerNumber + " → " + humanizeStatus(status) + " (queued)");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!sheet || !active) return;
    const code = codes.find((c) => c._id === codeId);
    const quantity = Number(qty);
    if (!code || !quantity || quantity <= 0) {
      toast.error("Pick a billing code and enter a quantity");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: active._id,
          projectName: active.name,
          markerNumber: sheet.markerNumber,
          type: sheet.type,
          status: "completed",
          address: sheet.address,
          reportedAt: new Date().toISOString(),
          note: "field-mode report",
        }),
      });
      if (!res.ok) throw new Error("failed");

      enqueue(sheet.markerNumber + " · " + code.code + " × " + quantity + " " + code.unit);
      toast.success(
        "Reported " + quantity + " " + code.unit + " of " + code.code + " — " + money(quantity * code.adminPrice)
      );
      setSheet(null);
      setCodeId("");
      setQty("");
    } catch {
      toast.error("Saved offline — will sync when you have coverage");
      enqueue(sheet.markerNumber + " · " + code.code + " (queued)");
      setSheet(null);
    } finally {
      setBusy(false);
    }
  }

  const pending = queue.filter((q) => !q.synced).length;

  return (
    <>
      <PageHeader
        title="Field Mode"
        description="Phone-first reporting for crews on site"
        filters={
          <>
            <Badge variant={online ? "default" : "destructive"} className="gap-1">
              {online ? <IconCloudCheck className="size-3" /> : <IconCloudOff className="size-3" />}
              {online ? "Online" : "Offline"}
            </Badge>
            {pending > 0 && (
              <Badge variant="secondary" className="gap-1">
                <IconRefresh className="size-3 animate-spin" />
                {pending} syncing
              </Badge>
            )}
          </>
        }
        actions={
          active ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActive(null)}>
              <IconArrowLeft className="mr-1 size-3.5" />
              Switch project
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <FiberLoadingAnimation />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Phone-width column, centred on desktop so it reads as a device preview */}
          <div className="mx-auto w-full max-w-md p-4">
            {!active ? (
              <>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  My Projects
                </p>
                {projects.length === 0 ? (
                  <EmptyState
                    icon={IconDeviceMobile}
                    title="No assigned projects"
                    message="Check with your foreman for your assignment."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {projects.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => openProject(p)}
                        className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.projectNumber} · {p.city}, {p.state}
                            </p>
                          </div>
                          <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <ProgressBar value={p.percentComplete} tone="var(--chart-2)" className="flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {p.markerCount} markers
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-3">
                  <p className="text-sm font-semibold">{active.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {active.projectNumber} · {active.customerName}
                  </p>
                </div>

                {loadingMarkers ? (
                  <div className="flex justify-center py-12">
                    <FiberLoadingAnimation />
                  </div>
                ) : markers.length === 0 ? (
                  <EmptyState icon={IconMapPin} title="No markers on this project yet" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {markers.map((m) => (
                      <Card key={m._id} className="overflow-hidden">
                        <CardContent className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{m.markerNumber}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {m.type} · {m.address || "no address"}
                              </p>
                            </div>
                            <StatusPill status={m.status} />
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-1.5">
                            {QUICK_STATUSES.map((qs) => (
                              <Button
                                key={qs.value}
                                variant={m.status === qs.value ? "default" : "outline"}
                                size="sm"
                                className="h-9 px-1 text-[11px]"
                                disabled={busy}
                                onClick={() => quickStatus(m, qs.value)}
                              >
                                <qs.icon className="mr-1 size-3.5" />
                                {qs.label}
                              </Button>
                            ))}
                          </div>

                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 text-[11px]"
                              onClick={() => setSheet(m)}
                            >
                              <IconPlus className="mr-1 size-3.5" />
                              Add billing
                            </Button>
                            <PhotoUploader
                              projectId={active._id}
                              markerId={m._id}
                              caption={m.markerNumber + " " + m.type}
                              compact
                              label="Add photo"
                              className="w-full"
                              onUploaded={() => enqueue(m.markerNumber + " · photo uploaded")}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ---- sync queue ---- */}
            {queue.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sync Queue
                </p>
                <Card>
                  <ul className="divide-y">
                    {queue.map((q) => (
                      <li key={q.id} className="flex items-center gap-2 px-3 py-2">
                        {q.synced ? (
                          <IconCloudCheck className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <IconRefresh className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate text-xs">{q.label}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {q.synced ? "Synced" : "Pending"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- report sheet ---- */}
      {sheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setSheet(null)}
        >
          <Card
            className="w-full rounded-b-none sm:max-w-sm sm:rounded-b-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="space-y-3 py-4">
              <div>
                <p className="text-sm font-semibold">{sheet.markerNumber}</p>
                <p className="text-xs text-muted-foreground">{sheet.type}</p>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Billing code</Label>
                <Select value={codeId} onValueChange={setCodeId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pick a code" />
                  </SelectTrigger>
                  <SelectContent>
                    {codes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.code} — {c.name} ({c.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="fa-qty" className="text-xs">Quantity</Label>
                <Input
                  id="fa-qty"
                  type="number"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="480"
                  className="h-10 text-base"
                />
              </div>

              {codeId && qty && (
                <p className="rounded-md bg-muted px-3 py-2 text-xs">
                  Bills at{" "}
                  <span className="font-semibold tabular-nums">
                    {money((codes.find((c) => c._id === codeId)?.adminPrice || 0) * Number(qty || 0))}
                  </span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" className="h-10" onClick={() => setSheet(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button className="h-10" onClick={submitReport} disabled={busy}>
                  {busy ? "Saving..." : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
