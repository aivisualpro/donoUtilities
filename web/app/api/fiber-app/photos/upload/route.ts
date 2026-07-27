import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { FA, FA_DB } from "@/lib/fiber-app";
import { serialize } from "@/lib/fiber-list";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "FiberApp_PhotoFiles";
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per image
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];

/**
 * POST multipart/form-data
 *   files      one or more images (field name "files", or a single "file")
 *   projectId  required
 *   markerId   optional — ties the photo to a specific marker
 *   caption    optional base caption
 *   lat, lng   optional GPS from the browser
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "");
    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "A valid projectId is required" }, { status: 400 });
    }

    const files = [...form.getAll("files"), ...form.getAll("file")].filter(
      (f): f is File => f instanceof File && f.size > 0
    );
    if (!files.length) {
      return NextResponse.json({ error: "No images uploaded" }, { status: 400 });
    }

    const actor = session.user?.name || session.user?.email || "system";
    const pid = new ObjectId(projectId);
    const markerIdRaw = String(form.get("markerId") || "");
    const markerId = ObjectId.isValid(markerIdRaw) ? new ObjectId(markerIdRaw) : null;
    const baseCaption = String(form.get("caption") || "").trim();
    const lat = form.get("lat") ? Number(form.get("lat")) : null;
    const lng = form.get("lng") ? Number(form.get("lng")) : null;

    const client = await clientPromise;
    const db = client.db(FA_DB);

    const project = await db.collection(FA.Projects).findOne({ _id: pid });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const bucket = new GridFSBucket(db, { bucketName: BUCKET });
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created: Record<string, any>[] = [];
    const rejected: { name: string; reason: string }[] = [];

    for (const file of files) {
      if (file.size > MAX_BYTES) {
        rejected.push({ name: file.name, reason: "larger than 12 MB" });
        continue;
      }
      if (file.type && !OK_TYPES.includes(file.type)) {
        rejected.push({ name: file.name, reason: "not an image" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = bucket.openUploadStream(file.name, {
        metadata: {
          projectId: pid,
          markerId,
          uploadedBy: actor,
          contentType: file.type || "image/jpeg",
        },
      });
      await new Promise<void>((resolve, reject) => {
        upload.on("error", reject);
        upload.on("finish", () => resolve());
        upload.end(buffer);
      });

      const fileId = upload.id.toString();
      const doc = {
        projectId: pid,
        projectName: project.name || "",
        markerId,
        fileId,
        url: "/api/fiber-app/photo-files/" + fileId,
        caption: baseCaption || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        sizeKb: Math.round(file.size / 1024),
        contentType: file.type || "image/jpeg",
        lat,
        lng,
        takenBy: actor,
        takenAt: now,
        createdAt: now,
        createdBy: actor,
      };
      const res = await db.collection(FA.Photos).insertOne(doc);
      created.push({ _id: res.insertedId.toString(), ...serialize(doc) });
    }

    if (created.length) {
      await db.collection(FA.Activity).insertOne({
        projectId: pid,
        type: "photo_uploaded",
        message:
          actor + " uploaded " + created.length + " photo" + (created.length === 1 ? "" : "s") +
          (lat && lng ? " (GPS-tagged)" : "") + " to " + (project.name || "a project"),
        actor,
        createdAt: now,
      });
    }

    return NextResponse.json(
      { ok: true, created, rejected, count: created.length },
      { status: created.length ? 201 : 400 }
    );
  } catch (error) {
    console.error("[FiberApp] Photo upload failed:", error);
    return NextResponse.json({ error: "Failed to upload photos" }, { status: 500 });
  }
}
