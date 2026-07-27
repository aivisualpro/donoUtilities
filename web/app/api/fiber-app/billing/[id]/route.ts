import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.BillingEntries,
  label: "billing entry",
  allowed: ["status", "quantity", "codeName", "unit", "adminRate", "teamRate", "total", "teamTotal", "reportedBy"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
