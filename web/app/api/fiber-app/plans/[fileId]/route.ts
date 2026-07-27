import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { FA_DB } from "@/lib/fiber-app";

export const runtime = "nodejs";

const BUCKET = "FiberApp_Plans";

/** Streams a stored PDF print back to the viewer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { fileId } = await params;
    if (!ObjectId.isValid(fileId)) {
      return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
    }
    const oid = new ObjectId(fileId);

    const client = await clientPromise;
    const db = client.db(FA_DB);
    const bucket = new GridFSBucket(db, { bucketName: BUCKET });

    const files = await bucket.find({ _id: oid }).limit(1).toArray();
    if (!files.length) {
      return NextResponse.json({ error: "Print not found" }, { status: 404 });
    }
    const meta = files[0];

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      bucket
        .openDownloadStream(oid)
        .on("data", (c: Buffer) => chunks.push(c))
        .on("error", reject)
        .on("end", () => resolve());
    });
    const body = Buffer.concat(chunks);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": String(meta.metadata?.contentType || "application/pdf"),
        "Content-Length": String(body.length),
        "Content-Disposition":
          'inline; filename="' + String(meta.filename || "plan.pdf").replace(/"/g, "") + '"',
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[FiberApp] Plan stream failed:", error);
    return NextResponse.json({ error: "Failed to load the print" }, { status: 500 });
  }
}
