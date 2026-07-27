import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { FA, FA_DB } from "@/lib/fiber-app";

/** Dashboard KPIs + 30-day trend + activity feed, in one round trip. */
export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const days = range === "7d" ? 7 : range === "90d" ? 90 : range === "all" ? 3650 : 30;
    const since = new Date(Date.now() - days * 86400000);

    const client = await clientPromise;
    const db = client.db(FA_DB);

    const [
      projectsByStatus,
      entryTotals,
      entriesByStatus,
      trend,
      byCode,
      byProject,
      activity,
      counts,
    ] = await Promise.all([
      db.collection(FA.Projects).aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, budget: { $sum: "$budget" } } },
      ]).toArray(),

      db.collection(FA.BillingEntries).aggregate([
        {
          $group: {
            _id: null,
            reported: { $sum: "$total" },
            qty: { $sum: "$quantity" },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),

      db.collection(FA.BillingEntries).aggregate([
        { $group: { _id: "$status", total: { $sum: "$total" }, count: { $sum: 1 } } },
      ]).toArray(),

      db.collection(FA.BillingEntries).aggregate([
        { $match: { reportedAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$reportedAt" } },
            reported: { $sum: "$total" },
            invoiced: {
              $sum: { $cond: [{ $eq: ["$status", "invoiced"] }, "$total", 0] },
            },
            units: { $sum: "$quantity" },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),

      db.collection(FA.BillingEntries).aggregate([
        { $group: { _id: "$codeName", total: { $sum: "$total" }, qty: { $sum: "$quantity" } } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]).toArray(),

      db.collection(FA.BillingEntries).aggregate([
        { $group: { _id: "$projectName", total: { $sum: "$total" } } },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]).toArray(),

      db.collection(FA.Activity)
        .find({})
        .sort({ createdAt: -1 })
        .limit(12)
        .toArray(),

      Promise.all([
        db.collection(FA.Markers).countDocuments(),
        db.collection(FA.Markers).countDocuments({ status: "inspection_pending" }),
        db.collection(FA.Photos).countDocuments(),
        db.collection(FA.Members).countDocuments(),
        db.collection(FA.FormInstances).countDocuments(),
        db.collection(FA.BillingBatches).countDocuments(),
      ]),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusMap: Record<string, any> = {};
    for (const s of projectsByStatus) {
      statusMap[String(s._id || "unknown")] = { count: s.count, budget: s.budget || 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entryStatusMap: Record<string, any> = {};
    for (const s of entriesByStatus) {
      entryStatusMap[String(s._id || "unknown")] = { total: s.total || 0, count: s.count };
    }

    const totals = entryTotals[0] || { reported: 0, qty: 0, count: 0 };
    const [markerCount, awaitingInspection, photoCount, crewCount, formCount, batchCount] = counts;

    const totalBudget = projectsByStatus.reduce((a, s) => a + (s.budget || 0), 0);
    const invoiced = entryStatusMap.invoiced?.total || 0;
    const readyToBill = entryStatusMap.ready_for_billing?.total || 0;

    return NextResponse.json({
      kpis: {
        activeProjects: statusMap.active?.count || 0,
        completedProjects: statusMap.completed?.count || 0,
        pendingProjects: statusMap.pending?.count || 0,
        archivedProjects: statusMap.archived?.count || 0,
        totalProjects: projectsByStatus.reduce((a, s) => a + s.count, 0),
        totalBudget,
        reportedValue: totals.reported || 0,
        reportedUnits: totals.qty || 0,
        billingEntries: totals.count || 0,
        invoicedValue: invoiced,
        readyToBillValue: readyToBill,
        unbilledValue: Math.max(0, (totals.reported || 0) - invoiced),
        markerCount,
        awaitingInspection,
        photoCount,
        crewCount,
        formCount,
        batchCount,
        budgetUsedPercent:
          totalBudget > 0 ? Math.round(((totals.reported || 0) / totalBudget) * 100) : 0,
      },
      trend: trend.map((t) => ({
        date: String(t._id),
        reported: Math.round(t.reported || 0),
        invoiced: Math.round(t.invoiced || 0),
        units: Math.round(t.units || 0),
      })),
      byCode: byCode.map((c) => ({
        code: String(c._id || "Uncoded"),
        total: Math.round(c.total || 0),
        qty: Math.round(c.qty || 0),
      })),
      byProject: byProject.map((p) => ({
        project: String(p._id || "Unassigned"),
        total: Math.round(p.total || 0),
      })),
      projectsByStatus: Object.entries(statusMap).map(([status, v]) => ({
        status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        count: (v as any).count,
      })),
      activity: activity.map((a) => ({
        _id: String(a._id),
        type: a.type || "",
        message: a.message || "",
        actor: a.actor || "",
        createdAt: a.createdAt || null,
      })),
      range,
    });
  } catch (error) {
    console.error("[FiberApp] Dashboard failed:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
});
