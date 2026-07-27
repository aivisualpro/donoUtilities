import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { listHandler, serialize } from "@/lib/fiber-list";
import { FA, FA_DB } from "@/lib/fiber-app";

export const GET = withAuth(async (request) => {
  try {
    return await listHandler(request, {
      collection: FA.Markers,
      searchFields: ["markerNumber", "type", "street", "address", "reportedBy", "projectName"],
      filterFields: { projectId: "projectId", status: "status", type: "type", project: "projectName" },
      distinctFields: { statuses: "status", types: "type", projects: "projectName" },
      sort: { reportedAt: -1 },
    });
  } catch (error) {
    console.error("[FiberApp] Markers list failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});

/**
 * POST a marker. If `billingCodeId` + `quantity` are supplied the matching
 * billing entry is created in the same call — this is the field "Report" flow:
 * drop a pin, pick a code, done.
 */
export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    if (!body?.projectId || !ObjectId.isValid(body.projectId)) {
      return NextResponse.json({ error: "A valid projectId is required" }, { status: 400 });
    }

    const actor = session.user?.name || session.user?.email || "system";
    const client = await clientPromise;
    const db = client.db(FA_DB);
    const pid = new ObjectId(body.projectId);

    const project = await db.collection(FA.Projects).findOne({ _id: pid });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const existing = await db.collection(FA.Markers).countDocuments({ projectId: pid });
    const type = body.type || "Handhole";
    const markerNumber =
      body.markerNumber ||
      type.slice(0, 2).toUpperCase() + "-" + String(existing + 1).padStart(3, "0");

    const now = new Date();
    const marker = {
      projectId: pid,
      projectName: project.name || "",
      markerNumber,
      type,
      status: body.status || "completed",
      street: body.street || "",
      address: body.address || "",
      lat: Number(body.lat) || null,
      lng: Number(body.lng) || null,
      planX: Number(body.planX) || 0.5,
      planY: Number(body.planY) || 0.5,
      planPage: Number(body.planPage) || 1,
      notes: body.notes || "",
      reportedBy: actor,
      reportedAt: now,
      createdAt: now,
      createdBy: actor,
    };

    const inserted = await db.collection(FA.Markers).insertOne(marker);

    // Optional billing entry created alongside the marker
    let entry = null;
    if (body.billingCodeId && ObjectId.isValid(body.billingCodeId) && Number(body.quantity) > 0) {
      const code = await db
        .collection(FA.BillingCodes)
        .findOne({ _id: new ObjectId(body.billingCodeId) });
      if (code) {
        const qty = Number(body.quantity);
        const entryDoc = {
          projectId: pid,
          projectName: project.name || "",
          markerId: inserted.insertedId,
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
        actor + " reported " + markerNumber + " (" + type + ") on " + (project.name || "a project"),
      actor,
      createdAt: now,
    });

    return NextResponse.json(
      { _id: inserted.insertedId.toString(), ...serialize(marker), entry },
      { status: 201 }
    );
  } catch (error) {
    console.error("[FiberApp] Marker create failed:", error);
    return NextResponse.json({ error: "Failed to create marker" }, { status: 500 });
  }
});
