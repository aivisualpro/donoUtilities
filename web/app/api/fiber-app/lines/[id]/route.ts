import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.Lines,
  label: "line",
  allowed: ["lineNumber", "type", "status", "footage", "street", "points", "planPage", "reportedBy"],
  cascade: [[FA.BillingEntries, "lineId"]],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
