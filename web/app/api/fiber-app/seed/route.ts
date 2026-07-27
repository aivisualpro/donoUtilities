import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";
import {
  FA,
  FA_DB,
  MARKER_TYPES,
  LINE_TYPES,
} from "@/lib/fiber-app";

/**
 * POST /api/fiber-app/seed        -> load a realistic demo dataset
 * POST /api/fiber-app/seed?reset=1 -> wipe FiberApp_* first, then load
 *
 * Deliberately opt-in: nothing is written until this endpoint is called.
 */

const CUSTOMERS = [
  { name: "Metronet", contact: "Dana Whitfield", email: "dana@metronet.com", phone: "(317) 555-0142", terms: "Net 30" },
  { name: "Brightspeed", contact: "Owen Marsh", email: "omarsh@brightspeed.com", phone: "(704) 555-0198", terms: "Net 45" },
  { name: "Conexon Connect", contact: "Priya Raman", email: "praman@conexon.com", phone: "(816) 555-0177", terms: "Net 30" },
  { name: "City of Bloomington", contact: "Hal Jensen", email: "hjensen@bloomington.gov", phone: "(812) 555-0110", terms: "Net 60" },
];

const CREW = [
  { name: "Marcus Webb", role: "manager", email: "mwebb@dono.com", phone: "(317) 555-0201" },
  { name: "Tony Alvarez", role: "foreman", email: "talvarez@dono.com", phone: "(317) 555-0202" },
  { name: "Dale Kirkpatrick", role: "foreman", email: "dkirk@dono.com", phone: "(317) 555-0203" },
  { name: "Jesse Cardenas", role: "crew", email: "jcardenas@dono.com", phone: "(317) 555-0204" },
  { name: "Brandon Ochoa", role: "crew", email: "bochoa@dono.com", phone: "(317) 555-0205" },
  { name: "Kyle Nguyen", role: "crew", email: "knguyen@dono.com", phone: "(317) 555-0206" },
  { name: "Sam Whitaker", role: "crew", email: "swhitaker@dono.com", phone: "(317) 555-0207" },
  { name: "Ray Bennett", role: "crew", email: "rbennett@dono.com", phone: "(317) 555-0208" },
];

const CODES = [
  { code: "UG-100", name: "Underground Conduit 1.25in", unit: "ft", teamPrice: 4.15, adminPrice: 6.75, category: "Underground" },
  { code: "UG-200", name: "Directional Bore", unit: "ft", teamPrice: 6.5, adminPrice: 10.25, category: "Underground" },
  { code: "UG-300", name: "Open Trench", unit: "ft", teamPrice: 3.25, adminPrice: 5.4, category: "Underground" },
  { code: "UG-400", name: "Road Crossing", unit: "ea", teamPrice: 425, adminPrice: 690, category: "Underground" },
  { code: "AE-100", name: "Aerial Strand Placement", unit: "ft", teamPrice: 1.85, adminPrice: 3.1, category: "Aerial" },
  { code: "AE-200", name: "Aerial Fiber Lash", unit: "ft", teamPrice: 1.4, adminPrice: 2.35, category: "Aerial" },
  { code: "AE-300", name: "Pole Transfer", unit: "ea", teamPrice: 185, adminPrice: 295, category: "Aerial" },
  { code: "SP-100", name: "Splice - Fusion per Fiber", unit: "ea", teamPrice: 12.5, adminPrice: 21, category: "Splicing" },
  { code: "SP-200", name: "Splice Enclosure Setup", unit: "ea", teamPrice: 240, adminPrice: 385, category: "Splicing" },
  { code: "ST-100", name: "Handhole 24x36", unit: "ea", teamPrice: 320, adminPrice: 515, category: "Structures" },
  { code: "ST-200", name: "Vault 30x48", unit: "ea", teamPrice: 640, adminPrice: 985, category: "Structures" },
  { code: "ST-300", name: "Pedestal Set", unit: "ea", teamPrice: 145, adminPrice: 240, category: "Structures" },
  { code: "DR-100", name: "Residential Drop", unit: "ea", teamPrice: 175, adminPrice: 285, category: "Drops" },
  { code: "DR-200", name: "Drop Bury", unit: "ft", teamPrice: 1.95, adminPrice: 3.25, category: "Drops" },
  { code: "LB-100", name: "Standard Labor", unit: "hr", teamPrice: 62, adminPrice: 98, category: "Labor" },
  { code: "LB-200", name: "Equipment Operator", unit: "hr", teamPrice: 85, adminPrice: 135, category: "Labor" },
];

const PROJECTS = [
  { name: "Fishers FTTH Phase 3", customer: "Metronet", city: "Fishers", state: "IN", build: "underground", budget: 486000, foreman: "Tony Alvarez", status: "active", crew: 6 },
  { name: "Zionsville Aerial Rebuild", customer: "Brightspeed", city: "Zionsville", state: "IN", build: "aerial", budget: 312000, foreman: "Dale Kirkpatrick", status: "active", crew: 4 },
  { name: "Noblesville MDU Drops", customer: "Metronet", city: "Noblesville", state: "IN", build: "drop", budget: 148000, foreman: "Tony Alvarez", status: "active", crew: 3 },
  { name: "Rural Route 42 Bore", customer: "Conexon Connect", city: "Greencastle", state: "IN", build: "directional_drill", budget: 725000, foreman: "Dale Kirkpatrick", status: "active", crew: 5 },
  { name: "Bloomington OSP Splice", customer: "City of Bloomington", city: "Bloomington", state: "IN", build: "splicing", budget: 96000, foreman: "Tony Alvarez", status: "pending", crew: 2 },
  { name: "Carmel Midtown Conduit", customer: "Metronet", city: "Carmel", state: "IN", build: "underground", budget: 534000, foreman: "Dale Kirkpatrick", status: "completed", crew: 6 },
  { name: "Westfield Backbone", customer: "Brightspeed", city: "Westfield", state: "IN", build: "underground", budget: 268000, foreman: "Tony Alvarez", status: "archived", crew: 4 },
];

const STREETS = ["Oak Ridge Dr", "Sycamore Ln", "Willow Creek Blvd", "Prairie View Ct", "Maple Grove Rd", "Cedar Hollow Way", "Birchwood Trl", "Stonegate Pkwy"];

/** Deterministic PRNG so repeat seeds look identical. */
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const POST = withAuth(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const reset = searchParams.get("reset") === "1";
    const actor = session.user?.name || session.user?.email || "demo";

    const client = await clientPromise;
    const db = client.db(FA_DB);
    const rng = makeRng(20260727);

    if (reset) {
      await Promise.all(Object.values(FA).map((c) => db.collection(c).deleteMany({})));
    }

    const existing = await db.collection(FA.Projects).countDocuments();
    if (existing > 0 && !reset) {
      return NextResponse.json(
        { error: "Demo data already present. Call with ?reset=1 to rebuild." },
        { status: 409 }
      );
    }

    const now = Date.now();
    const daysAgo = (d: number) => new Date(now - d * 86400000);

    /* ---- Customers ---- */
    const customerDocs = CUSTOMERS.map((c) => ({
      _id: new ObjectId(),
      name: c.name,
      contact: c.contact,
      email: c.email,
      phone: c.phone,
      terms: c.terms,
      createdAt: daysAgo(200),
    }));
    await db.collection(FA.Customers).insertMany(customerDocs);

    /* ---- Crew ---- */
    const memberDocs = CREW.map((m, i) => ({
      _id: new ObjectId(),
      name: m.name,
      role: m.role,
      email: m.email,
      phone: m.phone,
      active: true,
      seatPrice: m.role === "manager" ? 149 : m.role === "foreman" ? 129 : 49,
      lastSyncAt: daysAgo(rng() * 2),
      createdAt: daysAgo(180 - i * 5),
    }));
    await db.collection(FA.Members).insertMany(memberDocs);

    /* ---- Billing codes ---- */
    const codeDocs = CODES.map((c, i) => ({
      _id: new ObjectId(),
      code: c.code,
      name: c.name,
      unit: c.unit,
      teamPrice: c.teamPrice,
      adminPrice: c.adminPrice,
      category: c.category,
      sortOrder: i,
      active: true,
      createdAt: daysAgo(190),
    }));
    await db.collection(FA.BillingCodes).insertMany(codeDocs);

    /* ---- Form templates ---- */
    const formTemplates = [
      { name: "Daily Production Report", fields: ["Crew", "Weather", "Footage Completed", "Equipment Hours", "Notes"] },
      { name: "Splice Closure QC", fields: ["Closure ID", "Fiber Count", "Loss Reading (dB)", "OTDR Photo", "Pass/Fail"] },
      { name: "Bore Log", fields: ["Bore Depth", "Soil Type", "Rods Used", "Utility Strikes", "Locate Ticket #"] },
      { name: "Safety Toolbox Talk", fields: ["Topic", "Attendees", "Hazards Identified", "Signature"] },
    ].map((f, i) => ({
      _id: new ObjectId(),
      name: f.name,
      fields: f.fields.map((label, idx) => ({ label, type: idx === 4 ? "select" : "text", required: idx < 2 })),
      active: true,
      sortOrder: i,
      createdAt: daysAgo(150),
    }));
    await db.collection(FA.FormTemplates).insertMany(formTemplates);

    /* ---- Projects + children ---- */
    const projectDocs: Record<string, unknown>[] = [];
    const markerDocs: Record<string, unknown>[] = [];
    const lineDocs: Record<string, unknown>[] = [];
    const entryDocs: Record<string, unknown>[] = [];
    const photoDocs: Record<string, unknown>[] = [];
    const formDocs: Record<string, unknown>[] = [];
    const docDocs: Record<string, unknown>[] = [];
    const batchDocs: Record<string, unknown>[] = [];
    const inspectionDocs: Record<string, unknown>[] = [];
    const activityDocs: Record<string, unknown>[] = [];

    PROJECTS.forEach((p, pi) => {
      const pid = new ObjectId();
      const started = 120 - pi * 12;
      projectDocs.push({
        _id: pid,
        projectNumber: "FF-" + (1001 + pi),
        name: p.name,
        customerName: p.customer,
        city: p.city,
        state: p.state,
        status: p.status,
        buildType: p.build,
        foreman: p.foreman,
        crewSize: p.crew,
        budget: p.budget,
        planFileName: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-prints.pdf",
        planUrl: "",
        startDate: daysAgo(started).toISOString().slice(0, 10),
        dueDate: daysAgo(started - 150).toISOString().slice(0, 10),
        notes: "",
        createdAt: daysAgo(started),
        createdBy: actor,
      });

      const isDead = p.status === "archived";
      const markerN = isDead ? 6 : 14 + Math.floor(rng() * 10);

      for (let m = 0; m < markerN; m++) {
        const mid = new ObjectId();
        const type = MARKER_TYPES[Math.floor(rng() * MARKER_TYPES.length)];
        const roll = rng();
        const status =
          p.status === "completed" ? "invoiced"
            : roll > 0.82 ? "inspection_pending"
            : roll > 0.66 ? "ready_for_billing"
            : roll > 0.34 ? "completed"
            : roll > 0.15 ? "in_progress"
            : "not_started";
        const reportedAt = daysAgo(Math.max(1, started - Math.floor(rng() * started)));
        const crewMember = CREW[3 + Math.floor(rng() * 5)];

        markerDocs.push({
          _id: mid,
          projectId: pid,
          projectName: p.name,
          markerNumber: type.slice(0, 2).toUpperCase() + "-" + String(m + 1).padStart(3, "0"),
          type,
          status,
          street: STREETS[Math.floor(rng() * STREETS.length)],
          address: String(100 + Math.floor(rng() * 8000)) + " " + STREETS[Math.floor(rng() * STREETS.length)],
          lat: 39.85 + rng() * 0.45,
          lng: -86.35 + rng() * 0.5,
          planX: Math.round(rng() * 1000) / 1000,
          planY: Math.round(rng() * 1000) / 1000,
          reportedBy: crewMember.name,
          reportedAt,
          notes: "",
          createdAt: reportedAt,
        });

        // Billing entries for work that's actually been done
        if (!["not_started"].includes(status)) {
          const nCodes = 1 + Math.floor(rng() * 2);
          for (let c = 0; c < nCodes; c++) {
            const code = CODES[Math.floor(rng() * CODES.length)];
            const qty =
              code.unit === "ft" ? Math.round(40 + rng() * 560)
                : code.unit === "hr" ? Math.round(2 + rng() * 8)
                : 1 + Math.floor(rng() * 3);
            const eStatus =
              status === "invoiced" ? "invoiced"
                : status === "ready_for_billing" ? "ready_for_billing"
                : status === "inspection_pending" ? "inspection_pending"
                : "in_progress";
            entryDocs.push({
              _id: new ObjectId(),
              projectId: pid,
              projectName: p.name,
              markerId: mid,
              codeId: code.code,
              codeName: code.code + " " + code.name,
              unit: code.unit,
              quantity: qty,
              teamRate: code.teamPrice,
              adminRate: code.adminPrice,
              total: Math.round(qty * code.adminPrice * 100) / 100,
              teamTotal: Math.round(qty * code.teamPrice * 100) / 100,
              status: eStatus,
              reportedBy: crewMember.name,
              reportedAt,
              createdAt: reportedAt,
            });
          }
        }

        // Photos as proof
        if (rng() > 0.35) {
          const nPhotos = 1 + Math.floor(rng() * 3);
          for (let ph = 0; ph < nPhotos; ph++) {
            photoDocs.push({
              _id: new ObjectId(),
              projectId: pid,
              projectName: p.name,
              markerId: mid,
              caption: type + " " + ["before", "during", "after", "as-built"][Math.floor(rng() * 4)],
              url: "",
              lat: 39.85 + rng() * 0.45,
              lng: -86.35 + rng() * 0.5,
              takenBy: crewMember.name,
              takenAt: reportedAt,
              createdAt: reportedAt,
            });
          }
        }

        if (status === "inspection_pending" || status === "invoiced") {
          inspectionDocs.push({
            _id: new ObjectId(),
            projectId: pid,
            projectName: p.name,
            markerId: mid,
            result: status === "invoiced" ? "approved" : "pending",
            inspector: p.foreman,
            notes: "",
            inspectedAt: status === "invoiced" ? reportedAt : null,
            createdAt: reportedAt,
          });
        }
      }

      // Lines (footage runs)
      const lineN = isDead ? 3 : 6 + Math.floor(rng() * 6);
      for (let l = 0; l < lineN; l++) {
        const lt = LINE_TYPES[Math.floor(rng() * LINE_TYPES.length)];
        const footage = Math.round(120 + rng() * 1400);
        const reportedAt = daysAgo(Math.max(1, started - Math.floor(rng() * started)));
        // Give every line a plausible polyline so it renders on the plan
        const segs = 2 + Math.floor(rng() * 3);
        const startX = 0.08 + rng() * 0.7;
        const startY = 0.1 + rng() * 0.7;
        const points = [{ x: Math.round(startX * 1000) / 1000, y: Math.round(startY * 1000) / 1000 }];
        for (let sIdx = 0; sIdx < segs; sIdx++) {
          const prev = points[points.length - 1];
          points.push({
            x: Math.round(Math.min(0.96, Math.max(0.04, prev.x + (rng() - 0.35) * 0.22)) * 1000) / 1000,
            y: Math.round(Math.min(0.96, Math.max(0.04, prev.y + (rng() - 0.45) * 0.18)) * 1000) / 1000,
          });
        }

        lineDocs.push({
          _id: new ObjectId(),
          projectId: pid,
          projectName: p.name,
          lineNumber: "L-" + String(l + 1).padStart(3, "0"),
          type: lt,
          footage,
          status: rng() > 0.4 ? "completed" : "in_progress",
          street: STREETS[Math.floor(rng() * STREETS.length)],
          points,
          planPage: 1,
          reportedBy: CREW[3 + Math.floor(rng() * 5)].name,
          reportedAt,
          createdAt: reportedAt,
        });
      }

      // Form submissions
      for (let f = 0; f < (isDead ? 2 : 5); f++) {
        const tpl = formTemplates[Math.floor(rng() * formTemplates.length)];
        const at = daysAgo(Math.max(1, started - Math.floor(rng() * started)));
        formDocs.push({
          _id: new ObjectId(),
          projectId: pid,
          projectName: p.name,
          templateId: tpl._id,
          templateName: tpl.name,
          submittedBy: CREW[3 + Math.floor(rng() * 5)].name,
          submittedAt: at,
          values: {},
          createdAt: at,
        });
      }

      // Project documents
      ["Construction Prints.pdf", "Permit Package.pdf", "Locate Tickets.pdf", "As-Built Export.pdf"].forEach((n, di) => {
        docDocs.push({
          _id: new ObjectId(),
          projectId: pid,
          projectName: p.name,
          folder: di < 2 ? "Plans & Permits" : "Closeout",
          name: n,
          sizeKb: Math.round(200 + rng() * 8000),
          uploadedBy: p.foreman,
          uploadedAt: daysAgo(started - di * 4),
          createdAt: daysAgo(started - di * 4),
        });
      });

      // Billing batches
      const nBatch = p.status === "completed" ? 3 : p.status === "active" ? 2 : 0;
      for (let b = 0; b < nBatch; b++) {
        const at = daysAgo(Math.max(2, started - 30 - b * 25));
        batchDocs.push({
          _id: new ObjectId(),
          projectId: pid,
          projectName: p.name,
          batchNumber: "B-" + (1001 + pi) + "-" + String(b + 1).padStart(2, "0"),
          status: b === 0 && p.status !== "completed" ? "generated" : "invoiced",
          periodStart: daysAgo(Math.max(2, started - 30 - b * 25) + 14).toISOString().slice(0, 10),
          periodEnd: at.toISOString().slice(0, 10),
          total: Math.round((8000 + rng() * 42000) * 100) / 100,
          invoiceNumber: b === 0 && p.status !== "completed" ? "" : "INV-" + (5200 + pi * 5 + b),
          documentUrl: "",
          generatedBy: "Marcus Webb",
          generatedAt: at,
          createdAt: at,
        });
      }

      activityDocs.push({
        _id: new ObjectId(),
        projectId: pid,
        type: "project_created",
        message: "Project " + p.name + " created for " + p.customer,
        actor: "Marcus Webb",
        createdAt: daysAgo(started),
      });
    });

    // A few recent, human-looking activity lines for the feed
    const recent = [
      { t: "work_reported", m: "Jesse Cardenas reported 480 ft of UG-100 on Fishers FTTH Phase 3", a: "Jesse Cardenas", d: 0.2 },
      { t: "photo_uploaded", m: "Kyle Nguyen uploaded 6 GPS-tagged photos to Rural Route 42 Bore", a: "Kyle Nguyen", d: 0.5 },
      { t: "inspection", m: "Tony Alvarez approved 12 markers on Noblesville MDU Drops", a: "Tony Alvarez", d: 1.1 },
      { t: "billing_generated", m: "Billing doc B-1001-02 generated for Fishers FTTH Phase 3", a: "Marcus Webb", d: 1.6 },
      { t: "invoice", m: "Invoice INV-5203 sent to Metronet via QuickBooks", a: "Marcus Webb", d: 2.2 },
      { t: "form_submitted", m: "Brandon Ochoa submitted a Bore Log on Rural Route 42 Bore", a: "Brandon Ochoa", d: 2.8 },
      { t: "sync", m: "Sam Whitaker synced 23 offline records from the field", a: "Sam Whitaker", d: 3.4 },
    ];
    recent.forEach((r) =>
      activityDocs.push({
        _id: new ObjectId(),
        type: r.t,
        message: r.m,
        actor: r.a,
        createdAt: daysAgo(r.d),
      })
    );

    await Promise.all([
      db.collection(FA.Projects).insertMany(projectDocs),
      db.collection(FA.Markers).insertMany(markerDocs),
      db.collection(FA.Lines).insertMany(lineDocs),
      db.collection(FA.BillingEntries).insertMany(entryDocs),
      db.collection(FA.Photos).insertMany(photoDocs),
      db.collection(FA.FormInstances).insertMany(formDocs),
      db.collection(FA.Documents).insertMany(docDocs),
      db.collection(FA.BillingBatches).insertMany(batchDocs),
      db.collection(FA.Inspections).insertMany(inspectionDocs),
      db.collection(FA.Activity).insertMany(activityDocs),
    ]);

    return NextResponse.json({
      ok: true,
      inserted: {
        projects: projectDocs.length,
        markers: markerDocs.length,
        lines: lineDocs.length,
        billingEntries: entryDocs.length,
        photos: photoDocs.length,
        forms: formDocs.length,
        documents: docDocs.length,
        batches: batchDocs.length,
        inspections: inspectionDocs.length,
        customers: customerDocs.length,
        crew: memberDocs.length,
        billingCodes: codeDocs.length,
      },
    });
  } catch (error) {
    console.error("[FiberApp] Seed failed:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
});

export const DELETE = withAuth(async () => {
  try {
    const client = await clientPromise;
    const db = client.db(FA_DB);
    await Promise.all(Object.values(FA).map((c) => db.collection(c).deleteMany({})));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FiberApp] Wipe failed:", error);
    return NextResponse.json({ error: "Wipe failed" }, { status: 500 });
  }
});
