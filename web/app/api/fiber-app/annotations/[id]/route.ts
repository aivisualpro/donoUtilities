import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.Annotations,
  label: "annotation",
  allowed: ["text", "planX", "planY", "planPage", "color"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
