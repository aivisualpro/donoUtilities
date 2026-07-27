"use client";

import { IconAddressBook } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
import type { FaField } from "@/components/fiber-app/fa-record-dialog";
import type { ColumnDef } from "@/components/data-table";

interface Customer {
  _id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  terms: string;
}

const columns: ColumnDef<Customer>[] = [
  { label: "Customer", key: "name", width: "240px" },
  { label: "Contact", key: "contact", width: "200px" },
  { label: "Email", key: "email" },
  { label: "Phone", key: "phone", width: "160px" },
  { label: "Terms", key: "terms", type: "badge", width: "110px" },
];

const fields: FaField[] = [
  { key: "name", label: "Customer", required: true, placeholder: "Metronet" },
  { key: "contact", label: "Contact", half: true, placeholder: "Dana Whitfield" },
  { key: "terms", label: "Terms", type: "select", half: true, options: ["Net 15", "Net 30", "Net 45", "Net 60", "Due on receipt"] },
  { key: "email", label: "Email", type: "email", half: true, placeholder: "dana@metronet.com" },
  { key: "phone", label: "Phone", type: "tel", half: true, placeholder: "(317) 555-0142" },
];

export function CustomersContent() {
  return (
    <FaListPage<Customer>
      title="Customers"
      description="Who you bill, and on what terms"
      apiUrl="/api/fiber-app/customers"
      columns={columns}
      fields={fields}
      entityLabel="Customer"
      searchPlaceholder="Search customers..."
      emptyIcon={<IconAddressBook className="size-8 opacity-40" />}
      emptyMessage="No customers yet"
      filters={[
        { param: "terms", optionsKey: "terms", placeholder: "terms", allLabel: "All Terms", className: "w-[130px]" },
      ]}
    />
  );
}
