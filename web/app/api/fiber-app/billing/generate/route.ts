import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { FA, FA_DB } from "@/lib/fiber-app";

/**
 * POST /api/fiber-app/billing/generate
 * body: { projectId, entryIds?: string[], markInvoiced?: boolean }
 *
 * The one-click billing step: rolls eligible entries into a batch,
 * stamps them, writes an activity line, returns the batch + line items.
 */
export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    const { projectId, entryIds, markInvoiced } = body || {};
    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "A valid projectId is required" }, { status: 400 });
    }

    const actor = session.user?.name || session.user?.email || "system";
    const client = await clientPromise;
    const db = client.db(FA_DB);
    const pid = new ObjectId(projectId);

    const project = await db.collection(FA.Projects).findOne({ _id: pid });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { projectId: pid };
    if (Array.isArray(entryIds) && entryIds.length) {
      filter._id = { $in: entryIds.filter(ObjectId.isValid).map((i: string) => new ObjectId(i)) };
    } else {
      filter.status = { $in: ["ready_for_billing", "inspection_approved"] };
    }

    const entries = await db.collection(FA.BillingEntries).find(filter).toArray();
    if (!entries.length) {
      return NextResponse.json(
        { error: "No billable entries found. Mark work ready for billing first." },
        { status: 409 }
      );
    }

    const total = entries.reduce((a, e) => a + (e.total || 0), 0);
    const teamTotal = entries.reduce((a, e) => a + (e.teamTotal || 0), 0);
    const dates = entries.map((e) => new Date(e.reportedAt || e.createdAt || Date.now()).getTime());

    const batchCount = await db.collection(FA.BillingBatches).countDocuments({ projectId: pid });
    const batchNumber =
      "B-" + (project.projectNumber || "0000").replace(/\D/g, "") + "-" + String(batchCount + 1).padStart(2, "0");

    // Roll up line items by code for the billing document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineMap = new Map<string, any>();
    for (const e of entries) {
      const key = String(e.codeName || "Uncoded");
      const cur = lineMap.get(key) || {
        codeName: key,
        unit: e.unit || "",
        rate: e.adminRate || 0,
        quantity: 0,
        total: 0,
      };
      cur.quantity += e.quantity || 0;
      cur.total += e.total || 0;
      lineMap.set(key, cur);
    }
    const lineItems = [...lineMap.values()]
      .map((l) => ({ ...l, quantity: Math.round(l.quantity * 100) / 100, total: Math.round(l.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    const now = new Date();
    const batch = {
      projectId: pid,
      projectName: project.name || "",
      customerName: project.customerName || "",
      batchNumber,
      status: markInvoiced ? "invoiced" : "generated",
      periodStart: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      periodEnd: new Date(Math.max(...dates)).toISOString().slice(0, 10),
      entryCount: entries.length,
      total: Math.round(total * 100) / 100,
      teamTotal: Math.round(teamTotal * 100) / 100,
      margin: Math.round((total - teamTotal) * 100) / 100,
      lineItems,
      invoiceNumber: markInvoiced ? "INV-" + Date.now().toString().slice(-6) : "",
      documentUrl: "",
      generatedBy: actor,
      generatedAt: now,
      createdAt: now,
    };

    const inserted = await db.collection(FA.BillingBatches).insertOne(batch);

    await db.collection(FA.BillingEntries).updateMany(
      { _id: { $in: entries.map((e) => e._id) } },
      {
        $set: {
          status: markInvoiced ? "invoiced" : "ready_for_billing",
          batchId: inserted.insertedId,
          batchNumber,
          updatedAt: now,
        },
      }
    );

    await db.collection(FA.Activity).insertOne({
      projectId: pid,
      type: markInvoiced ? "invoice" : "billing_generated",
      message:
        (markInvoiced ? "Invoice " + batch.invoiceNumber : "Billing doc " + batchNumber) +
        " generated for " +
        project.name +
        " (" +
        entries.length +
        " items)",
      actor,
      createdAt: now,
    });

    return NextResponse.json(
      { ok: true, batch: { _id: inserted.insertedId.toString(), ...batch, projectId: projectId } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[FiberApp] Generate billing failed:", error);
    return NextResponse.json({ error: "Failed to generate billing document" }, { status: 500 });
  }
});
