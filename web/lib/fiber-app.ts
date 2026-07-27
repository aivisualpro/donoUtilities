/**
 * FiberApp — shared domain model, collection names, helpers.
 *
 * Mirrors the FiberField product model:
 *   Project -> (Markers | Lines) -> Billing Entries -> Billing Batch -> Invoice
 * with Photos, Forms, Documents and Inspections hanging off the project.
 */

/* ---------- Collections (all prefixed FiberApp_) ---------- */

export const FA_DB = "DonoUtilities";

export const FA = {
  Projects: "FiberApp_Projects",
  Markers: "FiberApp_Markers",
  Lines: "FiberApp_Lines",
  Photos: "FiberApp_Photos",
  BillingCodes: "FiberApp_BillingCodes",
  BillingEntries: "FiberApp_BillingEntries",
  BillingBatches: "FiberApp_BillingBatches",
  FormTemplates: "FiberApp_FormTemplates",
  FormInstances: "FiberApp_FormInstances",
  Documents: "FiberApp_Documents",
  Customers: "FiberApp_Customers",
  Members: "FiberApp_Members",
  Inspections: "FiberApp_Inspections",
  Annotations: "FiberApp_Annotations",
  ProjectMembers: "FiberApp_ProjectMembers",
  Activity: "FiberApp_Activity",
} as const;

/* ---------- Enums ---------- */

export const PROJECT_STATUSES = ["active", "pending", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WORK_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "inspection_pending",
  "inspection_approved",
  "inspection_rejected",
  "ready_for_billing",
  "invoiced",
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const BATCH_STATUSES = ["draft", "generated", "invoiced", "paid"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const ROLES = ["manager", "foreman", "crew"] as const;
export type Role = (typeof ROLES)[number];

export const BUILD_TYPES = ["underground", "aerial", "directional_drill", "splicing", "drop"] as const;
export type BuildType = (typeof BUILD_TYPES)[number];

export const MARKER_TYPES = [
  "Handhole",
  "Vault",
  "Pedestal",
  "Splice Point",
  "Terminal",
  "Pole",
  "Bore Pit",
  "Drop",
  "Slack Loop",
] as const;

export const LINE_TYPES = [
  "Underground Conduit",
  "Aerial Strand",
  "Directional Bore",
  "Trench",
  "Fiber Pull",
  "Road Crossing",
] as const;

export const UNITS = ["ft", "ea", "hr", "lf", "yd"] as const;

/* ---------- Role capabilities (mirrors FiberField plan matrix) ---------- */

export interface Capabilities {
  viewAllProjects: boolean;
  createProjects: boolean;
  manageUsers: boolean;
  viewPricing: boolean;
  manageBilling: boolean;
  markInvoiced: boolean;
  performInspections: boolean;
  reportWork: boolean;
  downloadReports: boolean;
}

export function capabilitiesFor(role: Role): Capabilities {
  switch (role) {
    case "manager":
      return {
        viewAllProjects: true,
        createProjects: true,
        manageUsers: true,
        viewPricing: true,
        manageBilling: true,
        markInvoiced: true,
        performInspections: true,
        reportWork: true,
        downloadReports: true,
      };
    case "foreman":
      return {
        viewAllProjects: false,
        createProjects: false,
        manageUsers: false,
        viewPricing: false,
        manageBilling: false,
        markInvoiced: false,
        performInspections: true,
        reportWork: true,
        downloadReports: true,
      };
    case "crew":
    default:
      return {
        viewAllProjects: false,
        createProjects: false,
        manageUsers: false,
        viewPricing: false,
        manageBilling: false,
        markInvoiced: false,
        performInspections: false,
        reportWork: true,
        downloadReports: false,
      };
  }
}

export const ROLE_META: Record<Role, { label: string; price: number; blurb: string }> = {
  manager: { label: "Manager", price: 149, blurb: "Full administrative access to your company" },
  foreman: { label: "Foreman", price: 129, blurb: "Field supervisor with inspection abilities" },
  crew: { label: "Crew", price: 49, blurb: "Field worker for assigned projects" },
};

/* ---------- Display helpers ---------- */

export function humanizeStatus(s: string): string {
  if (!s) return "—";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusTone(
  s: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "completed":
    case "inspection_approved":
    case "invoiced":
    case "paid":
    case "active":
      return "default";
    case "in_progress":
    case "inspection_pending":
    case "ready_for_billing":
    case "pending":
    case "generated":
      return "secondary";
    case "inspection_rejected":
      return "destructive";
    default:
      return "outline";
  }
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "$0.00";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function compactMoney(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000) return "$" + (v / 1_000).toFixed(1) + "k";
  return money(v);
}

/** Deterministic short id used for batch / invoice numbers. */
export function shortCode(prefix: string, seed?: string): string {
  const base = (seed || Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/gi, "");
  return prefix + "-" + base.slice(-6).toUpperCase();
}
