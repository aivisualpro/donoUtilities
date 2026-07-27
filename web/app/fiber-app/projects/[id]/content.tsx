"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconCamera,
  IconChecklist,
  IconCircleCheck,
  IconClipboardCheck,
  IconDownload,
  IconFileTypePdf,
  IconFolder,
  IconMap,
  IconMapPin,
  IconPhoto,
  IconReceipt2,
  IconShieldLock,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import {
  BarList,
  EmptyState,
  ProgressBar,
  SectionCard,
  StatCard,
  StatusPill,
} from "@/components/fiber-app/fa-kit";
import {
  MARKER_TONE,
  PlanViewer,
  type PlanTool,
} from "@/components/fiber-app/plan-viewer";
import {
  LINE_TYPES,
  MARKER_TYPES,
  ROLES,
  ROLE_META,
  capabilitiesFor,
  compactMoney,
  humanizeStatus,
  money,
} from "@/lib/fiber-app";

/* ---------- Types ---------- */

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
  planFileName: string;
  planUrl: string;
  planFileId?: string;
  planPageCount?: number;
  startDate: string;
  dueDate: string;
}

interface Marker {
  _id: string;
  markerNumber: string;
  type: string;
  status: string;
  address: string;
  reportedBy: string;
  reportedAt: string;
  planX: number;
  planY: number;
  planPage?: number;
}

interface Line {
  _id: string;
  lineNumber: string;
  type: string;
  footage: number;
  status: string;
  street: string;
  reportedBy: string;
}

interface Entry {
  _id: string;
  codeName: string;
  unit: string;
  quantity: number;
  adminRate: number;
  total: number;
  status: string;
  reportedBy: string;
  reportedAt: string;
}

interface Batch {
  _id: string;
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

interface Photo { _id: string; caption: string; takenBy: string; takenAt: string; lat: number; lng: number }
interface FormRow { _id: string; templateName: string; submittedBy: string; submittedAt: string }
interface DocRow { _id: string; name: string; folder: string; sizeKb: number; uploadedBy: string }
interface ActivityRow { _id: string; message: string; actor: string; createdAt: string }
interface Annotation { _id: string; text: string; planX: number; planY: number; planPage?: number }
interface Code { _id: string; code: string; name: string; unit: string; adminPrice: number }

interface Stats {
  markerCount: number; completedMarkers: number; percentComplete: number;
  lineCount: number; totalFootage: number; photoCount: number; formCount: number;
  documentCount: number; awaitingInspection: number; reportedValue: number;
  teamValue: number; margin: number; invoicedValue: number; readyValue: number;
  budget: number; budgetUsedPercent: number;
}

interface Payload {
  project: Project;
  markers: Marker[]; lines: Line[]; photos: Photo[]; entries: Entry[];
  batches: Batch[]; forms: FormRow[]; documents: DocRow[];
  activity: ActivityRow[]; annotations?: Annotation[];
  stats: Stats;
}

type View = "map" | "markers" | "photos" | "forms" | "billing" | "documents" | "permissions";

const NAV: { key: View; label: string; icon: typeof IconMap }[] = [
  { key: "map", label: "Map", icon: IconMap },
  { key: "markers", label: "Markers", icon: IconMapPin },
  { key: "photos", label: "Photos", icon: IconPhoto },
  { key: "forms", label: "Forms", icon: IconChecklist },
  { key: "billing", label: "Billing", icon: IconReceipt2 },
  { key: "documents", label: "Documents", icon: IconFolder },
  { key: "permissions", label: "Permissions", icon: IconShieldLock },
];

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Component ---------- */

export function ProjectDetailContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [data, setData] = React.useState<Payload | null>(null);
  const [allProjects, setAllProjects] = React.useState<Project[]>([]);
  const [codes, setCodes] = React.useState<Code[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [view, setView] = React.useState<View>("map");
  const [tool, setTool] = React.useState<PlanTool>("pan");
  const [activeMarker, setActiveMarker] = React.useState<Marker | null>(null);

  // report dialog state
  const [placing, setPlacing] = React.useState<{ x: number; y: number; page: number } | null>(null);
  const [rType, setRType] = React.useState<string>(MARKER_TYPES[0]);
  const [rCode, setRCode] = React.useState("");
  const [rQty, setRQty] = React.useState("");
  const [rAddress, setRAddress] = React.useState("");

  // notation state
  const [noting, setNoting] = React.useState<{ x: number; y: number; page: number } | null>(null);
  const [noteText, setNoteText] = React.useState("");

  // line-drawing state
  const [linePts, setLinePts] = React.useState<{ points: { x: number; y: number }[]; page: number } | null>(null);
  const [lType, setLType] = React.useState<string>(LINE_TYPES[0]);
  const [lFootage, setLFootage] = React.useState("");
  const [lCode, setLCode] = React.useState("");
  const [lStreet, setLStreet] = React.useState("");

  // plan upload state
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/fiber-app/projects/" + projectId);
      if (!res.ok) throw new Error("not found");
      setData(await res.json());
    } catch {
      toast.error("Could not load this project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          fetch("/api/fiber-app/projects").then((r) => r.json()),
          fetch("/api/fiber-app/billing-codes").then((r) => r.json()),
        ]);
        setAllProjects(p.data || []);
        setCodes(c.data || []);
      } catch { /* non-fatal */ }
    })();
  }, []);

  /* ---- actions ---- */

  async function setMarkerStatus(id: string, status: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/markers/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Marker set to " + humanizeStatus(status));
      setActiveMarker(null);
      await load();
    } catch {
      toast.error("Could not update the marker");
    } finally { setBusy(false); }
  }

  function handlePlace(t: PlanTool, x: number, y: number, page: number) {
    if (t === "report") { setPlacing({ x, y, page }); return; }
    if (t === "notation") { setNoting({ x, y, page }); return; }
  }

  function handleLineComplete(points: { x: number; y: number }[], page: number) {
    setLinePts({ points, page });
  }

  /** Rough footage estimate from the drawn polyline, assuming a 1:1 plan scale hint. */
  function draftLength(points: { x: number; y: number }[]): number {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return Math.round(d * 2000); // 2000 ft across the full plan width
  }

  async function submitLine() {
    if (!linePts) return;
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: lType,
          street: lStreet,
          footage: Number(lFootage) || draftLength(linePts.points),
          points: linePts.points,
          planPage: linePts.page,
          billingCodeId: lCode || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      toast.success(
        "Line " + json.lineNumber + " saved" + (json.entry ? " · " + money(json.entry.total) : "")
      );
      setLinePts(null); setLFootage(""); setLCode(""); setLStreet(""); setTool("pan");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the line");
    } finally { setBusy(false); }
  }

  /** Upload a PDF print: page count is read client-side, then sent with the file. */
  async function uploadPlan(file: File) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      toast.error("Only PDF prints are supported");
      return;
    }
    setUploading(true);
    try {
      let pageCount = 1;
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        pageCount = doc.numPages;
      } catch {
        /* page count is a nicety — upload anyway */
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("pageCount", String(pageCount));

      const res = await fetch("/api/fiber-app/projects/" + projectId + "/plan", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");
      toast.success(file.name + " uploaded — " + pageCount + " page" + (pageCount === 1 ? "" : "s"));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the print");
    } finally { setUploading(false); }
  }

  async function submitReport() {
    if (!placing) return;
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/markers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: rType,
          status: "completed",
          address: rAddress,
          planX: placing.x,
          planY: placing.y,
          planPage: placing.page,
          billingCodeId: rCode || undefined,
          quantity: Number(rQty) || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      toast.success(
        "Reported " + json.markerNumber + (json.entry ? " · " + money(json.entry.total) : "")
      );
      setPlacing(null); setRCode(""); setRQty(""); setRAddress(""); setTool("pan");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the report");
    } finally { setBusy(false); }
  }

  async function submitNote() {
    if (!noting || !noteText.trim()) { setNoting(null); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, text: noteText.trim(),
          planX: noting.x, planY: noting.y, planPage: noting.page,
        }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Note added to the plan");
      setNoting(null); setNoteText(""); setTool("pan");
      await load();
    } catch {
      toast.error("Could not save the note");
    } finally { setBusy(false); }
  }

  async function generateBilling(markInvoiced: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, markInvoiced }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      toast.success(
        (markInvoiced ? "Invoice " + json.batch.invoiceNumber : "Billing doc " + json.batch.batchNumber) +
        " created — " + money(json.batch.total)
      );
      setView("billing");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate billing");
    } finally { setBusy(false); }
  }

  async function completeProject() {
    setBusy(true);
    try {
      await fetch("/api/fiber-app/projects/" + projectId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      toast.success("Project marked complete");
      await load();
    } catch {
      toast.error("Could not update the project");
    } finally { setBusy(false); }
  }

  /** As-built package: every marker, photo, GPS point and billing line as CSV. */
  function downloadAsBuilt() {
    if (!data) return;
    const rows: string[] = [];
    rows.push("AS-BUILT PACKAGE," + data.project.name);
    rows.push("Project #," + data.project.projectNumber);
    rows.push("Customer," + data.project.customerName);
    rows.push("Generated," + new Date().toISOString());
    rows.push("");
    rows.push("MARKERS");
    rows.push("Marker,Type,Status,Address,Reported By,Reported,Plan X,Plan Y");
    data.markers.forEach((m) =>
      rows.push([m.markerNumber, m.type, m.status, m.address, m.reportedBy, m.reportedAt, m.planX, m.planY]
        .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
    );
    rows.push("");
    rows.push("PHOTOS (GPS-tagged)");
    rows.push("Caption,Taken By,Taken,Lat,Lng");
    data.photos.forEach((p) =>
      rows.push([p.caption, p.takenBy, p.takenAt, p.lat, p.lng]
        .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
    );
    rows.push("");
    rows.push("BILLING LINES");
    rows.push("Code,Qty,Unit,Rate,Total,Status");
    data.entries.forEach((e) =>
      rows.push([e.codeName, e.quantity, e.unit, e.adminRate, e.total, e.status]
        .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "as-built-" + data.project.projectNumber + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("As-built package downloaded");
  }

  /* ---- render ---- */

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <FiberLoadingAnimation />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 p-6">
        <EmptyState
          icon={IconFolder}
          title="Project not found"
          message="It may have been deleted."
          action={<Button size="sm" variant="outline" asChild><Link href="/fiber-app/projects">Back to projects</Link></Button>}
        />
      </div>
    );
  }

  const { project: p, stats: s } = data;

  return (
    <>
      <PageHeader
        title={p.name}
        description={p.projectNumber + " · " + (p.customerName || "No customer") + " · " + (p.city ? p.city + ", " + p.state : "—")}
        filters={<><StatusPill status={p.status} /><Badge variant="outline">{humanizeStatus(p.buildType)}</Badge></>}
        actions={
          <>
            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
              <Link href="/fiber-app/projects"><IconArrowLeft className="mr-1 size-3.5" />All projects</Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadAsBuilt}>
              <IconDownload className="mr-1 size-3.5" />As-Built
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => generateBilling(false)} disabled={busy || s.readyValue <= 0}>
              <IconFileTypePdf className="mr-1 size-3.5" />Generate Billing Doc
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => generateBilling(true)} disabled={busy || s.readyValue <= 0}>
              <IconReceipt2 className="mr-1 size-3.5" />Create Invoice
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* ================= PROJECT SUB-NAV ================= */}
        <aside className="hidden w-48 shrink-0 flex-col gap-3 border-r p-3 md:flex">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Project
            </p>
            <Select value={projectId} onValueChange={(v) => router.push("/fiber-app/projects/" + v)}>
              <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(allProjects.length ? allProjects : [p]).map((x) => (
                  <SelectItem key={x._id} value={x._id} className="text-xs">{x.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  view === n.key
                    ? "bg-primary font-medium text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                <n.icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-2 border-t pt-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between text-[11px]">
                <span className="text-muted-foreground">Complete</span>
                <span className="tabular-nums">{s.percentComplete}%</span>
              </div>
              <ProgressBar value={s.percentComplete} tone="var(--chart-2)" />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between text-[11px]">
                <span className="text-muted-foreground">Budget</span>
                <span className="tabular-nums">{s.budgetUsedPercent}%</span>
              </div>
              <ProgressBar value={s.budgetUsedPercent} tone={s.budgetUsedPercent > 90 ? "var(--chart-5)" : "var(--chart-1)"} />
            </div>
            {p.status !== "completed" && (
              <Button variant="outline" size="sm" className="h-8 w-full text-[11px]" onClick={completeProject} disabled={busy}>
                <IconCircleCheck className="mr-1 size-3.5" />Complete Project
              </Button>
            )}
          </div>
        </aside>

        {/* ================= VIEW ================= */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-h-full flex-col gap-4 p-4">
            {/* KPI strip */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Progress" value={s.percentComplete + "%"} hint={s.completedMarkers + " of " + s.markerCount} accent="chart2" progress={s.percentComplete} />
              <StatCard label="Reported" value={compactMoney(s.reportedValue)} hint={data.entries.length + " entries"} accent="chart1" />
              <StatCard label="Ready to Bill" value={compactMoney(s.readyValue)} hint="Approved" accent="chart4" />
              <StatCard label="Invoiced" value={compactMoney(s.invoicedValue)} hint={data.batches.length + " batches"} accent="chart3" />
              <StatCard label="Footage" value={s.totalFootage.toLocaleString() + " ft"} hint={s.lineCount + " runs"} accent="chart5" />
              <StatCard label="Budget Used" value={s.budgetUsedPercent + "%"} hint={compactMoney(s.budget)} accent="primary" progress={s.budgetUsedPercent} />
            </div>

            {/* ---- MAP ---- */}
            {view === "map" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPlan(f);
                    e.target.value = "";
                  }}
                />

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) uploadPlan(f);
                  }}
                  className={cn(
                    "rounded-md transition-colors",
                    dragOver && "ring-2 ring-primary ring-offset-2"
                  )}
                >
                  {!p.planUrl ? (
                    <div
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-14 text-center transition-colors hover:bg-accent/40",
                        dragOver && "border-primary bg-accent/40"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="rounded-full bg-muted p-3">
                        <IconUpload className="size-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">
                        {uploading ? "Uploading print..." : "Drag and drop your PDF construction prints"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        No conversion required — multi-page PDFs render right here. Max 40 MB.
                      </p>
                      <Button size="sm" variant="outline" className="mt-1 h-8 text-xs" disabled={uploading}>
                        <IconUpload className="mr-1 size-3.5" />
                        Choose a PDF
                      </Button>
                    </div>
                  ) : (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Print: <span className="font-medium text-foreground">{p.planFileName}</span>
                        {p.planPageCount ? " · " + p.planPageCount + " pages" : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7 text-[11px]"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <IconUpload className="mr-1 size-3.5" />
                        {uploading ? "Uploading..." : "Replace print"}
                      </Button>
                    </div>
                  )}
                </div>

                {p.planUrl && (
                  <PlanViewer
                    planFileName={p.planFileName}
                    planUrl={p.planUrl}
                    pageCount={p.planPageCount || 1}
                    markers={data.markers}
                    lines={data.lines}
                    annotations={data.annotations || []}
                    tool={tool}
                    onToolChange={setTool}
                    onMarkerClick={(pm) =>
                      setActiveMarker(data.markers.find((m) => m._id === pm._id) || null)
                    }
                    onPlace={handlePlace}
                    onLineComplete={handleLineComplete}
                    onDownload={downloadAsBuilt}
                    className="min-h-[560px] flex-1"
                  />
                )}

                {!p.planUrl && (
                  <PlanViewer
                    planFileName=""
                    pageCount={1}
                    markers={data.markers}
                    lines={data.lines}
                    annotations={data.annotations || []}
                    tool={tool}
                    onToolChange={setTool}
                    onMarkerClick={(pm) =>
                      setActiveMarker(data.markers.find((m) => m._id === pm._id) || null)
                    }
                    onPlace={handlePlace}
                    onLineComplete={handleLineComplete}
                    onDownload={downloadAsBuilt}
                    className="min-h-[460px] flex-1"
                  />
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {Object.entries(MARKER_TONE).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: v }} />
                      {humanizeStatus(k)}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* ---- MARKERS ---- */}
            {view === "markers" && (
              <Card className="overflow-hidden">
                <div className="max-h-[620px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Marker</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Address</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Reported By</TableHead>
                        <TableHead className="text-xs">Reported</TableHead>
                        <TableHead className="text-right text-xs">Inspection</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.markers.map((m) => (
                        <TableRow key={m._id}>
                          <TableCell className="text-xs font-medium">{m.markerNumber}</TableCell>
                          <TableCell className="text-xs">{m.type}</TableCell>
                          <TableCell className="text-xs">{m.address || "—"}</TableCell>
                          <TableCell><StatusPill status={m.status} /></TableCell>
                          <TableCell className="text-xs">{m.reportedBy || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(m.reportedAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={busy}
                                onClick={() => setMarkerStatus(m._id, "inspection_approved")}>
                                <IconClipboardCheck className="mr-1 size-3" />Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-destructive" disabled={busy}
                                onClick={() => setMarkerStatus(m._id, "inspection_rejected")}>
                                <IconX className="size-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!data.markers.length && (
                        <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">No markers reported yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {/* ---- PHOTOS ---- */}
            {view === "photos" && (
              data.photos.length === 0 ? (
                <EmptyState icon={IconCamera} title="No photos yet" message="Crews attach GPS-tagged photos as proof of every completed task." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {data.photos.map((ph) => (
                    <Card key={ph._id} className="overflow-hidden pt-0">
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted/50">
                        <IconCamera className="size-7 text-muted-foreground/50" />
                      </div>
                      <CardContent className="space-y-0.5 px-3 pb-3">
                        <p className="truncate text-xs font-medium" title={ph.caption}>{ph.caption}</p>
                        <p className="text-[11px] text-muted-foreground">{ph.takenBy}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {ph.lat ? ph.lat.toFixed(4) + ", " + ph.lng.toFixed(4) : "no GPS"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}

            {/* ---- FORMS ---- */}
            {view === "forms" && (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Form</TableHead>
                      <TableHead className="text-xs">Submitted By</TableHead>
                      <TableHead className="text-xs">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.forms.map((f) => (
                      <TableRow key={f._id}>
                        <TableCell className="text-xs font-medium">{f.templateName}</TableCell>
                        <TableCell className="text-xs">{f.submittedBy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(f.submittedAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!data.forms.length && (
                      <TableRow><TableCell colSpan={3} className="py-10 text-center text-xs text-muted-foreground">
                        <IconChecklist className="mx-auto mb-2 size-6 opacity-40" />Add a form template to fill out
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* ---- BILLING ---- */}
            {view === "billing" && (
              <>
                <div className="grid gap-4 lg:grid-cols-3">
                  <SectionCard title="Billing Batches" description="Generated documents and invoices" className="lg:col-span-2" bodyClassName="p-0">
                    {!data.batches.length ? (
                      <p className="py-10 text-center text-xs text-muted-foreground">Generate a billing document to create batches</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Batch</TableHead>
                            <TableHead className="text-xs">Period</TableHead>
                            <TableHead className="text-xs">Items</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Invoice</TableHead>
                            <TableHead className="text-right text-xs">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.batches.map((b) => (
                            <TableRow key={b._id}>
                              <TableCell className="text-xs font-medium">{b.batchNumber}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{b.periodStart} → {b.periodEnd}</TableCell>
                              <TableCell className="text-xs tabular-nums">{b.entryCount ?? "—"}</TableCell>
                              <TableCell><StatusPill status={b.status} /></TableCell>
                              <TableCell className="text-xs">{b.invoiceNumber || "—"}</TableCell>
                              <TableCell className="text-right text-xs font-medium tabular-nums">{money(b.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </SectionCard>

                  <SectionCard title="Billing Codes Summary" description="Reported quantities by code">
                    {!data.entries.length ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">Complete markers and lines to see billing data</p>
                    ) : (
                      <BarList
                        items={Object.values(
                          data.entries.reduce((acc, e) => {
                            const k = e.codeName;
                            acc[k] = acc[k] || { label: k, value: 0, qty: 0 };
                            acc[k].value += e.total; acc[k].qty += e.quantity;
                            return acc;
                          }, {} as Record<string, { label: string; value: number; qty: number }>)
                        ).sort((a, b) => b.value - a.value).slice(0, 10)
                          .map((i) => ({ label: i.label, value: Math.round(i.value), sub: Math.round(i.qty).toLocaleString() + " units" }))}
                        valueFormatter={compactMoney}
                      />
                    )}
                  </SectionCard>
                </div>

                <SectionCard title="Billing Entries" description="Every unit reported from the field" bodyClassName="p-0">
                  <div className="max-h-[420px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Code</TableHead>
                          <TableHead className="text-xs">Qty</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs">Rate</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Reported By</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.entries.map((e) => (
                          <TableRow key={e._id}>
                            <TableCell className="text-xs">{e.codeName}</TableCell>
                            <TableCell className="text-xs tabular-nums">{e.quantity?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{e.unit}</TableCell>
                            <TableCell className="text-xs tabular-nums">{money(e.adminRate)}</TableCell>
                            <TableCell><StatusPill status={e.status} /></TableCell>
                            <TableCell className="text-xs">{e.reportedBy}</TableCell>
                            <TableCell className="text-right text-xs font-medium tabular-nums">{money(e.total)}</TableCell>
                          </TableRow>
                        ))}
                        {!data.entries.length && (
                          <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">No billing entries yet</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ---- DOCUMENTS ---- */}
            {view === "documents" && (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Document</TableHead>
                      <TableHead className="text-xs">Folder</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-xs">Uploaded By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.documents.map((d) => (
                      <TableRow key={d._id}>
                        <TableCell className="text-xs font-medium">{d.name}</TableCell>
                        <TableCell className="text-xs">{d.folder}</TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {d.sizeKb >= 1024 ? (d.sizeKb / 1024).toFixed(1) + " MB" : d.sizeKb + " KB"}
                        </TableCell>
                        <TableCell className="text-xs">{d.uploadedBy}</TableCell>
                      </TableRow>
                    ))}
                    {!data.documents.length && (
                      <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">No documents uploaded</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* ---- PERMISSIONS ---- */}
            {view === "permissions" && (
              <SectionCard title="Project Permissions" description="What each role can see and edit on this project" bodyClassName="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Capability</TableHead>
                      {ROLES.map((r) => (
                        <TableHead key={r} className="text-center text-xs">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{ROLE_META[r].label}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">${ROLE_META[r].price}/mo</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {([
                      ["viewAllProjects", "View all company projects"],
                      ["createProjects", "Create projects"],
                      ["manageUsers", "Create and manage users"],
                      ["viewPricing", "View pricing"],
                      ["manageBilling", "Full billing access"],
                      ["markInvoiced", "Mark as invoiced"],
                      ["performInspections", "Perform inspections"],
                      ["reportWork", "Report progress & billing codes"],
                      ["downloadReports", "Download reports and data"],
                    ] as const).map(([key, label]) => (
                      <TableRow key={key}>
                        <TableCell className="text-xs">{label}</TableCell>
                        {ROLES.map((r) => (
                          <TableCell key={r} className="text-center">
                            {capabilitiesFor(r)[key]
                              ? <IconCircleCheck className="mx-auto size-4 text-emerald-600" />
                              : <IconX className="mx-auto size-4 text-muted-foreground/40" />}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      {/* ================= REPORT DIALOG ================= */}
      <Dialog open={!!placing} onOpenChange={(o) => { if (!o) { setPlacing(null); setTool("pan"); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Report work</DialogTitle>
            <DialogDescription>
              Dropping a marker on the plan. Pick a billing code to bill it in the same step.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Marker type</Label>
              <Select value={rType} onValueChange={setRType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fa-addr" className="text-xs">Address / location</Label>
              <Input id="fa-addr" value={rAddress} onChange={(e) => setRAddress(e.target.value)} placeholder="1420 Oak Ridge Dr" className="h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Billing code (optional)</Label>
              <Select value={rCode} onValueChange={setRCode}>
                <SelectTrigger className="h-9"><SelectValue placeholder="No billing" /></SelectTrigger>
                <SelectContent>
                  {codes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.code} — {c.name} ({c.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rCode && (
              <div className="grid gap-1.5">
                <Label htmlFor="fa-q" className="text-xs">Quantity</Label>
                <Input id="fa-q" type="number" value={rQty} onChange={(e) => setRQty(e.target.value)} placeholder="480" className="h-9" />
                {rQty && (
                  <p className="text-[11px] text-muted-foreground">
                    Bills at{" "}
                    <span className="font-semibold tabular-nums">
                      {money((codes.find((c) => c._id === rCode)?.adminPrice || 0) * Number(rQty || 0))}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setPlacing(null); setTool("pan"); }} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={submitReport} disabled={busy}>{busy ? "Saving..." : "Save report"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= NOTATION DIALOG ================= */}
      <Dialog open={!!noting} onOpenChange={(o) => { if (!o) { setNoting(null); setTool("pan"); } }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Add a notation</DialogTitle>
            <DialogDescription>This note is pinned to that spot on the print.</DialogDescription>
          </DialogHeader>
          <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Bore under driveway — 1.25in" className="h-9" autoFocus />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setNoting(null); setTool("pan"); }} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={submitNote} disabled={busy}>{busy ? "Saving..." : "Add note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= LINE DIALOG ================= */}
      <Dialog open={!!linePts} onOpenChange={(o) => { if (!o) { setLinePts(null); setTool("pan"); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Save line run</DialogTitle>
            <DialogDescription>
              {linePts
                ? linePts.points.length + " points drawn. Footage is estimated from the plan — adjust it if you measured."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Line type</Label>
              <Select value={lType} onValueChange={setLType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fa-lft" className="text-xs">Footage</Label>
                <Input
                  id="fa-lft"
                  type="number"
                  value={lFootage}
                  onChange={(e) => setLFootage(e.target.value)}
                  placeholder={linePts ? String(draftLength(linePts.points)) : "0"}
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fa-lst" className="text-xs">Street</Label>
                <Input id="fa-lst" value={lStreet} onChange={(e) => setLStreet(e.target.value)} placeholder="Oak Ridge Dr" className="h-9" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Billing code (optional)</Label>
              <Select value={lCode} onValueChange={setLCode}>
                <SelectTrigger className="h-9"><SelectValue placeholder="No billing" /></SelectTrigger>
                <SelectContent>
                  {codes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.code} — {c.name} ({c.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lCode && linePts && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs">
                Bills at{" "}
                <span className="font-semibold tabular-nums">
                  {money(
                    (codes.find((c) => c._id === lCode)?.adminPrice || 0) *
                      (Number(lFootage) || draftLength(linePts.points))
                  )}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setLinePts(null); setTool("pan"); }} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={submitLine} disabled={busy}>{busy ? "Saving..." : "Save line"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MARKER SHEET ================= */}
      {activeMarker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setActiveMarker(null)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{activeMarker.markerNumber}</p>
                  <p className="text-xs text-muted-foreground">{activeMarker.type} · {activeMarker.address || "no address"}</p>
                </div>
                <StatusPill status={activeMarker.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Reported by {activeMarker.reportedBy || "—"} on {fmtDate(activeMarker.reportedAt)}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={() => setMarkerStatus(activeMarker._id, "inspection_approved")}>
                  <IconClipboardCheck className="mr-1 size-3.5" />Approve
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => setMarkerStatus(activeMarker._id, "completed")}>
                  <IconMapPin className="mr-1 size-3.5" />Mark complete
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-full text-xs" onClick={() => setActiveMarker(null)}>Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
