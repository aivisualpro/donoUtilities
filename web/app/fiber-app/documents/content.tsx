"use client";

import { IconFolder } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
import type { FaField } from "@/components/fiber-app/fa-record-dialog";
import type { ColumnDef } from "@/components/data-table";

interface Doc {
  _id: string;
  name: string;
  folder: string;
  projectName: string;
  sizeKb: number;
  uploadedBy: string;
  uploadedAt: string;
}

const columns: ColumnDef<Doc>[] = [
  { label: "Document", key: "name" },
  { label: "Folder", key: "folder", width: "170px" },
  { label: "Project", key: "projectName", width: "220px" },
  { label: "Size", key: "sizeKb", width: "100px" },
  { label: "Uploaded By", key: "uploadedBy", width: "160px" },
  { label: "Uploaded", key: "uploadedAt", type: "date", width: "130px" },
];

const fields: FaField[] = [
  { key: "name", label: "Document", required: true, placeholder: "Permit Package.pdf" },
  { key: "folder", label: "Folder", type: "select", half: true, optionsKey: "folders" },
  { key: "uploadedBy", label: "Uploaded by", half: true },
];

export function DocumentsContent() {
  return (
    <FaListPage<Doc>
      title="Documents"
      description="Plans, permits, locate tickets and closeout packages"
      apiUrl="/api/fiber-app/documents"
      columns={columns}
      fields={fields}
      entityLabel="Document"
      allowCreate={false}
      searchPlaceholder="Search documents..."
      emptyIcon={<IconFolder className="size-8 opacity-40" />}
      emptyMessage="No documents uploaded yet"
      filters={[
        { param: "project", optionsKey: "projects", placeholder: "project", allLabel: "All Projects", className: "w-[180px]" },
        { param: "folder", optionsKey: "folders", placeholder: "folder", allLabel: "All Folders" },
      ]}
      renderCell={(row, col) =>
        col.key === "sizeKb" ? (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.sizeKb >= 1024
              ? (row.sizeKb / 1024).toFixed(1) + " MB"
              : row.sizeKb + " KB"}
          </span>
        ) : undefined
      }
    />
  );
}
