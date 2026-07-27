"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconCloudCheck, IconCloudOff, IconRefresh } from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import { StatCard } from "@/components/fiber-app/fa-kit";
import { ROLE_META, type Role } from "@/lib/fiber-app";

interface Member {
  _id: string;
  name: string;
  role: Role;
  email: string;
  lastSyncAt: string;
  active: boolean;
}

function since(iso: string) {
  if (!iso) return { label: "never", stale: true };
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (hrs < 1) return { label: Math.max(1, Math.round(hrs * 60)) + "m ago", stale: false };
  if (hrs < 24) return { label: Math.round(hrs) + "h ago", stale: hrs > 12 };
  return { label: Math.round(hrs / 24) + "d ago", stale: true };
}

export function SyncStatusContent() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fiber-app/users");
      const json = await res.json();
      setMembers(json.data || []);
    } catch {
      toast.error("Could not load sync status");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const stale = members.filter((m) => since(m.lastSyncAt).stale).length;
  const seatCost = members.reduce(
    (a, m) => a + (ROLE_META[m.role]?.price || 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Sync Status"
        description="Which devices have pushed their offline work"
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={load}>
            <IconRefresh className="mr-1 size-3.5" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <FiberLoadingAnimation />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex flex-col gap-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Devices" value={members.length} hint="Seats with app access" icon={IconCloudCheck} accent="chart1" />
              <StatCard label="In Sync" value={members.length - stale} hint="Synced in the last 12h" icon={IconCloudCheck} accent="chart2" />
              <StatCard label="Stale" value={stale} hint="Needs coverage to push" icon={IconCloudOff} accent="chart5" />
              <StatCard label="Seat Cost" value={"$" + seatCost.toLocaleString() + "/mo"} hint="Across all roles" accent="chart3" />
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Crew Member</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Last Sync</TableHead>
                    <TableHead className="text-right text-xs">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const s = since(m.lastSyncAt);
                    return (
                      <TableRow key={m._id}>
                        <TableCell className="text-xs font-medium">{m.name}</TableCell>
                        <TableCell className="text-xs">{ROLE_META[m.role]?.label || m.role}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.email}</TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">{s.label}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.stale ? "secondary" : "default"} className="gap-1">
                            {s.stale ? <IconCloudOff className="size-3" /> : <IconCloudCheck className="size-3" />}
                            {s.stale ? "Pending" : "Synced"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                        No crew members yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
