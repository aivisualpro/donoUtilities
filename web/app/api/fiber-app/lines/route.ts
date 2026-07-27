import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { listHandler, serialize } from "@/lib/fiber-list";
import { FA, FA_DB } from "@/lib/fiber-app";

export const GET = withAuth(async (request) => {
  try {
    return await listHandler(request, {
      collection: FA.Lines,
      searchFields: ["lineNumber", "type", "street", "reportedBy", "projectName"],
      filterFields: { projectId: "projectId", status: "status", type: "type", project: "projectName" },
      distinctFields: { statuses: "status", types: "type", projects: "projectName" },
      sort: { reportedAt: -1 },
    });
  } catch (error) {
    console.error("[FiberApp] Lines list failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});

/**
 * POST a drawn line. Accepts normalised plan `points` [{x,y}], footage and an
 * optional billing code — same one-step report flow as markers.
 */
export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    if (!body?.projectId || !ObjectId.isValid(body.projectId)) {
      return NextResponse.json({ error: "A valid projectId is required" }, { status: 400 });
    }
    const points = Array.isArray(body.points) ? body.points : [];
    if (points.length < 2) {
      return NextResponse.json({ error: "A line needs at least two points" }, { status: 400 });
    }

    const actor = session.user?.name || session.user?.email || "system";
    const client = await clientPromise;
    const db = client.db(FA_DB);
    const pid = new ObjectId(body.projectId);

    const project = await db.collection(FA.Projects).findOne({ _id: pid });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const existing = await db.collection(FA.Lines).countDocuments({ projectId: pid });
    const now = new Date();

    const line = {
      projectId: pid,
      projectName: project.name || "",
      lineNumber: body.lineNumber || "L-" + String(existing + 1).padStart(3, "0"),
      type: body.type || "Underground Conduit",
      status: body.status || "completed",
      footage: Number(body.footage) || 0,
      street: body.street || "",
      points: points.map((p: { x: number; y: number }) => ({
        x: Math.round(Number(p.x) * 1000) / 1000,
        y: Math.round(Number(p.y) * 1000) / 1000,
      })),
      planPage: Number(body.planPage) || 1,
      reportedBy: actor,
      reportedAt: now,
      createdAt: now,
      createdBy: actor,
    };

    const inserted = await db.collection(FA.Lines).insertOne(line);

    let entry = null;
    if (body.billingCodeId && ObjectId.isValid(body.billingCodeId) && Number(body.footage) > 0) {
      const code = await db
        .collection(FA.BillingCodes)
        .findOne({ _id: new ObjectId(body.billingCodeId) });
      if (code) {
        const qty = Number(body.footage);
        const entryDoc = {
          projectId: pid,
          projectName: project.name || "",
          lineId: inserted.insertedId,
          codeId: code.code,
          codeName: code.code + " " + code.name,
          unit: code.unit,
          quantity: qty,
          teamRate: code.teamPrice,
          adminRate: code.adminPrice,
          total: Math.round(qty * code.adminPrice * 100) / 100,
          teamTotal: Math.round(qty * code.teamPrice * 100) / 100,
          status: "in_progress",
          reportedBy: actor,
          reportedAt: now,
          createdAt: now,
        };
        const er = await db.collection(FA.BillingEntries).insertOne(entryDoc);
        entry = { _id: er.insertedId.toString(), ...serialize(entryDoc) };
      }
    }

    await db.collection(FA.Activity).insertOne({
      projectId: pid,
      type: "work_reported",
      message:
        actor + " drew " + line.lineNumber + " (" + line.type + ", " +
        line.footage.toLocaleString() + " ft) on " + (project.name || "a project"),
      actor,
      createdAt: now,
    });

    return NextResponse.json(
      { _id: inserted.insertedId.toString(), ...serialize(line), entry },
      { status: 201 }
    );
  } catch (error) {
    console.error("[FiberApp] Line create failed:", error);
    return NextResponse.json({ error: "Failed to save the line" }, { status: 500 });
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
    const oid = new ObjectId(id);
    await Promise.all([
      db.collection(FA.Lines).deleteOne({ _id: oid }),
      db.collection(FA.BillingEntries).deleteMany({ lineId: oid }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Line delete failed:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
});
