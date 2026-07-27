"use client";

import { IconMapPin } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
import { StatusPill } from "@/components/fiber-app/fa-kit";
import type { ColumnDef } from "@/components/data-table";

interface Marker {
  _id: string;
  markerNumber: string;
  projectName: string;
  type: string;
  status: string;
  address: string;
  street: string;
  reportedBy: string;
  reportedAt: string;
}

const columns: ColumnDef<Marker>[] = [
  { label: "Marker", key: "markerNumber", width: "120px" },
  { label: "Project", key: "projectName", width: "220px" },
  { label: "Type", key: "type", width: "140px" },
  { label: "Status", key: "status", width: "170px" },
  { label: "Address", key: "address" },
  { label: "Reported By", key: "reportedBy", width: "160px" },
  { label: "Reported", key: "reportedAt", type: "date", width: "130px" },
];

export function MarkersContent() {
  return (
    <FaListPage<Marker>
      title="Markers & Lines"
      description="Every point of work reported from the field"
      apiUrl="/api/fiber-app/markers"
      columns={columns}
      searchPlaceholder="Search markers, addresses, crew..."
      emptyIcon={<IconMapPin className="size-8 opacity-40" />}
      emptyMessage="No markers reported yet"
      filters={[
        { param: "project", optionsKey: "projects", placeholder: "project", allLabel: "All Projects", className: "w-[180px]" },
        { param: "type", optionsKey: "types", placeholder: "type", allLabel: "All Types" },
        { param: "status", optionsKey: "statuses", placeholder: "status", allLabel: "All Statuses" },
      ]}
      renderCell={(row, col) =>
        col.key === "status" ? <StatusPill status={row.status} /> : undefined
      }
    />
  );
}
