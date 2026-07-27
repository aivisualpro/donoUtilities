"use client";

import { IconCamera } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
import type { ColumnDef } from "@/components/data-table";

interface Photo {
  _id: string;
  caption: string;
  projectName: string;
  takenBy: string;
  takenAt: string;
  lat: number;
  lng: number;
}

const columns: ColumnDef<Photo>[] = [
  { label: "Caption", key: "caption" },
  { label: "Project", key: "projectName", width: "220px" },
  { label: "Taken By", key: "takenBy", width: "160px" },
  { label: "GPS", key: "lat", width: "170px" },
  { label: "Taken", key: "takenAt", type: "date", width: "130px" },
];

export function PhotosContent() {
  return (
    <FaListPage<Photo>
      title="Photos"
      description="GPS-tagged proof of work, every job in one place"
      apiUrl="/api/fiber-app/photos"
      columns={columns}
      searchPlaceholder="Search captions, crew..."
      emptyIcon={<IconCamera className="size-8 opacity-40" />}
      emptyMessage="No photos uploaded yet"
      filters={[
        { param: "project", optionsKey: "projects", placeholder: "project", allLabel: "All Projects", className: "w-[180px]" },
        { param: "takenBy", optionsKey: "photographers", placeholder: "crew", allLabel: "All Crew" },
      ]}
      renderCell={(row, col) =>
        col.key === "lat" ? (
          <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
            {row.lat ? row.lat.toFixed(4) + ", " + row.lng.toFixed(4) : "—"}
          </span>
        ) : undefined
      }
    />
  );
}
