import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.BillingCodes,
  label: "billing code",
  allowed: ["code", "name", "unit", "teamPrice", "adminPrice", "category", "sortOrder", "active"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
