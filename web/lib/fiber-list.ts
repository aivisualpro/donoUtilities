import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { FA_DB } from "@/lib/fiber-app";

const PAGE_SIZE = 100;

export interface ListConfig {
  collection: string;
  /** Fields matched (case-insensitive regex) by the ?q= search box. */
  searchFields?: string[];
  /** Map of query-param name -> document field for exact-match filters. */
  filterFields?: Record<string, string>;
  /** Fields exposed as distinct filter option lists on page 1. */
  distinctFields?: Record<string, string>;
  /** Default sort. */
  sort?: Record<string, 1 | -1>;
  /** Extra aggregation stages inserted before pagination. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stages?: Record<string, any>[];
}

/** Serialize a Mongo doc: ObjectIds -> strings, Dates -> ISO. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(d: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v instanceof ObjectId) out[k] = v.toString();
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (Array.isArray(v)) out[k] = v.map((x) => (x instanceof ObjectId ? x.toString() : x));
    else out[k] = v;
  }
  return out;
}

/** Shared paginated list handler used by every simple FiberApp collection route. */
export async function listHandler(request: Request, cfg: ListConfig) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;
  const q = (searchParams.get("q") || "").trim();

  const client = await clientPromise;
  const db = client.db(FA_DB);
  const col = db.collection(cfg.collection);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match: Record<string, any> = {};

  for (const [param, field] of Object.entries(cfg.filterFields || {})) {
    const val = searchParams.get(param);
    if (val && val !== "all") {
      if (field.endsWith("Id") && ObjectId.isValid(val)) match[field] = new ObjectId(val);
      else match[field] = val;
    }
  }

  if (q && cfg.searchFields?.length) {
    match.$or = cfg.searchFields.map((f) => ({ [f]: { $regex: q, $options: "i" } }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline: Record<string, any>[] = [];
  if (Object.keys(match).length) pipeline.push({ $match: match });
  if (cfg.stages?.length) pipeline.push(...cfg.stages);
  pipeline.push({
    $facet: {
      data: [{ $sort: cfg.sort || { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: PAGE_SIZE }],
      totalCount: [{ $count: "count" }],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = (await col.aggregate(pipeline).toArray()) as any[];
  const data = (result?.data || []).map(serialize);
  const totalCount = result?.totalCount?.[0]?.count || 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: Record<string, any> = {
    data,
    page,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE) || 1,
  };

  if (page === 1 && cfg.distinctFields) {
    const keys = Object.keys(cfg.distinctFields);
    const values = await Promise.all(
      keys.map((k) => col.distinct(cfg.distinctFields![k]))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: Record<string, any> = {};
    keys.forEach((k, i) => {
      opts[k] = (values[i] as string[]).filter(Boolean).map(String).sort();
    });
    response.filterOptions = opts;
  }

  return NextResponse.json(response);
}

/** Insert helper that stamps createdAt / createdBy and coerces *Id fields. */
export async function createDoc(
  collection: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
  actor: string
) {
  const client = await clientPromise;
  const db = client.db(FA_DB);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: Record<string, any> = { ...body };
  for (const [k, v] of Object.entries(doc)) {
    if (k.endsWith("Id") && typeof v === "string" && ObjectId.isValid(v)) {
      doc[k] = new ObjectId(v);
    }
  }
  doc.createdAt = new Date();
  doc.createdBy = actor;
  const result = await db.collection(collection).insertOne(doc);
  return { _id: result.insertedId.toString(), ...serialize(doc) };
}
