// src/components/filters-panel.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Share2, Check, ChevronsUpDown, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onClearAll?: () => void;
  username?: string;
  collectionName?: string;
};

export default function FiltersPanel({ 
  fields, 
  onApply, 
  defaultLimit = 25,
  collectionId,
  onClearAll,
  username, 
  collectionName 
}: Props) {
  const filterable = useMemo(() => {
    const filtered = fields.filter(f => f.useAsFilter === true);
    return filtered;
  }, [fields]);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState<Record<string, boolean>>({});
  console.log("inside filterspanel");
  const togglePopover = (fieldId: string) => {
    setTagPopoverOpen(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const storageKey = `filters_${collectionId}`;
  useEffect(() => {
    if (!collectionId) return;
    (async () => {
      try {
        const res = await api.get(`/collections/${collectionId}/tags`);
        setAvailableTags(res.data.tags || []);
      } catch (e) {
        console.error("Failed to load tags", e);
      }
    })();
  }, [collectionId]);

  const [search, setSearch] = useState(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) return urlSearch;
    
    const saved = sessionStorage.getItem(storageKey);
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
    
    const saved = sessionStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).values || {} : {};
  });

  const setVal = (id: string, v: any) => {
    setValues(prev => {
      const next = { ...prev };
      
      // If value is undefined, null, or empty string, remove the key entirely
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
        // UPDATED: Only add text/textarea if not empty after trim
        const trimmed = String(v).trim();
        if (trimmed.length > 0) f[`f[${fld._id}]`] = trimmed;
      } else {
        f[`f[${fld._id}]`] = String(v);
      }
    }

    const params: Record<string, any> = {
      page: 1,
      limit: defaultLimit,
      ...(search ? { search } : {}),
      ...f,
    };
    return params;
  };

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ search, values }));
    const params = buildParams();
    onApply(params);
  }, [values, search]);

  const clear = () => {
    setSearch("");
    setValues({});
    sessionStorage.removeItem(storageKey);
    
    // Call the onClearAll callback if provided
    if (onClearAll) {
      onClearAll();
    }
    onApply({ page: 1});
  };

  const generateShareableUrl = async () => {
    const userResponse = await api.get('/auth/me');
    const publicUsername = userResponse.data.username;
    const params = buildParams();
    const baseUrl = `${window.location.origin}/${publicUsername}/${encodedName}`;
    const url = new URL(baseUrl);
    url.search = "";
    
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
    } catch (err) {
      console.error("Failed to copy:", err);
      prompt("Copy this URL:", url);
    }
  };

  return (
    <div className="rounded-md border">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Filters</h3>
          {Object.keys(values).length > 0 && (
            <Badge 
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => setIsExpanded(true)}
            >{Object.keys(values).length} active</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={copyShareableLink}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={clear}
          >
            Clear All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t">
          {/* Per-field filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filterable.map((f) => {
              const id = f._id;
              const label = f.long || f.short;

              if (f.type === "number") {
                const v = values[id] || {};
                return (
                  <div key={id} className="space-y-1">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" 
                        placeholder="Min"
                        value={v.min ?? ""} 
                        onChange={(e) => setVal(id, { ...v, min: e.target.value })}
                      />
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
                  <div key={id} className="space-y-1">
                    <Label>{label}</Label>
                    <Select
                      value={
                        values[id] === undefined 
                          ? "__show_all__" 
                          : values[id] === true 
                            ? "true" 
                            : "false"
                      }
                      onValueChange={(v) => {
                        if (v === "__show_all__") {
                          setVal(id, undefined);
                        } else {
                          setVal(id, v === "true");
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__show_all__">Show All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (f.type === "dropdown") {
                return (
                  <div key={id} className="space-y-1">
                    <Label>{label}</Label>
                    <Select
                      value={values[id] ?? "__show_all__"}
                      onValueChange={(v) => setVal(id, v === "__show_all__" ? undefined : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__show_all__">Show All</SelectItem>
                        {(f.options ?? []).map(o => (
                          <SelectItem key={o._id} value={String(o._id)}>
                            {o.long}
                          </SelectItem>
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
                const isOpen = tagPopoverOpen[id] || false;

                return (
                  <div key={id} className="space-y-1">
                    <Label>{label}</Label>
                    
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedTags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => {
                                const newTags = selectedTags.filter((t: string) => t !== tag);
                                setVal(id, newTags.length > 0 ? newTags : undefined);
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Popover open={isOpen} onOpenChange={() => togglePopover(id)}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isOpen}
                          className="w-full justify-between"
                        >
                          {selectedTags.length > 0
                            ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`
                            : "Select tags..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search tags..." />
                          <CommandList>
                            <CommandEmpty>No tags found.</CommandEmpty>
                            <CommandGroup>
                              {availableTags.map((tag) => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                  <CommandItem
                                    key={tag}
                                    value={tag}
                                    onSelect={() => {
                                      const newTags = isSelected
                                        ? selectedTags.filter((t: string) => t !== tag)
                                        : [...selectedTags, tag];
                                      setVal(id, newTags.length > 0 ? newTags : undefined);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {tag}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              }

              return (
                <div key={id} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    placeholder="Contains…"
                    value={values[id] ?? ""}
                    onChange={(e) => setVal(id, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}