import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { FA_DB } from "@/lib/fiber-app";
import { serialize } from "@/lib/fiber-list";

/**
 * Shared GET / PATCH / DELETE handlers for FiberApp `[id]` routes.
 *
 * `withAuth` can't forward Next route params, so these guard with `auth()`
 * directly. Only fields listed in `allowed` can be written — never spread
 * a request body straight into Mongo.
 */

export interface CrudConfig {
  collection: string;
  /** Whitelist of writable fields. */
  allowed: string[];
  /** Cascade deletes: [collection, foreign key on that collection]. */
  cascade?: [string, string][];
  /** GridFS bucket to clean up, reading the file id from this field. */
  gridFs?: { bucket: string; field: string };
  /** Human label used in error messages. */
  label?: string;
}

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const session = await auth();
  return session;
}

function badId() {
  return NextResponse.json({ error: "Invalid id" }, { status: 400 });
}

export function crudHandlers(cfg: CrudConfig) {
  const label = cfg.label || "record";

  async function GET(_request: Request, { params }: Params) {
    const session = await guard();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const { id } = await params;
      if (!ObjectId.isValid(id)) return badId();
      const client = await clientPromise;
      const db = client.db(FA_DB);
      const doc = await db.collection(cfg.collection).findOne({ _id: new ObjectId(id) });
      if (!doc) return NextResponse.json({ error: label + " not found" }, { status: 404 });
      return NextResponse.json(serialize(doc));
    } catch (error) {
      console.error("[FiberApp] " + label + " read failed:", error);
      return NextResponse.json({ error: "Failed to load " + label }, { status: 500 });
    }
  }

  async function PATCH(request: Request, { params }: Params) {
    const session = await guard();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const { id } = await params;
      if (!ObjectId.isValid(id)) return badId();
      const body = await request.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {};
      for (const k of cfg.allowed) {
        if (!(k in body)) continue;
        const v = body[k];
        update[k] =
          k.endsWith("Id") && typeof v === "string" && ObjectId.isValid(v)
            ? new ObjectId(v)
            : v;
      }
      if (!Object.keys(update).length) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }
      update.updatedAt = new Date();
      update.updatedBy = session.user?.name || session.user?.email || "system";

      const client = await clientPromise;
      const db = client.db(FA_DB);
      const result = await db
        .collection(cfg.collection)
        .updateOne({ _id: new ObjectId(id) }, { $set: update });

      if (!result.matchedCount) {
        return NextResponse.json({ error: label + " not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[FiberApp] " + label + " update failed:", error);
      return NextResponse.json({ error: "Failed to update " + label }, { status: 500 });
    }
  }

  async function DELETE(_request: Request, { params }: Params) {
    const session = await guard();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const { id } = await params;
      if (!ObjectId.isValid(id)) return badId();
      const oid = new ObjectId(id);

      const client = await clientPromise;
      const db = client.db(FA_DB);

      // Clean up any stored binary first
      if (cfg.gridFs) {
        const doc = await db.collection(cfg.collection).findOne({ _id: oid });
        const fileId = doc?.[cfg.gridFs.field];
        if (fileId && ObjectId.isValid(String(fileId))) {
          try {
            const bucket = new GridFSBucket(db, { bucketName: cfg.gridFs.bucket });
            await bucket.delete(new ObjectId(String(fileId)));
          } catch {
            /* already gone */
          }
        }
      }

      const result = await db.collection(cfg.collection).deleteOne({ _id: oid });
      if (!result.deletedCount) {
        return NextResponse.json({ error: label + " not found" }, { status: 404 });
      }

      if (cfg.cascade?.length) {
        await Promise.all(
          cfg.cascade.map(([col, field]) =>
            db.collection(col).deleteMany({ [field]: oid })
          )
        );
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[FiberApp] " + label + " delete failed:", error);
      return NextResponse.json({ error: "Failed to delete " + label }, { status: 500 });
    }
  }

  return { GET, PATCH, DELETE };
}
