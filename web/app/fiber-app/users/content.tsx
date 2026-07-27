"use client";

import { IconUsersGroup } from "@tabler/icons-react";
import { FaListPage } from "@/components/fiber-app/fa-list-page";
import type { ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ROLE_META, type Role } from "@/lib/fiber-app";

interface Member {
  _id: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  seatPrice: number;
  lastSyncAt: string;
}

const columns: ColumnDef<Member>[] = [
  { label: "Name", key: "name", width: "200px" },
  { label: "Role", key: "role", width: "130px" },
  { label: "Permissions", key: "_perm" },
  { label: "Email", key: "email", width: "230px" },
  { label: "Phone", key: "phone", width: "150px" },
  { label: "Seat", key: "seatPrice", type: "dollar", width: "100px" },
  { label: "Last Sync", key: "lastSyncAt", type: "date", width: "130px" },
];

export function CrewContent() {
  return (
    <FaListPage<Member>
      title="Crew"
      description="Seats, roles and what each person can do"
      apiUrl="/api/fiber-app/users"
      columns={columns}
      searchPlaceholder="Search crew..."
      emptyIcon={<IconUsersGroup className="size-8 opacity-40" />}
      emptyMessage="No crew members yet"
      filters={[
        { param: "role", optionsKey: "roles", placeholder: "role", allLabel: "All Roles", className: "w-[130px]" },
      ]}
      renderCell={(row, col) => {
        if (col.key === "role") {
          const meta = ROLE_META[row.role];
          return (
            <Badge variant={row.role === "manager" ? "default" : row.role === "foreman" ? "secondary" : "outline"}>
              {meta?.label || row.role}
            </Badge>
          );
        }
        if (col.key === "_perm") {
          return (
            <span className="text-[11px] text-muted-foreground">
              {ROLE_META[row.role]?.blurb || "—"}
            </span>
          );
        }
        return undefined;
      }}
    />
  );
}
