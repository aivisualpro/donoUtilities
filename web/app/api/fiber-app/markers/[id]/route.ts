import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { FA, FA_DB } from "@/lib/fiber-app";

/** PATCH a marker — used by the inspection flow and the field-mode status buttons. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid marker id" }, { status: 400 });
    }
    const body = await request.json();
    const actor = session.user?.name || session.user?.email || "system";

    const allowed = ["status", "notes", "type", "street", "address", "lat", "lng", "planX", "planY"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const k of allowed) if (k in body) update[k] = body[k];
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    update.updatedAt = new Date();

    const client = await clientPromise;
    const db = client.db(FA_DB);
    const mid = new ObjectId(id);

    const marker = await db.collection(FA.Markers).findOne({ _id: mid });
    if (!marker) return NextResponse.json({ error: "Marker not found" }, { status: 404 });

    await db.collection(FA.Markers).updateOne({ _id: mid }, { $set: update });

    // Keep the marker's billing entries in lockstep with inspection outcomes.
    if (body.status === "inspection_approved" || body.status === "ready_for_billing") {
      await db.collection(FA.BillingEntries).updateMany(
        { markerId: mid },
        { $set: { status: "ready_for_billing", updatedAt: new Date() } }
      );
    }

    if (body.status) {
      await db.collection(FA.Inspections).insertOne({
        projectId: marker.projectId,
        projectName: marker.projectName || "",
        markerId: mid,
        result:
          body.status === "inspection_approved" ? "approved"
            : body.status === "inspection_rejected" ? "rejected"
            : "pending",
        inspector: actor,
        notes: body.notes || "",
        inspectedAt: new Date(),
        createdAt: new Date(),
      });

      await db.collection(FA.Activity).insertOne({
        projectId: marker.projectId,
        type: "marker_status",
        message:
          actor + " set " + (marker.markerNumber || "a marker") + " to " + String(body.status).replace(/_/g, " "),
        actor,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Marker update failed:", error);
    return NextResponse.json({ error: "Failed to update marker" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid marker id" }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db(FA_DB);
    const mid = new ObjectId(id);
    await Promise.all([
      db.collection(FA.Markers).deleteOne({ _id: mid }),
      db.collection(FA.BillingEntries).deleteMany({ markerId: mid }),
      db.collection(FA.Photos).deleteMany({ markerId: mid }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Marker delete failed:", error);
    return NextResponse.json({ error: "Failed to delete marker" }, { status: 500 });
  }
}
