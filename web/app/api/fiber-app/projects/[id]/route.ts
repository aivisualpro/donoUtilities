import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { FA, FA_DB } from "@/lib/fiber-app";
import { serialize } from "@/lib/fiber-list";

async function guard() {
  const session = await auth();
  if (!session) return null;
  return session;
}

/** Full project workspace payload — everything ProjectDetail needs, in one call. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    const pid = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(FA_DB);

    const project = await db.collection(FA.Projects).findOne({ _id: pid });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [markers, lines, photos, entries, batches, forms, documents, inspections, activity, annotations] =
      await Promise.all([
        db.collection(FA.Markers).find({ projectId: pid }).sort({ markerNumber: 1 }).toArray(),
        db.collection(FA.Lines).find({ projectId: pid }).sort({ lineNumber: 1 }).toArray(),
        db.collection(FA.Photos).find({ projectId: pid }).sort({ takenAt: -1 }).limit(200).toArray(),
        db.collection(FA.BillingEntries).find({ projectId: pid }).sort({ reportedAt: -1 }).toArray(),
        db.collection(FA.BillingBatches).find({ projectId: pid }).sort({ generatedAt: -1 }).toArray(),
        db.collection(FA.FormInstances).find({ projectId: pid }).sort({ submittedAt: -1 }).toArray(),
        db.collection(FA.Documents).find({ projectId: pid }).sort({ uploadedAt: -1 }).toArray(),
        db.collection(FA.Inspections).find({ projectId: pid }).sort({ createdAt: -1 }).toArray(),
        db.collection(FA.Activity).find({ projectId: pid }).sort({ createdAt: -1 }).limit(25).toArray(),
        db.collection(FA.Annotations).find({ projectId: pid }).toArray(),
      ]);

    const reportedValue = entries.reduce((a, e) => a + (e.total || 0), 0);
    const teamValue = entries.reduce((a, e) => a + (e.teamTotal || 0), 0);
    const invoicedValue = entries
      .filter((e) => e.status === "invoiced")
      .reduce((a, e) => a + (e.total || 0), 0);
    const readyValue = entries
      .filter((e) => e.status === "ready_for_billing" || e.status === "inspection_approved")
      .reduce((a, e) => a + (e.total || 0), 0);
    const doneStates = ["completed", "inspection_approved", "ready_for_billing", "invoiced"];
    const completedMarkers = markers.filter((m) => doneStates.includes(String(m.status))).length;
    const totalFootage = lines.reduce((a, l) => a + (l.footage || 0), 0);

    return NextResponse.json({
      project: serialize(project),
      markers: markers.map(serialize),
      lines: lines.map(serialize),
      photos: photos.map(serialize),
      entries: entries.map(serialize),
      batches: batches.map(serialize),
      forms: forms.map(serialize),
      documents: documents.map(serialize),
      inspections: inspections.map(serialize),
      activity: activity.map(serialize),
      annotations: annotations.map(serialize),
      stats: {
        markerCount: markers.length,
        completedMarkers,
        percentComplete: markers.length ? Math.round((completedMarkers / markers.length) * 100) : 0,
        lineCount: lines.length,
        totalFootage,
        photoCount: photos.length,
        formCount: forms.length,
        documentCount: documents.length,
        awaitingInspection: markers.filter((m) => m.status === "inspection_pending").length,
        reportedValue: Math.round(reportedValue * 100) / 100,
        teamValue: Math.round(teamValue * 100) / 100,
        margin: Math.round((reportedValue - teamValue) * 100) / 100,
        invoicedValue: Math.round(invoicedValue * 100) / 100,
        readyValue: Math.round(readyValue * 100) / 100,
        budget: project.budget || 0,
        budgetUsedPercent: project.budget ? Math.round((reportedValue / project.budget) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[FiberApp] Project detail failed:", error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    const body = await request.json();
    const allowed = [
      "name", "customerName", "city", "state", "status", "buildType",
      "foreman", "crewSize", "budget", "startDate", "dueDate", "notes",
      "planFileName", "planUrl",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const k of allowed) if (k in body) update[k] = body[k];
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    update.updatedAt = new Date();

    const client = await clientPromise;
    const db = client.db(FA_DB);
    await db.collection(FA.Projects).updateOne({ _id: new ObjectId(id) }, { $set: update });

    if (body.status) {
      await db.collection(FA.Activity).insertOne({
        projectId: new ObjectId(id),
        type: "status_changed",
        message: "Project marked " + body.status,
        actor: session.user?.name || "system",
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Project update failed:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    const pid = new ObjectId(id);
    const client = await clientPromise;
    const db = client.db(FA_DB);

    await Promise.all([
      db.collection(FA.Projects).deleteOne({ _id: pid }),
      db.collection(FA.Markers).deleteMany({ projectId: pid }),
      db.collection(FA.Lines).deleteMany({ projectId: pid }),
      db.collection(FA.Photos).deleteMany({ projectId: pid }),
      db.collection(FA.BillingEntries).deleteMany({ projectId: pid }),
      db.collection(FA.BillingBatches).deleteMany({ projectId: pid }),
      db.collection(FA.FormInstances).deleteMany({ projectId: pid }),
      db.collection(FA.Documents).deleteMany({ projectId: pid }),
      db.collection(FA.Inspections).deleteMany({ projectId: pid }),
      db.collection(FA.Activity).deleteMany({ projectId: pid }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Project delete failed:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
