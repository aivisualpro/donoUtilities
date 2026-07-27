"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  IconDatabase,
  IconDatabaseImport,
  IconTrash,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/fiber-app/fa-kit";
import { FA } from "@/lib/fiber-app";

export function SettingsContent() {
  const [busy, setBusy] = React.useState(false);

  async function seed() {
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/seed?reset=1", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      toast.success("Demo data loaded — " + json.inserted.projects + " projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/seed", { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      toast.success("All FiberApp collections cleared");
    } catch {
      toast.error("Could not clear the collections");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Data" />

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <SectionCard title="Collections" description="MongoDB collections backing FiberApp">
            <ul className="grid grid-cols-2 gap-1.5">
              {Object.values(FA).map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-[11px]">
                  <IconDatabase className="size-3 shrink-0 text-muted-foreground" />
                  <code className="truncate font-mono">{c}</code>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Demo Data" description="Populate or clear the FiberApp collections">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 justify-start text-xs"
                onClick={seed}
                disabled={busy}
              >
                <IconDatabaseImport className="mr-2 size-4" />
                Rebuild demo dataset
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 justify-start text-xs text-destructive"
                onClick={wipe}
                disabled={busy}
              >
                <IconTrash className="mr-2 size-4" />
                Clear all FiberApp data
              </Button>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Only touches collections prefixed <code className="font-mono">FiberApp_</code>. Your
                DTAP, BSPD, Splicing and Tree Trim data is never affected.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
