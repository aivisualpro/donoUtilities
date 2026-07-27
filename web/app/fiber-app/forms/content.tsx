"use client";

import { IconChecklist } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
import type { FaField } from "@/components/fiber-app/fa-record-dialog";
import type { ColumnDef } from "@/components/data-table";

interface FormInstance {
  _id: string;
  templateName: string;
  projectName: string;
  submittedBy: string;
  submittedAt: string;
}

const columns: ColumnDef<FormInstance>[] = [
  { label: "Form", key: "templateName" },
  { label: "Project", key: "projectName", width: "240px" },
  { label: "Submitted By", key: "submittedBy", width: "180px" },
  { label: "Submitted", key: "submittedAt", type: "date", width: "140px" },
];

const fields: FaField[] = [
  { key: "templateName", label: "Form", required: true, optionsKey: "templates", type: "select" },
  { key: "submittedBy", label: "Submitted by", half: true },
  { key: "submittedAt", label: "Submitted", type: "date", half: true },
];

export function FormsContent() {
  return (
    <FaListPage<FormInstance>
      title="Forms"
      description="Field forms filled out on site"
      apiUrl="/api/fiber-app/forms"
      columns={columns}
      fields={fields}
      entityLabel="Form submission"
      allowCreate={false}
      searchPlaceholder="Search forms, crew..."
      emptyIcon={<IconChecklist className="size-8 opacity-40" />}
      emptyMessage="No form submissions yet"
      filters={[
        { param: "project", optionsKey: "projects", placeholder: "project", allLabel: "All Projects", className: "w-[180px]" },
        { param: "template", optionsKey: "templates", placeholder: "form", allLabel: "All Forms", className: "w-[190px]" },
      ]}
    />
  );
}
