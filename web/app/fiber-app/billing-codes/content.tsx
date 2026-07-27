"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconFileImport, IconTags } from "@tabler/icons-react";

import { FaListPage } from "@/components/fiber-app/fa-list-page";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ColumnDef } from "@/components/data-table";
import { money } from "@/lib/fiber-app";

interface Code {
  _id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  teamPrice: number;
  adminPrice: number;
}

interface PreviewRow {
  code: string;
  name: string;
  unit: string;
  teamPrice: number;
  adminPrice: number;
  category: string;
}

const columns: ColumnDef<Code>[] = [
  { label: "Code", key: "code", width: "110px" },
  { label: "Description", key: "name" },
  { label: "Category", key: "category", type: "badge", width: "140px" },
  { label: "Unit", key: "unit", width: "80px" },
  { label: "Crew Rate", key: "teamPrice", type: "dollar", width: "120px" },
  { label: "Bill Rate", key: "adminPrice", type: "dollar", width: "120px" },
  { label: "Margin", key: "_margin", width: "120px" },
];

const SAMPLE = `UG-100\tUnderground Conduit 1.25in\tft\t4.15\t6.75\tUnderground
AE-100\tAerial Strand Placement\tft\t1.85\t3.10\tAerial
DR-100\tResidential Drop\tea\t175\t285\tDrops`;

export function BillingCodesContent() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState<PreviewRow[] | null>(null);
  const [skipped, setSkipped] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  const baseFilters = React.useMemo(
    () => ({ _r: String(reloadToken) }),
    [reloadToken]
  );

  async function runParse() {
    if (!text.trim()) {
      toast.error("Paste some rows first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/billing-codes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, dryRun: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not parse that");
      setPreview(json.preview);
      setSkipped(json.skipped || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse that");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const res = await fetch("/api/fiber-app/billing-codes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Import failed");
      toast.success(
        json.created + " code" + (json.created === 1 ? "" : "s") + " added, " +
        json.updated + " updated"
      );
      setOpen(false);
      setText("");
      setPreview(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FaListPage<Code>
        title="Billing Codes"
        description="Unit-price catalogue used by every field report"
        apiUrl="/api/fiber-app/billing-codes"
        baseFilters={baseFilters}
        columns={columns}
        searchPlaceholder="Search codes..."
        emptyIcon={<IconTags className="size-8 opacity-40" />}
        emptyMessage="No billing codes yet — import your price list to get started"
        actions={
          <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
            <IconFileImport className="mr-1 size-3.5" />
            Import codes
          </Button>
        }
        filters={[
          { param: "category", optionsKey: "categories", placeholder: "category", allLabel: "All Categories", className: "w-[160px]" },
          { param: "unit", optionsKey: "units", placeholder: "unit", allLabel: "All Units", className: "w-[110px]" },
        ]}
        renderCell={(row, col) => {
          if (col.key !== "_margin") return undefined;
          const m = (row.adminPrice || 0) - (row.teamPrice || 0);
          const pct = row.adminPrice ? Math.round((m / row.adminPrice) * 100) : 0;
          return (
            <span className="whitespace-nowrap tabular-nums">
              {money(m)}
              <span className="ml-1 text-[11px] text-muted-foreground">({pct}%)</span>
            </span>
          );
        }}
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) { setPreview(null); setText(""); }
        }}
      >
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Import billing codes</DialogTitle>
            <DialogDescription>
              Paste straight from a spreadsheet. Columns:{" "}
              <span className="font-medium">Code, Description, Unit, Crew Rate, Bill Rate, Category</span>.
              A header row is detected and skipped; existing codes are updated in place.
            </DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="fa-import" className="text-xs">Paste rows</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setText(SAMPLE)}
                >
                  Use a sample
                </Button>
              </div>
              <textarea
                id="fa-import"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                spellCheck={false}
                placeholder={"UG-100\tUnderground Conduit 1.25in\tft\t4.15\t6.75\tUnderground"}
                className="w-full resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Tabs or commas both work. Unit falls back to <code className="font-mono">ea</code>,
                and Bill Rate falls back to Crew Rate when blank.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{preview.length}</span> code
                {preview.length === 1 ? "" : "s"} parsed
                {skipped > 0 && <> · {skipped} row{skipped === 1 ? "" : "s"} skipped</>}
              </p>
              <div className="max-h-[320px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Code</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Unit</TableHead>
                      <TableHead className="text-xs">Crew</TableHead>
                      <TableHead className="text-xs">Bill</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={r.code + i}>
                        <TableCell className="text-xs font-medium">{r.code}</TableCell>
                        <TableCell className="text-xs">{r.name}</TableCell>
                        <TableCell className="text-xs">{r.unit}</TableCell>
                        <TableCell className="text-xs tabular-nums">{money(r.teamPrice)}</TableCell>
                        <TableCell className="text-xs tabular-nums">{money(r.adminPrice)}</TableCell>
                        <TableCell className="text-xs">{r.category}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {preview ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setPreview(null)} disabled={busy}>
                  Back to paste
                </Button>
                <Button size="sm" onClick={commit} disabled={busy}>
                  {busy ? "Importing..." : "Import " + preview.length + " codes"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" onClick={runParse} disabled={busy}>
                  {busy ? "Parsing..." : "Preview"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
