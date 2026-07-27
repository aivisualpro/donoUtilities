"use client";

import * as React from "react";
import { IconSearch, type Icon } from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useInfiniteData } from "@/hooks/use-infinite-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface FaFilterDef {
  /** Query-param sent to the API. */
  param: string;
  /** Key inside the API's filterOptions payload. */
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
  /** Extra fixed query params (e.g. scoping to a project). */
  baseFilters?: Record<string, string>;
  /** Rendered between the header and the table. */
  banner?: React.ReactNode;
  /** Receives the loaded rows + raw response so callers can add summaries. */
  onData?: (rows: T[]) => void;
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
  onData,
}: FaListPageProps<T>) {
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [selected, setSelected] = React.useState<Record<string, string>>({});

  const serverFilters = React.useMemo(() => {
    const f: Record<string, string> = { ...(baseFilters || {}), ...selected };
    if (debounced) f.q = debounced;
    return f;
  }, [baseFilters, selected, debounced]);

  const {
    records,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    filterOptions,
  } = useInfiniteData<T>({ apiUrl, filters: serverFilters });

  React.useEffect(() => {
    onData?.(records);
  }, [records, onData]);

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
                  onValueChange={(v) =>
                    setSelected((prev) => ({ ...prev, [f.param]: v }))
                  }
                  placeholder={f.placeholder}
                  allLabel={f.allLabel}
                  options={filterOptions[f.optionsKey] || []}
                  className={f.className || "w-[150px]"}
                />
              ))}
            </>
          ) : undefined
        }
        actions={actions}
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
        onRowClick={onRowClick}
        renderCell={renderCell}
      />
    </>
  );
}

/** Small helper so simple pages can pass a Tabler icon straight through. */
export function emptyIconOf(I: Icon) {
  return <I className="size-8 opacity-40" />;
}
