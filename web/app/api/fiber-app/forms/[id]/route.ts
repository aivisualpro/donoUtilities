import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.FormInstances,
  label: "form submission",
  allowed: ["templateName", "submittedBy", "submittedAt", "values", "projectId", "projectName"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
