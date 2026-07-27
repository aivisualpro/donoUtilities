import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { listHandler, createDoc } from "@/lib/fiber-list";
import { FA } from "@/lib/fiber-app";

export const GET = withAuth(async (request) => {
  try {
    return await listHandler(request, {
      collection: FA.Photos,
      searchFields: ["caption", "takenBy", "projectName"],
      filterFields: { projectId: "projectId", project: "projectName", takenBy: "takenBy" },
      distinctFields: { projects: "projectName", photographers: "takenBy" },
      sort: { takenAt: -1 },
    });
  } catch (error) {
    console.error("[FiberApp] Photos list failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    const actor = session.user?.name || session.user?.email || "system";
    const doc = await createDoc(FA.Photos, body, actor);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("[FiberApp] Photos create failed:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
});
