import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.Customers,
  label: "customer",
  allowed: ["name", "contact", "email", "phone", "terms"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
