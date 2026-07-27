import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { listHandler, createDoc } from "@/lib/fiber-list";
import { FA, FA_DB } from "@/lib/fiber-app";

export const GET = withAuth(async (request) => {
  try {
    return await listHandler(request, {
      collection: FA.Annotations,
      searchFields: ["text"],
      filterFields: { projectId: "projectId" },
      sort: { createdAt: -1 },
    });
  } catch (error) {
    console.error("[FiberApp] Annotation list failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    if (!body?.text || !body?.projectId) {
      return NextResponse.json({ error: "text and projectId are required" }, { status: 400 });
    }
    const actor = session.user?.name || session.user?.email || "system";
    const doc = await createDoc(FA.Annotations, body, actor);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("[FiberApp] Annotation create failed:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Valid id required" }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db(FA_DB);
    await db.collection(FA.Annotations).deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Annotation delete failed:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
});
