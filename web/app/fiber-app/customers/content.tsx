"use client";

import { IconAddressBook } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
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

export function CustomersContent() {
  return (
    <FaListPage<Customer>
      title="Customers"
      description="Who you bill, and on what terms"
      apiUrl="/api/fiber-app/customers"
      columns={columns}
      searchPlaceholder="Search customers..."
      emptyIcon={<IconAddressBook className="size-8 opacity-40" />}
      emptyMessage="No customers yet"
      filters={[
        { param: "terms", optionsKey: "terms", placeholder: "terms", allLabel: "All Terms", className: "w-[130px]" },
      ]}
    />
  );
}
