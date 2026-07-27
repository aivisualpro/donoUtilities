"use client";

import * as React from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconMinus,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconTypography,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { humanizeStatus } from "@/lib/fiber-app";

/* ---------- Types ---------- */

export interface PlanMarker {
  _id: string;
  markerNumber: string;
  type: string;
  status: string;
  address?: string;
  planX: number;
  planY: number;
  planPage?: number;
}

export interface PlanAnnotation {
  _id: string;
  text: string;
  planX: number;
  planY: number;
  planPage?: number;
  color?: string;
}

export interface PlanLine {
  _id: string;
  lineNumber: string;
  type: string;
  status: string;
  footage?: number;
  points?: { x: number; y: number }[];
  planPage?: number;
}

export const MARKER_TONE: Record<string, string> = {
  not_started: "var(--muted-foreground)",
  in_progress: "var(--chart-4)",
  completed: "var(--chart-2)",
  inspection_pending: "var(--chart-5)",
  inspection_approved: "var(--chart-2)",
  ready_for_billing: "var(--chart-1)",
  invoiced: "var(--chart-3)",
};

export type PlanTool = "pan" | "report" | "notation" | "line";

interface PlanViewerProps {
  planFileName?: string;
  /** URL of the stored PDF (served from GridFS). */
  planUrl?: string;
  pageCount?: number;
  markers: PlanMarker[];
  lines?: PlanLine[];
  annotations?: PlanAnnotation[];
  tool: PlanTool;
  onToolChange: (t: PlanTool) => void;
  onMarkerClick?: (m: PlanMarker) => void;
  /** Marker / notation placement in normalised 0..1 plan coordinates. */
  onPlace?: (tool: PlanTool, x: number, y: number, page: number) => void;
  /** Fired when a drawn polyline is finished. */
  onLineComplete?: (points: { x: number; y: number }[], page: number) => void;
  /** Reports the real page count once the PDF is parsed. */
  onPageCountChange?: (n: number) => void;
  onDownload?: () => void;
  className?: string;
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 8;
const BASE_W = 900;      // CSS width of the plan canvas
const SUPERSAMPLE = 2.5; // render at this multiple so zooming stays crisp

export function PlanViewer({
  planFileName,
  planUrl,
  pageCount = 1,
  markers,
  lines = [],
  annotations = [],
  tool,
  onToolChange,
  onMarkerClick,
  onPlace,
  onLineComplete,
  onPageCountChange,
  onDownload,
  className,
}: PlanViewerProps) {
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [page, setPage] = React.useState(1);
  const [dragging, setDragging] = React.useState(false);
  const [draft, setDraft] = React.useState<{ x: number; y: number }[]>([]);
  const [pdfPages, setPdfPages] = React.useState(pageCount);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [ratio, setRatio] = React.useState(1.414); // width / height

  const dragStart = React.useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = React.useRef<any>(null);
  const renderTaskRef = React.useRef<{ cancel: () => void } | null>(null);

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const reset = React.useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  /* ---------- load the PDF ---------- */
  React.useEffect(() => {
    let cancelled = false;
    if (!planUrl) {
      docRef.current = null;
      setPdfPages(pageCount);
      setPdfError(null);
      return;
    }

    (async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const doc = await pdfjs.getDocument({ url: planUrl }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setPdfPages(doc.numPages);
        setPage((p) => Math.min(p, doc.numPages));
        onPageCountChange?.(doc.numPages);
      } catch (err) {
        if (!cancelled) {
          console.error("[PlanViewer] PDF load failed", err);
          setPdfError("Could not render this PDF");
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // onPageCountChange intentionally omitted — callers pass inline fns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planUrl, pageCount]);

  /* ---------- render the current page ---------- */
  React.useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    (async () => {
      try {
        renderTaskRef.current?.cancel();
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;

        const base = pdfPage.getViewport({ scale: 1 });
        setRatio(base.width / base.height);

        const scale = (BASE_W * SUPERSAMPLE) / base.width;
        const viewport = pdfPage.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const task = pdfPage.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (!cancelled && name !== "RenderingCancelledException") {
          console.error("[PlanViewer] page render failed", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [page, planUrl, pdfLoading]);

  /* ---------- ctrl/cmd + wheel zoom ---------- */
  React.useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------- keyboard: finish / cancel a line ---------- */
  React.useEffect(() => {
    if (tool !== "line") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft([]);
        onToolChange("pan");
      }
      if (e.key === "Enter" && draft.length >= 2) {
        onLineComplete?.(draft, page);
        setDraft([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, draft, page, onLineComplete, onToolChange]);

  React.useEffect(() => {
    if (tool !== "line") setDraft([]);
  }, [tool]);

  /* ---------- pan ---------- */
  function onPointerDown(e: React.PointerEvent) {
    if (tool !== "pan") return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  }
  function onPointerUp() {
    setDragging(false);
  }

  /* ---------- click to place / draw ---------- */
  function planCoords(e: React.MouseEvent): { x: number; y: number } | null {
    const canvasEl = e.currentTarget.querySelector("[data-plan-canvas]") as HTMLElement | null;
    const box = (canvasEl || e.currentTarget).getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  }

  function onSurfaceClick(e: React.MouseEvent) {
    if (tool === "pan") return;
    const pt = planCoords(e);
    if (!pt) return;
    if (tool === "line") {
      setDraft((d) => [...d, pt]);
      return;
    }
    onPlace?.(tool, pt.x, pt.y, page);
  }

  function onSurfaceDoubleClick(e: React.MouseEvent) {
    if (tool !== "line") return;
    e.preventDefault();
    const pts = draft.length >= 2 ? draft : null;
    if (pts) {
      onLineComplete?.(pts, page);
      setDraft([]);
    }
  }

  const visibleMarkers = markers.filter((m) => (m.planPage || 1) === page);
  const visibleAnnotations = annotations.filter((a) => (a.planPage || 1) === page);
  const visibleLines = lines.filter((l) => (l.planPage || 1) === page && (l.points?.length || 0) > 1);
  const totalPages = planUrl ? pdfPages : pageCount;
  const cursor = tool === "pan" ? (dragging ? "grabbing" : "grab") : "crosshair";

  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-md border bg-card", className)}>
      {/* ---------- toolbar ---------- */}
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
            <IconChevronLeft className="size-3.5" />
          </Button>
          <span className="min-w-[46px] text-center text-[11px] tabular-nums text-muted-foreground">
            {page}/{totalPages}
          </span>
          <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
            <IconChevronRight className="size-3.5" />
          </Button>
        </div>

        <span className="truncate text-[11px] text-muted-foreground">
          {pdfLoading ? "Rendering print..." : planFileName || "No print uploaded"}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom((z) => clampZoom(z * 0.85))} aria-label="Zoom out">
            <IconMinus className="size-3.5" />
          </Button>
          <span className="min-w-[46px] text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom((z) => clampZoom(z * 1.15))} aria-label="Zoom in">
            <IconPlus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={reset} aria-label="Reset view">
            <IconRefresh className="size-3.5" />
          </Button>
          {onDownload && (
            <Button variant="outline" size="sm" className="ml-1 h-7 text-[11px]" onClick={onDownload}>
              <IconDownload className="mr-1 size-3.5" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* ---------- surface ---------- */}
      <div
        ref={surfaceRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-muted/20"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onSurfaceClick}
        onDoubleClick={onSurfaceDoubleClick}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            transform:
              "translate(-50%, -50%) translate(" + offset.x + "px, " + offset.y + "px) scale(" + zoom + ")",
            transition: dragging ? "none" : "transform 120ms ease-out",
          }}
        >
          <div
            data-plan-canvas
            className="relative overflow-hidden rounded-sm border bg-background shadow-sm"
            style={{ width: BASE_W, aspectRatio: String(ratio) }}
          >
            {planUrl && !pdfError ? (
              <canvas ref={canvasRef} className="block size-full" />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
            )}

            {/* saved lines + in-progress draft */}
            <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
              {visibleLines.map((l) => (
                <polyline
                  key={l._id}
                  points={(l.points || []).map((p) => p.x + "," + p.y).join(" ")}
                  fill="none"
                  stroke={MARKER_TONE[l.status] || "var(--chart-1)"}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {draft.length > 1 && (
                <polyline
                  points={draft.map((p) => p.x + "," + p.y).join(" ")}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* draft vertices */}
            {draft.map((p, i) => (
              <span
                key={i}
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
                style={{ left: p.x * 100 + "%", top: p.y * 100 + "%", background: "var(--primary)" }}
              />
            ))}

            {/* annotations */}
            {visibleAnnotations.map((a) => (
              <div
                key={a._id}
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border bg-background/95 px-1.5 py-0.5 text-[9px] font-medium shadow-sm"
                style={{ left: a.planX * 100 + "%", top: a.planY * 100 + "%", color: a.color || "var(--foreground)" }}
              >
                {a.text}
              </div>
            ))}

            {/* markers */}
            {visibleMarkers.map((m) => (
              <button
                key={m._id}
                onClick={(e) => { e.stopPropagation(); onMarkerClick?.(m); }}
                title={m.markerNumber + " · " + m.type + " · " + humanizeStatus(m.status)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background transition-transform hover:scale-150 focus:scale-150 focus:outline-none"
                style={{
                  left: m.planX * 100 + "%",
                  top: m.planY * 100 + "%",
                  width: 11, height: 11,
                  background: MARKER_TONE[m.status] || "var(--muted-foreground)",
                }}
              />
            ))}

            {!planUrl && !markers.length && !annotations.length && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Upload a PDF print, or click <span className="mx-1 font-medium">Report</span> to drop a marker
              </div>
            )}
          </div>
        </div>

        {pdfError && (
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-[11px] font-medium text-white shadow-md">
            <IconAlertTriangle className="size-3.5" />
            {pdfError}
          </div>
        )}

        {/* ---------- floating tools ---------- */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Button size="sm" variant={tool === "report" ? "default" : "secondary"} className="h-8 shadow-md"
            onClick={() => onToolChange(tool === "report" ? "pan" : "report")}>
            <IconPlus className="mr-1 size-3.5" />Report
          </Button>
          <Button size="sm" variant={tool === "notation" ? "default" : "outline"} className="h-8 bg-background shadow-md"
            onClick={() => onToolChange(tool === "notation" ? "pan" : "notation")}>
            <IconTypography className="mr-1 size-3.5" />Notation
          </Button>
          <Button size="sm" variant={tool === "line" ? "default" : "outline"} className="h-8 bg-background shadow-md"
            onClick={() => onToolChange(tool === "line" ? "pan" : "line")}>
            <IconRoute className="mr-1 size-3.5" />Line
          </Button>
        </div>

        {/* ---------- line draft controls ---------- */}
        {tool === "line" && draft.length > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md border bg-background/95 px-2 py-1.5 shadow-md">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {draft.length} point{draft.length === 1 ? "" : "s"}
            </span>
            <Button size="sm" className="h-7 text-[11px]" disabled={draft.length < 2}
              onClick={() => { onLineComplete?.(draft, page); setDraft([]); }}>
              <IconCheck className="mr-1 size-3.5" />Finish
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setDraft([])}>
              <IconX className="size-3.5" />
            </Button>
          </div>
        )}

        {tool !== "pan" && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-md">
            {tool === "report"
              ? "Click the plan to drop a marker"
              : tool === "notation"
              ? "Click the plan to place a note"
              : "Click to add points · double-click or Enter to finish · Esc to cancel"}
          </div>
        )}
      </div>
    </div>
  );
}
