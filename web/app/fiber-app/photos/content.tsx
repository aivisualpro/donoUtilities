"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconCamera, IconSearch } from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FiberLoadingAnimation } from "@/components/fiber-loading";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { EmptyState } from "@/components/fiber-app/fa-kit";
import { PhotoUploader } from "@/components/fiber-app/photo-uploader";
import { PhotoGrid, type GridPhoto } from "@/components/fiber-app/photo-grid";

interface Project { _id: string; name: string }

export function PhotosContent() {
  const [photos, setPhotos] = React.useState<GridPhoto[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [options, setOptions] = React.useState<Record<string, string[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [project, setProject] = React.useState("all");
  const [takenBy, setTakenBy] = React.useState("all");
  const [uploadTo, setUploadTo] = React.useState("");
  const [token, setToken] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/fiber-app/projects");
        const json = await res.json();
        const list: Project[] = json.data || [];
        setProjects(list);
        setUploadTo((cur) => cur || list[0]?._id || "");
      } catch { /* non-fatal */ }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: "1" });
        if (debounced) params.set("q", debounced);
        if (project !== "all") params.set("project", project);
        if (takenBy !== "all") params.set("takenBy", takenBy);
        const res = await fetch("/api/fiber-app/photos?" + params.toString());
        const json = await res.json();
        setPhotos(json.data || []);
        if (json.filterOptions) setOptions(json.filterOptions);
      } catch {
        toast.error("Could not load photos");
      } finally {
        setLoading(false);
      }
    })();
  }, [debounced, project, takenBy, token]);

  const refresh = React.useCallback(() => setToken((t) => t + 1), []);

  return (
    <>
      <PageHeader
        title="Photos"
        description="GPS-tagged proof of work, every job in one place"
        search={
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search captions, crew..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
        filters={
          <>
            <FilterSelect
              value={project}
              onValueChange={setProject}
              placeholder="project"
              allLabel="All Projects"
              options={options.projects || []}
              className="w-[180px]"
            />
            <FilterSelect
              value={takenBy}
              onValueChange={setTakenBy}
              placeholder="crew"
              allLabel="All Crew"
              options={options.photographers || []}
              className="w-[150px]"
            />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Select value={uploadTo} onValueChange={setUploadTo}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Upload to project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PhotoUploader
              projectId={uploadTo}
              onUploaded={refresh}
              compact
              label="Upload photos"
              disabled={!uploadTo}
              className="h-8"
            />
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <FiberLoadingAnimation />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex flex-col gap-4 p-4">
            {uploadTo && (
              <PhotoUploader projectId={uploadTo} onUploaded={refresh} />
            )}

            {photos.length === 0 ? (
              <EmptyState
                icon={IconCamera}
                title="No photos yet"
                message="Drag images onto the area above, or have crews upload them from Field Mode."
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {photos.length.toLocaleString()} photo{photos.length === 1 ? "" : "s"}
                </p>
                <PhotoGrid photos={photos} onChanged={refresh} showProject />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
