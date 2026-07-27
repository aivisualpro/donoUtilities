"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconTrash } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

/* ---------- Field definition ---------- */

export interface FaField {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "date" | "textarea" | "email" | "tel";
  /** Static options for a select. */
  options?: readonly string[];
  /** Pull options from the list API's filterOptions payload instead. */
  optionsKey?: string;
  required?: boolean;
  placeholder?: string;
  /** Render at half width inside the 2-column grid. */
  half?: boolean;
  /** Hide from the form but keep on the record (e.g. computed fields). */
  hidden?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FaRecord = Record<string, any> & { _id?: string };

interface FaRecordDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Singular entity name, e.g. "Customer". */
  entityLabel: string;
  fields: FaField[];
  /** Base collection URL — POST here, PATCH/DELETE at `${apiUrl}/${id}`. */
  apiUrl: string;
  /** Existing record to edit; omit to create. */
  record?: FaRecord | null;
  /** Extra values merged into the payload (e.g. projectId). */
  extra?: Record<string, unknown>;
  /** Options resolved from the list response, keyed by `optionsKey`. */
  filterOptions?: Record<string, string[]>;
  allowDelete?: boolean;
  onSaved?: () => void;
}

function initialValues(fields: FaField[], record?: FaRecord | null): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) {
    const raw = record?.[f.key];
    if (raw === null || raw === undefined) { v[f.key] = ""; continue; }
    if (f.type === "date") {
      const d = new Date(raw);
      v[f.key] = isNaN(d.getTime()) ? String(raw) : d.toISOString().slice(0, 10);
    } else {
      v[f.key] = String(raw);
    }
  }
  return v;
}

export function FaRecordDialog({
  open,
  onOpenChange,
  entityLabel,
  fields,
  apiUrl,
  record,
  extra,
  filterOptions,
  allowDelete = true,
  onSaved,
}: FaRecordDialogProps) {
  const isEdit = !!record?._id;
  const visible = React.useMemo(() => fields.filter((f) => !f.hidden), [fields]);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    initialValues(fields, record)
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues(fields, record));
      setConfirmDelete(false);
    }
  }, [open, record, fields]);

  function set(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function save() {
    for (const f of visible) {
      if (f.required && !String(values[f.key] || "").trim()) {
        toast.error(f.label + " is required");
        return;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = { ...(extra || {}) };
    for (const f of fields) {
      const raw = values[f.key];
      if (raw === undefined) continue;
      if (f.type === "number") {
        if (raw === "") continue;
        payload[f.key] = Number(raw);
      } else {
        payload[f.key] = raw;
      }
    }

    setBusy(true);
    try {
      const url = isEdit ? apiUrl + "/" + record!._id : apiUrl;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Save failed");
      toast.success(entityLabel + (isEdit ? " updated" : " created"));
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!record?._id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      const res = await fetch(apiUrl + "/" + record._id, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete failed");
      toast.success(entityLabel + " deleted");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit " : "New "}{entityLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this " + entityLabel.toLowerCase() + ", or delete it."
              : "Fill in the details below."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto px-0.5 py-1">
          {visible.map((f) => {
            const opts = f.options
              ? [...f.options]
              : f.optionsKey
              ? filterOptions?.[f.optionsKey] || []
              : [];
            return (
              <div key={f.key} className={cn("grid gap-1.5", f.half ? "col-span-1" : "col-span-2")}>
                <Label htmlFor={"fa-fld-" + f.key} className="text-xs">
                  {f.label}
                  {f.required && <span className="ml-0.5 text-destructive">*</span>}
                </Label>

                {f.type === "select" ? (
                  <Select value={values[f.key] || ""} onValueChange={(v) => set(f.key, v)}>
                    <SelectTrigger id={"fa-fld-" + f.key} className="h-9">
                      <SelectValue placeholder={f.placeholder || "Select..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <textarea
                    id={"fa-fld-" + f.key}
                    value={values[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : (
                  <Input
                    id={"fa-fld-" + f.key}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                    value={values[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="h-9"
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <div>
            {isEdit && allowDelete && (
              <Button
                variant={confirmDelete ? "destructive" : "outline"}
                size="sm"
                onClick={remove}
                disabled={busy}
              >
                <IconTrash className="mr-1 size-3.5" />
                {confirmDelete ? "Really delete?" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving..." : isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
