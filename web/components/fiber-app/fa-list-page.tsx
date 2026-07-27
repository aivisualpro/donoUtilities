"use client";

import * as React from "react";
import { IconPlus, IconSearch } from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  FaRecordDialog,
  type FaField,
  type FaRecord,
} from "@/components/fiber-app/fa-record-dialog";

export interface FaFilterDef {
  param: string;
  optionsKey: string;
  placeholder: string;
  allLabel: string;
  className?: string;
}

export interface FaListPageProps<T extends { _id: string }> {
  title: string;
  description?: string;
  apiUrl: string;
  columns: ColumnDef<T>[];
  filters?: FaFilterDef[];
  searchPlaceholder?: string;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  actions?: React.ReactNode;
  onRowClick?: (row: T) => void;
  renderCell?: (row: T, col: ColumnDef<T>) => React.ReactNode | undefined;
  baseFilters?: Record<string, string>;
  banner?: React.ReactNode;

  /* ---- CRUD ---- */
  /** Supplying fields turns on create / edit / delete for this collection. */
  fields?: FaField[];
  /** Singular label, e.g. "Customer". Defaults to the title minus a trailing "s". */
  entityLabel?: string;
  /** Extra values merged into every create payload. */
  createExtra?: Record<string, unknown>;
  allowCreate?: boolean;
  allowDelete?: boolean;
  /** Bump to force a refetch from outside. */
  reloadToken?: number;
}

export function FaListPage<T extends { _id: string }>({
  title,
  description,
  apiUrl,
  columns,
  filters = [],
  searchPlaceholder = "Search...",
  emptyIcon,
  emptyMessage,
  actions,
  onRowClick,
  renderCell,
  baseFilters,
  banner,
  fields,
  entityLabel,
  createExtra,
  allowCreate = true,
  allowDelete = true,
  reloadToken = 0,
}: FaListPageProps<T>) {
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [selected, setSelected] = React.useState<Record<string, string>>({});
  const [localToken, setLocalToken] = React.useState(0);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FaRecord | null>(null);

  const crudEnabled = !!fields?.length;
  const label = entityLabel || title.replace(/s$/, "");

  const serverFilters = React.useMemo(() => {
    const f: Record<string, string> = { ...(baseFilters || {}), ...selected };
    if (debounced) f.q = debounced;
    // `_r` is ignored server-side; it just busts the memo so we refetch.
    f._r = String(localToken + reloadToken);
    return f;
  }, [baseFilters, selected, debounced, localToken, reloadToken]);

  const {
    records,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    filterOptions,
  } = useInfiniteData<T>({ apiUrl, filters: serverFilters });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleRowClick(row: T) {
    if (onRowClick) { onRowClick(row); return; }
    if (!crudEnabled) return;
    setEditing(row as unknown as FaRecord);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
        filters={
          filters.length ? (
            <>
              {filters.map((f) => (
                <FilterSelect
                  key={f.param}
                  value={selected[f.param] || "all"}
                  onValueChange={(v) => setSelected((prev) => ({ ...prev, [f.param]: v }))}
                  placeholder={f.placeholder}
                  allLabel={f.allLabel}
                  options={filterOptions[f.optionsKey] || []}
                  className={f.className || "w-[150px]"}
                />
              ))}
            </>
          ) : undefined
        }
        actions={
          <>
            {actions}
            {crudEnabled && allowCreate && (
              <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
                <IconPlus className="mr-1 size-3.5" />
                New {label.toLowerCase()}
              </Button>
            )}
          </>
        }
      />

      {banner}

      <DataTable<T>
        columns={columns}
        data={records}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        totalCount={totalCount}
        onLoadMore={loadMore}
        emptyIcon={emptyIcon}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick || crudEnabled ? handleRowClick : undefined}
        renderCell={renderCell}
      />

      {crudEnabled && (
        <FaRecordDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entityLabel={label}
          fields={fields!}
          apiUrl={apiUrl}
          record={editing}
          extra={createExtra}
          filterOptions={filterOptions}
          allowDelete={allowDelete}
          onSaved={() => setLocalToken((t) => t + 1)}
        />
      )}
    </>
  );
}
