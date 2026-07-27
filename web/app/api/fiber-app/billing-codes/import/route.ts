import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import { FA, FA_DB, UNITS } from "@/lib/fiber-app";

export interface ParsedCode {
  code: string;
  name: string;
  unit: string;
  teamPrice: number;
  adminPrice: number;
  category: string;
}

const HEADER_HINTS = ["code", "description", "name", "unit", "rate", "price", "category"];

function splitRow(line: string): string[] {
  // Tab-delimited wins (spreadsheet paste); otherwise CSV with quote support.
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim()); cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function toNumber(v: string): number {
  const n = parseFloat(String(v || "").replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Parses pasted CSV/TSV into billing codes.
 * Expected columns: Code, Description, Unit, Crew Rate, Bill Rate, Category
 * Extra columns are ignored; a header row is detected and skipped.
 */
export function parseCodes(text: string): { rows: ParsedCode[]; skipped: number } {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let skipped = 0;
  const rows: ParsedCode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (cells.length < 2) { skipped++; continue; }

    // Skip a header row
    if (i === 0) {
      const joined = cells.join(" ").toLowerCase();
      const hits = HEADER_HINTS.filter((h) => joined.includes(h)).length;
      if (hits >= 2 && toNumber(cells[3] || "") === 0 && toNumber(cells[4] || "") === 0) {
        continue;
      }
    }

    const code = cells[0];
    if (!code) { skipped++; continue; }

    const rawUnit = (cells[2] || "ea").toLowerCase();
    const unit = (UNITS as readonly string[]).includes(rawUnit) ? rawUnit : "ea";
    const teamPrice = toNumber(cells[3]);
    const adminPrice = toNumber(cells[4]) || teamPrice;

    rows.push({
      code,
      name: cells[1] || code,
      unit,
      teamPrice,
      adminPrice,
      category: cells[5] || "Imported",
    });
  }

  return { rows, skipped };
}

/** POST { text } — parse and upsert by code. Returns created/updated counts. */
export const POST = withAuth(async (request, { session }) => {
  try {
    const body = await request.json();
    const { rows, skipped } = parseCodes(body?.text || "");

    if (!rows.length) {
      return NextResponse.json(
        { error: "Nothing parsed. Expected: Code, Description, Unit, Crew Rate, Bill Rate, Category" },
        { status: 400 }
      );
    }

    // Preview mode — parse only, write nothing.
    if (body?.dryRun) {
      return NextResponse.json({ ok: true, preview: rows, parsed: rows.length, skipped });
    }

    const actor = session.user?.name || session.user?.email || "system";
    const client = await clientPromise;
    const db = client.db(FA_DB);
    const col = db.collection(FA.BillingCodes);

    const startOrder = await col.countDocuments();
    const ops = rows.map((r, i) => ({
      updateOne: {
        filter: { code: r.code },
        update: {
          $set: {
            code: r.code,
            name: r.name,
            unit: r.unit,
            teamPrice: r.teamPrice,
            adminPrice: r.adminPrice,
            category: r.category,
            active: true,
            updatedAt: new Date(),
            updatedBy: actor,
          },
          $setOnInsert: { sortOrder: startOrder + i, createdAt: new Date() },
        },
        upsert: true,
      },
    }));

    const result = await col.bulkWrite(ops, { ordered: false });

    return NextResponse.json({
      ok: true,
      parsed: rows.length,
      skipped,
      created: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("[FiberApp] Billing code import failed:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
});
