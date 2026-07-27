import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { FA, FA_DB } from "@/lib/fiber-app";
import { listHandler, serialize } from "@/lib/fiber-list";

/** Billing entries list + a summary block the page header renders as stat tiles. */
export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const res = await listHandler(request, {
      collection: FA.BillingEntries,
      searchFields: ["codeName", "projectName", "reportedBy"],
      filterFields: {
        projectId: "projectId",
        project: "projectName",
        status: "status",
        code: "codeName",
      },
      distinctFields: { projects: "projectName", statuses: "status", codes: "codeName" },
      sort: { reportedAt: -1 },
    });

    if (page !== 1) return res;

    // Enrich page 1 with summary + batches so the screen loads in one round trip.
    const json = await res.json();
    const client = await clientPromise;
    const db = client.db(FA_DB);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope: Record<string, any> = {};
    if (projectId && ObjectId.isValid(projectId)) scope.projectId = new ObjectId(projectId);

    const [summaryRows, codeRows, batches] = await Promise.all([
      db.collection(FA.BillingEntries).aggregate([
        { $match: scope },
        { $group: { _id: "$status", total: { $sum: "$total" }, teamTotal: { $sum: "$teamTotal" }, qty: { $sum: "$quantity" }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection(FA.BillingEntries).aggregate([
        { $match: scope },
        {
          $group: {
            _id: { code: "$codeName", unit: "$unit" },
            qty: { $sum: "$quantity" },
            total: { $sum: "$total" },
            teamTotal: { $sum: "$teamTotal" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]).toArray(),
      db.collection(FA.BillingBatches).find(scope).sort({ generatedAt: -1 }).limit(50).toArray(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byStatus: Record<string, any> = {};
    for (const r of summaryRows) {
      byStatus[String(r._id || "unknown")] = {
        total: r.total || 0,
        teamTotal: r.teamTotal || 0,
        qty: r.qty || 0,
        count: r.count || 0,
      };
    }
    const grand = summaryRows.reduce(
      (a, r) => ({
        total: a.total + (r.total || 0),
        teamTotal: a.teamTotal + (r.teamTotal || 0),
        qty: a.qty + (r.qty || 0),
        count: a.count + (r.count || 0),
      }),
      { total: 0, teamTotal: 0, qty: 0, count: 0 }
    );

    json.summary = {
      byStatus,
      grand,
      margin: grand.total - grand.teamTotal,
      marginPercent: grand.total > 0 ? Math.round(((grand.total - grand.teamTotal) / grand.total) * 100) : 0,
      readyToBill: byStatus.ready_for_billing?.total || 0,
      readyToBillCount: byStatus.ready_for_billing?.count || 0,
      invoiced: byStatus.invoiced?.total || 0,
    };
    json.codeSummary = codeRows.map((c) => ({
      code: String(c._id?.code || "Uncoded"),
      unit: String(c._id?.unit || ""),
      qty: Math.round((c.qty || 0) * 100) / 100,
      total: Math.round((c.total || 0) * 100) / 100,
      teamTotal: Math.round((c.teamTotal || 0) * 100) / 100,
      count: c.count || 0,
    }));
    json.batches = batches.map(serialize);

    return NextResponse.json(json);
  } catch (error) {
    console.error("[FiberApp] Billing list failed:", error);
    return NextResponse.json({ error: "Failed to fetch billing" }, { status: 500 });
  }
});

/** PATCH — bulk status change on billing entries (e.g. mark ready for billing). */
export const PATCH = withAuth(async (request) => {
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    const status: string = body?.status;
    if (!ids.length || !status) {
      return NextResponse.json({ error: "ids and status are required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(FA_DB);
    const result = await db.collection(FA.BillingEntries).updateMany(
      { _id: { $in: ids.filter(ObjectId.isValid).map((i) => new ObjectId(i)) } },
      { $set: { status, updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true, modified: result.modifiedCount });
  } catch (error) {
    console.error("[FiberApp] Billing update failed:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
});
