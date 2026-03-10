// src/components/filters-panel.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import TagSelector from '@/components/tag-selector';
import { Share2, Check, X } from "lucide-react";

type DropdownOption = { _id: string; short: string; long: string };
type Field = {
  _id: string;
  short: string;
  long: string;
  type: string;
  options?: DropdownOption[];
  useAsFilter?: boolean;
};

type Props = {
  fields: Field[];
  onApply: (params: Record<string, any>) => void;
  defaultLimit?: number;
  collectionId: string;
  collectionName: string;
  username: string;
  onClearAll?: () => void;
  currentSort?: { fieldId: string; direction: 'asc' | 'desc' } | null;
  currentPage?: number;
  itemsPerPage?: number;
  onPageReset?: () => void;
  isPublic?: boolean;
  isPublicView?: boolean;
  // Drawer control — passed in from ViewCollection
  isOpen: boolean;
  onClose: () => void;
};

export default function FiltersPanel({
  fields,
  onApply,
  defaultLimit = 25,
  collectionId,
  collectionName,
  username,
  onClearAll,
  currentSort,
  currentPage = 1,
  itemsPerPage = 25,
  onPageReset,
  isPublic,
  isPublicView,
  isOpen,
  onClose,
}: Props) {
  const filterable = useMemo(() => fields.filter(f => f.useAsFilter === true), [fields]);

  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const storageKey = isPublicView ? `filters_public-${collectionName}` : `filters_${collectionName}`;

  const [search, setSearch] = useState(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) return urlSearch;
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).search || "" : "";
  });

  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    let hasUrlFilters = false;

    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith("f[") && key.endsWith("]")) {
        hasUrlFilters = true;
        const fieldId = key.slice(2, -1);

        if (fieldId.startsWith("min_") || fieldId.startsWith("max_")) {
          const [type, id] = fieldId.split("_", 2);
          if (!initial[id]) initial[id] = {};
          initial[id][type] = value;
        } else {
          const field = filterable.find(f => f._id === fieldId);
          if (field?.type === "checkbox") {
            initial[fieldId] = value === "true";
          } else if (value.includes(",")) {
            initial[fieldId] = value.split(",").map(s => s.trim());
          } else {
            initial[fieldId] = value;
          }
        }
      }
    }

    if (hasUrlFilters) return initial;

    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).values || {} : {};
  });

  const setVal = (id: string, v: any) => {
    setValues(prev => {
      const next = { ...prev };
      if (v === undefined || v === null || v === "") {
        delete next[id];
      } else {
        next[id] = v;
      }
      return next;
    });
  };

  const buildParams = () => {
    const f: Record<string, any> = {};

    for (const fld of filterable) {
      const v = values[fld._id];
      if (v === undefined || v === "" || v === null) continue;

      if (fld.type === "number" && typeof v === "object") {
        if (v.min !== undefined && v.min !== "") f[`f[min_${fld._id}]`] = String(v.min);
        if (v.max !== undefined && v.max !== "") f[`f[max_${fld._id}]`] = String(v.max);
      } else if (fld.type === "tags") {
        const arr = Array.isArray(v) ? v : String(v).split(",").map(s => s.trim()).filter(Boolean);
        if (arr.length > 0) f[`f[${fld._id}]`] = arr;
      } else if (fld.type === "checkbox") {
        f[`f[${fld._id}]`] = v;
      } else if (fld.type === "text" || fld.type === "textarea") {
        const trimmed = String(v).trim();
        if (trimmed.length > 0) f[`f[${fld._id}]`] = trimmed;
      } else {
        f[`f[${fld._id}]`] = String(v);
      }
    }

    return {
      page: 1,
      limit: defaultLimit,
      ...(search ? { search } : {}),
      ...f,
    };
  };

  // Apply on mount
  useEffect(() => {
    onApply(buildParams());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isInitialMount = useRef(true);

  // Apply on filter/search change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      if (onPageReset) onPageReset();
    }

    const state = {
      search,
      values,
      sort: currentSort,
      page: isInitialMount.current ? currentPage : 1,
      itemsPerPage,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
    onApply(buildParams());
  }, [values, search, storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist sort/page/itemsPerPage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const data = saved ? JSON.parse(saved) : {};
    localStorage.setItem(storageKey, JSON.stringify({
      ...data,
      sort: currentSort,
      page: currentPage,
      itemsPerPage,
    }));
  }, [currentSort, currentPage, itemsPerPage, storageKey]);

  const clear = () => {
    setSearch("");
    setValues({});
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const data = JSON.parse(saved);
      localStorage.setItem(storageKey, JSON.stringify({
        search: "",
        values: {},
        sort: data.sort,
        page: 1,
        itemsPerPage: data.itemsPerPage,
      }));
    }
    if (onClearAll) onClearAll();
    onApply({ page: 1 });
  };

  const generateShareableUrl = () => {
    const params = buildParams();
    const baseUrl = `${window.location.origin}/${username}/${encodeURIComponent(collectionName)}`;
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (key === "page" || key === "limit") return;
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(","));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  };

  const copyShareableLink = async () => {
    const url = generateShareableUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this URL:", url);
    }
  };

  const activeCount = Object.keys(values).length + (search ? 1 : 0);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-85 max-w-[90vw] bg-background border-r shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Filters</h2>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {activeCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {filterable.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No filterable fields configured.<br />
              Enable filters in collection settings.
            </p>
          ) : (
            filterable.map((f) => {
              const id = f._id;
              const label = f.long || f.short;

              if (f.type === "number") {
                const v = values[id] || {};
                return (
                  <div key={id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={v.min ?? ""}
                        onChange={(e) => setVal(id, { ...v, min: e.target.value })}
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={v.max ?? ""}
                        onChange={(e) => setVal(id, { ...v, max: e.target.value })}
                      />
                    </div>
                  </div>
                );
              }

              if (f.type === "checkbox") {
                return (
                  <div key={id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <Select
                      value={values[id] === undefined ? "__show_all__" : values[id] === true ? "true" : "false"}
                      onValueChange={(v) => setVal(id, v === "__show_all__" ? undefined : v === "true")}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__show_all__">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (f.type === "image") {
                return (
                  <div key={id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <Select
                      value={values[id] === undefined ? "__show_all__" : values[id] === true ? "true" : "false"}
                      onValueChange={(v) => setVal(id, v === "__show_all__" ? undefined : v === "true")}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__show_all__">All</SelectItem>
                        <SelectItem value="true">Has images</SelectItem>
                        <SelectItem value="false">No images</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (f.type === "dropdown") {
                const sortedOptions = [...(f.options ?? [])].sort((a, b) =>
                  (a.long || a.short).localeCompare(b.long || b.short)
                );
                return (
                  <div key={id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <Select
                      value={values[id] ?? "__show_all__"}
                      onValueChange={(v) => setVal(id, v === "__show_all__" ? undefined : v)}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__show_all__">All</SelectItem>
                        {sortedOptions.map(o => (
                          <SelectItem key={o._id} value={String(o._id)}>{o.long}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (f.type === "tags") {
                const selectedTags = Array.isArray(values[id])
                  ? values[id]
                  : (values[id] ? String(values[id]).split(",").map(s => s.trim()).filter(Boolean) : []);
                return (
                  <div key={id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <TagSelector
                      collectionName={collectionName}
                      collectionId={collectionId}
                      value={selectedTags}
                      onChange={(tags) => setVal(id, tags.length > 0 ? tags : undefined)}
                      placeholder="Select tags..."
                      allowCreate={false}
                      isPublicView={isPublicView}
                    />
                  </div>
                );
              }

              // text / textarea / date / etc.
              return (
                <div key={id} className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                  <div className="relative">
                    <Input
                      placeholder={`Contains…`}
                      value={values[id] ?? ""}
                      onChange={(e) => setVal(id, e.target.value)}
                      className={values[id] ? "pr-8" : ""}
                    />
                    {values[id] && (
                      <button
                        type="button"
                        onClick={() => setVal(id, undefined)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer footer */}
        <div className="px-4 py-3 border-t shrink-0 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clear}
          >
            Clear all
          </Button>
          {isPublic && !isPublicView && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareableLink}
              className="gap-1.5"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Copied!" : "Share"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}