"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconCamera, IconMapPin, IconUpload } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PhotoUploaderProps {
  projectId: string;
  markerId?: string;
  caption?: string;
  onUploaded?: () => void;
  /** Compact renders a single button instead of a drop zone. */
  compact?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Best-effort browser GPS so photos land geotagged like the mobile app. */
function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
    );
  });
}

export function PhotoUploader({
  projectId,
  markerId,
  caption,
  onUploaded,
  compact,
  label = "Add photos",
  className,
  disabled,
}: PhotoUploaderProps) {
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (!list.length) return;
    if (!projectId) {
      toast.error("Pick a project first");
      return;
    }

    setBusy(true);
    try {
      const gps = await getPosition();
      const fd = new FormData();
      fd.append("projectId", projectId);
      if (markerId) fd.append("markerId", markerId);
      if (caption) fd.append("caption", caption);
      if (gps) {
        fd.append("lat", String(gps.lat));
        fd.append("lng", String(gps.lng));
      }
      list.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/fiber-app/photos/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      const rejected = json.rejected?.length || 0;
      toast.success(
        json.count + " photo" + (json.count === 1 ? "" : "s") + " uploaded" +
        (gps ? " with GPS" : "") +
        (rejected ? " · " + rejected + " skipped" : "")
      );
      onUploaded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      capture={compact ? "environment" : undefined}
      className="hidden"
      onChange={(e) => {
        if (e.target.files) upload(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <Button
          variant="secondary"
          size="sm"
          className={cn("h-9 text-[11px]", className)}
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
        >
          <IconCamera className="mr-1 size-3.5" />
          {busy ? "Uploading..." : label}
        </Button>
      </>
    );
  }

  return (
    <>
      {input}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) upload(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors hover:bg-accent/40",
          dragOver && "border-primary bg-accent/40",
          disabled && "pointer-events-none opacity-50",
          className
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <IconUpload className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">
          {busy ? "Uploading..." : "Drag photos here, or click to choose"}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <IconMapPin className="size-3" />
          JPG, PNG, WebP or HEIC · up to 12 MB each · GPS-tagged automatically
        </p>
      </div>
    </>
  );
}
