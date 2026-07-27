"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconMap2 } from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import { Card, CardContent } from "@/components/ui/card";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import { EmptyState, SectionCard, StatusPill } from "@/components/fiber-app/fa-kit";
import { humanizeStatus } from "@/lib/fiber-app";

interface Marker {
  _id: string;
  markerNumber: string;
  projectName: string;
  type: string;
  status: string;
  address: string;
  reportedBy: string;
  lat: number;
  lng: number;
}

const TONE: Record<string, string> = {
  not_started: "var(--muted-foreground)",
  in_progress: "var(--chart-4)",
  completed: "var(--chart-2)",
  inspection_pending: "var(--chart-5)",
  inspection_approved: "var(--chart-2)",
  ready_for_billing: "var(--chart-1)",
  invoiced: "var(--chart-3)",
};

export function MapContent() {
  const [markers, setMarkers] = React.useState<Marker[]>([]);
  const [options, setOptions] = React.useState<Record<string, string[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [project, setProject] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [hover, setHover] = React.useState<Marker | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: "1" });
        if (project !== "all") params.set("project", project);
        if (status !== "all") params.set("status", status);
        const res = await fetch("/api/fiber-app/markers?" + params.toString());
        const json = await res.json();
        setMarkers((json.data || []).filter((m: Marker) => m.lat && m.lng));
        if (json.filterOptions) setOptions(json.filterOptions);
      } catch {
        toast.error("Could not load the map");
      } finally {
        setLoading(false);
      }
    })();
  }, [project, status]);

  // Normalise lat/lng into the plot box
  const bounds = React.useMemo(() => {
    if (!markers.length) return null;
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      dLat: maxLat - minLat || 1,
      dLng: maxLng - minLng || 1,
    };
  }, [markers]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of markers) c[m.status] = (c[m.status] || 0) + 1;
    return c;
  }, [markers]);

  return (
    <>
      <PageHeader
        title="Map View"
        description="Every reported marker, plotted by GPS"
        filters={
          <>
            <FilterSelect
              value={project}
              onValueChange={setProject}
              placeholder="project"
              allLabel="All Projects"
              options={options.projects || []}
              className="w-[180px]"
            />
            <FilterSelect
              value={status}
              onValueChange={setStatus}
              placeholder="status"
              allLabel="All Statuses"
              options={options.statuses || []}
              className="w-[170px]"
            />
          </>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <FiberLoadingAnimation />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {!markers.length || !bounds ? (
            <EmptyState
              icon={IconMap2}
              title="No GPS-tagged markers"
              message="Markers reported from the field carry GPS coordinates and will appear here."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-4">
              <Card className="relative overflow-hidden lg:col-span-3">
                <div className="relative aspect-[16/10] w-full bg-muted/20">
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                      backgroundSize: "48px 48px",
                    }}
                  />
                  {markers.map((m) => {
                    const x = ((m.lng - bounds.minLng) / bounds.dLng) * 92 + 4;
                    const y = (1 - (m.lat - bounds.minLat) / bounds.dLat) * 88 + 6;
                    return (
                      <button
                        key={m._id}
                        onMouseEnter={() => setHover(m)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(m)}
                        onBlur={() => setHover(null)}
                        title={m.markerNumber}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background transition-transform hover:scale-[1.8] focus:scale-[1.8] focus:outline-none"
                        style={{
                          left: x + "%",
                          top: y + "%",
                          width: 11,
                          height: 11,
                          background: TONE[m.status] || "var(--muted-foreground)",
                        }}
                      />
                    );
                  })}

                  {hover && (
                    <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-popover/95 px-3 py-2 shadow-md backdrop-blur">
                      <p className="text-xs font-semibold">{hover.markerNumber}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {hover.type} · {hover.projectName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{hover.address}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {hover.lat.toFixed(5)}, {hover.lng.toFixed(5)}
                      </p>
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-wrap gap-x-4 gap-y-1.5 border-t py-2.5">
                  {Object.entries(TONE).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: v }} />
                      {humanizeStatus(k)}
                      {counts[k] ? <span className="tabular-nums">({counts[k]})</span> : null}
                    </span>
                  ))}
                </CardContent>
              </Card>

              <SectionCard title="Markers" description={markers.length + " plotted"} bodyClassName="p-0">
                <ul className="max-h-[520px] divide-y overflow-auto">
                  {markers.map((m) => (
                    <li
                      key={m._id}
                      className="flex items-start gap-2 px-3 py-2 hover:bg-accent/50"
                      onMouseEnter={() => setHover(m)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span
                        className="mt-1 size-2 shrink-0 rounded-full"
                        style={{ background: TONE[m.status] || "var(--muted-foreground)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{m.markerNumber}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{m.address}</p>
                      </div>
                      <StatusPill status={m.status} className="scale-90" />
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          )}
        </div>
      )}
    </>
  );
}
