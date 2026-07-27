import { crudHandlers } from "@/lib/fiber-crud";
import { FA } from "@/lib/fiber-app";

const handlers = crudHandlers({
  collection: FA.Photos,
  label: "photo",
  allowed: ["caption", "takenBy", "takenAt", "lat", "lng", "markerId", "projectId", "projectName"],
  gridFs: { bucket: "FiberApp_PhotoFiles", field: "fileId" },
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
