import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { listHandler, createDoc } from "@/lib/fiber-list";
import { FA } from "@/lib/fiber-app";

export const GET = withAuth(async (request) => {
  try {
    return await listHandler(request, {
      collection: FA.Documents,
      searchFields: ["name", "folder", "uploadedBy", "projectName"],
      filterFields: { projectId: "projectId", project: "projectName", folder: "folder" },
      distinctFields: { projects: "projectName", folders: "folder" },
      sort: { uploadedAt: -1 },
    });
  } catch (error) {
    console.error("[FiberApp] Documents list failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    const actor = session.user?.name || session.user?.email || "system";
    const doc = await createDoc(FA.Documents, body, actor);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("[FiberApp] Documents create failed:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
});
