import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { FA, FA_DB } from "@/lib/fiber-app";

const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;
    const q = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status");
    const customer = searchParams.get("customer");
    const buildType = searchParams.get("buildType");

    const client = await clientPromise;
    const db = client.db(FA_DB);
    const col = db.collection(FA.Projects);

    const match: Record<string, unknown> = {};
    if (status && status !== "all") match.status = status;
    if (customer && customer !== "all") match.customerName = customer;
    if (buildType && buildType !== "all") match.buildType = buildType;
    if (q) {
      match.$or = [
        { name: { $regex: q, $options: "i" } },
        { projectNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
      ];
    }

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });

    pipeline.push(
      // Roll up billing entries so every row shows live progress + value
      {
        $lookup: {
          from: FA.BillingEntries,
          localField: "_id",
          foreignField: "projectId",
          as: "entries",
        },
      },
      {
        $lookup: {
          from: FA.Markers,
          localField: "_id",
          foreignField: "projectId",
          as: "markerDocs",
        },
      },
      {
        $lookup: {
          from: FA.Photos,
          localField: "_id",
          foreignField: "projectId",
          as: "photoDocs",
        },
      },
      {
        $addFields: {
          markerCount: { $size: "$markerDocs" },
          photoCount: { $size: "$photoDocs" },
          reportedValue: { $sum: "$entries.total" },
          reportedQty: { $sum: "$entries.quantity" },
          invoicedValue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$entries",
                    as: "e",
                    cond: { $eq: ["$$e.status", "invoiced"] },
                  },
                },
                as: "e",
                in: "$$e.total",
              },
            },
          },
          completedMarkers: {
            $size: {
              $filter: {
                input: "$markerDocs",
                as: "m",
                cond: { $in: ["$$m.status", ["completed", "inspection_approved", "ready_for_billing", "invoiced"]] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          percentComplete: {
            $cond: [
              { $gt: ["$markerCount", 0] },
              { $round: [{ $multiply: [{ $divide: ["$completedMarkers", "$markerCount"] }, 100] }, 0] },
              0,
            ],
          },
          budgetUsedPercent: {
            $cond: [
              { $gt: [{ $ifNull: ["$budget", 0] }, 0] },
              { $round: [{ $multiply: [{ $divide: ["$reportedValue", "$budget"] }, 100] }, 0] },
              0,
            ],
          },
        },
      },
      { $project: { entries: 0, markerDocs: 0, photoDocs: 0 } },
      {
        $facet: {
          data: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: PAGE_SIZE }],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = (await col.aggregate(pipeline).toArray()) as any[];
    const rows = result?.data || [];
    const totalCount = result?.totalCount?.[0]?.count || 0;

    const data = rows.map((p: Record<string, unknown>) => ({
      _id: String(p._id),
      projectNumber: p.projectNumber || "",
      name: p.name || "",
      customerName: p.customerName || "",
      city: p.city || "",
      state: p.state || "",
      status: p.status || "active",
      buildType: p.buildType || "",
      foreman: p.foreman || "",
      crewSize: p.crewSize ?? null,
      budget: p.budget ?? 0,
      planFileName: p.planFileName || "",
      startDate: p.startDate || "",
      dueDate: p.dueDate || "",
      markerCount: p.markerCount ?? 0,
      photoCount: p.photoCount ?? 0,
      reportedValue: p.reportedValue ?? 0,
      reportedQty: p.reportedQty ?? 0,
      invoicedValue: p.invoicedValue ?? 0,
      percentComplete: p.percentComplete ?? 0,
      budgetUsedPercent: p.budgetUsedPercent ?? 0,
      createdAt: p.createdAt || "",
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      data,
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE) || 1,
    };

    if (page === 1) {
      const [statuses, customers, buildTypes] = await Promise.all([
        col.distinct("status"),
        col.distinct("customerName"),
        col.distinct("buildType"),
      ]);
      response.filterOptions = {
        statuses: (statuses as string[]).filter(Boolean).sort(),
        customers: (customers as string[]).filter(Boolean).sort(),
        buildTypes: (buildTypes as string[]).filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[FiberApp] Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    if (!body?.name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(FA_DB);
    const col = db.collection(FA.Projects);

    const count = await col.countDocuments();
    const projectNumber =
      body.projectNumber || "FF-" + String(1000 + count + 1);

    const doc = {
      projectNumber,
      name: String(body.name),
      customerName: body.customerName || "",
      city: body.city || "",
      state: body.state || "",
      status: body.status || "active",
      buildType: body.buildType || "underground",
      foreman: body.foreman || "",
      crewSize: Number(body.crewSize) || 0,
      budget: Number(body.budget) || 0,
      planFileName: body.planFileName || "",
      planUrl: body.planUrl || "",
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || "",
      notes: body.notes || "",
      createdAt: new Date(),
      createdBy: session.user?.name || session.user?.email || "system",
    };

    const result = await col.insertOne(doc);

    await db.collection(FA.Activity).insertOne({
      projectId: result.insertedId,
      type: "project_created",
      message: "Project " + doc.name + " created",
      actor: doc.createdBy,
      createdAt: new Date(),
    });

    return NextResponse.json({ _id: result.insertedId.toString(), ...doc }, { status: 201 });
  } catch (error) {
    console.error("[FiberApp] Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
});
