import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { listHandler, createDoc } from "@/lib/fiber-list";
import { FA } from "@/lib/fiber-app";

export const GET = withAuth(async (request) => {
  try {
    return await listHandler(request, {
      collection: FA.Customers,
      searchFields: ["name", "contact", "email", "phone"],
      filterFields: { terms: "terms" },
      distinctFields: { terms: "terms" },
      sort: { name: 1 },
    });
  } catch (error) {
    console.error("[FiberApp] Customers list failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    const actor = session.user?.name || session.user?.email || "system";
    const doc = await createDoc(FA.Customers, body, actor);
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("[FiberApp] Customers create failed:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
});
