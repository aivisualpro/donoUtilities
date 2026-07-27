import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { FA, FA_DB } from "@/lib/fiber-app";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "FiberApp_Plans";
const MAX_BYTES = 40 * 1024 * 1024; // 40 MB

/**
 * POST multipart/form-data { file: <pdf>, pageCount?: number }
 * Stores the PDF in GridFS and stamps the project with its file id.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    const pid = new ObjectId(id);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF prints are supported" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "That print is larger than 40 MB" },
        { status: 413 }
      );
    }

    const pageCount = Math.max(1, parseInt(String(form.get("pageCount") || "1"), 10) || 1);
    const actor = session.user?.name || session.user?.email || "system";

    const client = await clientPromise;
    const db = client.db(FA_DB);

    const project = await db.collection(FA.Projects).findOne({ _id: pid });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const bucket = new GridFSBucket(db, { bucketName: BUCKET });

    // Drop any previous print for this project so storage doesn't grow forever.
    if (project.planFileId && ObjectId.isValid(String(project.planFileId))) {
      try {
        await bucket.delete(new ObjectId(String(project.planFileId)));
      } catch {
        /* already gone — fine */
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = bucket.openUploadStream(file.name, {
      // mongodb v7 dropped the top-level contentType option — it lives in metadata now
      metadata: {
        projectId: pid,
        uploadedBy: actor,
        pageCount,
        contentType: "application/pdf",
      },
    });
    await new Promise<void>((resolve, reject) => {
      upload.on("error", reject);
      upload.on("finish", () => resolve());
      upload.end(buffer);
    });

    const planFileId = upload.id.toString();

    await db.collection(FA.Projects).updateOne(
      { _id: pid },
      {
        $set: {
          planFileId,
          planFileName: file.name,
          planPageCount: pageCount,
          planUrl: "/api/fiber-app/plans/" + planFileId,
          planUploadedBy: actor,
          planUploadedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    await db.collection(FA.Documents).insertOne({
      projectId: pid,
      projectName: project.name || "",
      folder: "Plans & Permits",
      name: file.name,
      sizeKb: Math.round(file.size / 1024),
      uploadedBy: actor,
      uploadedAt: new Date(),
      createdAt: new Date(),
      planFileId,
    });

    await db.collection(FA.Activity).insertOne({
      projectId: pid,
      type: "plan_uploaded",
      message: actor + " uploaded " + file.name + " (" + pageCount + " page" + (pageCount === 1 ? "" : "s") + ")",
      actor,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        ok: true,
        planFileId,
        planFileName: file.name,
        planPageCount: pageCount,
        planUrl: "/api/fiber-app/plans/" + planFileId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[FiberApp] Plan upload failed:", error);
    return NextResponse.json({ error: "Failed to upload the print" }, { status: 500 });
  }
}

/** DELETE removes the stored print and clears the project fields. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
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

    if (project?.planFileId && ObjectId.isValid(String(project.planFileId))) {
      const bucket = new GridFSBucket(db, { bucketName: BUCKET });
      try {
        await bucket.delete(new ObjectId(String(project.planFileId)));
      } catch {
        /* already gone */
      }
    }

    await db.collection(FA.Projects).updateOne(
      { _id: pid },
      { $set: { planFileId: "", planFileName: "", planUrl: "", planPageCount: 0 } }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Plan delete failed:", error);
    return NextResponse.json({ error: "Failed to remove the print" }, { status: 500 });
  }
}
