"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconCamera, IconMapPin, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
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

export interface GridPhoto {
  _id: string;
  caption: string;
  url?: string;
  fileId?: string;
  takenBy: string;
  takenAt: string;
  lat?: number | null;
  lng?: number | null;
  projectName?: string;
}

function fmt(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Gallery with real thumbnails, plus caption edit and delete. */
export function PhotoGrid({
  photos,
  onChanged,
  showProject,
}: {
  photos: GridPhoto[];
  onChanged?: () => void;
  showProject?: boolean;
}) {
  const [active, setActive] = React.useState<GridPhoto | null>(null);
  const [caption, setCaption] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);

  React.useEffect(() => {
    if (active) { setCaption(active.caption || ""); setConfirm(false); }
  }, [active]);

  async function save() {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/photos/" + active._id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Caption updated");
      setActive(null);
      onChanged?.();
    } catch {
      toast.error("Could not update the caption");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!active) return;
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/photos/" + active._id, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      toast.success("Photo deleted");
      setActive(null);
      onChanged?.();
    } catch {
      toast.error("Could not delete the photo");
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {photos.map((p) => (
          <Card
            key={p._id}
            className="cursor-pointer overflow-hidden pt-0 transition-shadow hover:shadow-md"
            onClick={() => setActive(p)}
          >
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/50">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.caption || "Field photo"}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <IconCamera className="size-7 text-muted-foreground/50" />
              )}
            </div>
            <CardContent className="space-y-0.5 px-3 pb-3">
              <p className="truncate text-xs font-medium" title={p.caption}>{p.caption || "Untitled"}</p>
              {showProject && p.projectName && (
                <p className="truncate text-[11px] text-muted-foreground">{p.projectName}</p>
              )}
              <p className="text-[11px] text-muted-foreground">{p.takenBy}</p>
              <p className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                {p.lat ? (
                  <>
                    <IconMapPin className="size-2.5" />
                    {p.lat.toFixed(4)}, {(p.lng ?? 0).toFixed(4)}
                  </>
                ) : (
                  "no GPS"
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Photo</DialogTitle>
            <DialogDescription>
              {active ? active.takenBy + " · " + fmt(active.takenAt) : ""}
            </DialogDescription>
          </DialogHeader>

          {active?.url && (
            <div className="overflow-hidden rounded-md border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.url} alt={active.caption} className="max-h-[52vh] w-full object-contain" />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="fa-cap" className="text-xs">Caption</Label>
            <Input id="fa-cap" value={caption} onChange={(e) => setCaption(e.target.value)} className="h-9" />
          </div>

          {active?.lat ? (
            <p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <IconMapPin className="size-3" />
              {active.lat.toFixed(5)}, {(active.lng ?? 0).toFixed(5)}
            </p>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <Button variant={confirm ? "destructive" : "outline"} size="sm" onClick={remove} disabled={busy}>
              <IconTrash className="mr-1 size-3.5" />
              {confirm ? "Really delete?" : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setActive(null)} disabled={busy}>Close</Button>
              <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
