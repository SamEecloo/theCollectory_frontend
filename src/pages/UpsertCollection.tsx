// src/pages/UpsertCollection.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { GripVertical, AlertCircle, Loader2, Trash, LayoutGrid, Save } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FIELD_TYPES } from "@/constants/fieldTypes";
import api from "@/lib/api";

// ─── Local types ─────────────────────────────────────────────────────────────

type DropdownOption = { long: string; short: string };

type Field = {
  _id: string;
  short: string;
  long: string;
  type: "text" | "number" | "checkbox" | "dropdown" | "textarea" | "tags" | "image" | "date";
  options?: DropdownOption[];
  showInHeader?: boolean;
  showAsBold?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  useAsFilter?: boolean;
  useInGrid?: boolean;
  persistValue?: boolean;
  displayAs?: "long" | "short";
  orientation?: "landscape" | "portrait" | "square";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hash = (s: string) =>
  Array.from(s).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);

const makeEmptyField = (): Field => ({
  _id: uuidv4(),
  short: "",
  long: "",
  type: "text",
  showInHeader: true,
  showAsBold: false,
  displayAs: "long",
  isActive: true,
  isPublic: true,
  useAsFilter: true,
  useInGrid: true,
  persistValue: true,
  orientation: "landscape",
});

const mapApiField = (f: any): Field => ({
  _id: f._id || "",
  short: f.short || "",
  long: f.long || "",
  type: (f.type as Field["type"]) || "text",
  options: f.options || [],
  showInHeader: f.showInHeader ?? true,
  showAsBold: f.showAsBold ?? false,
  displayAs: (f.displayAs as Field["displayAs"]) || "long",
  isActive: f.isActive ?? true,
  isPublic: f.isPublic ?? true,
  useAsFilter: f.useAsFilter ?? true,
  useInGrid: f.useInGrid ?? true,
  persistValue: f.persistValue ?? true,
  orientation: f.orientation ?? "landscape",
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UpsertCollection() {
  const { collectionName } = useParams();
  const isEdit = Boolean(collectionName);
  const navigate = useNavigate();

  // Collection settings
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Fields
  const [fields, setFields] = useState<Field[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  // Name validation
  const [nameExists, setNameExists] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  // Sorting
  const [defaultSortField, setDefaultSortField] = useState("");
  const [defaultSortDirection, setDefaultSortDirection] = useState<"asc" | "desc">("asc");

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── Auth check ────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        await api.get("/auth/validate-token");
      } catch {
        navigate("/login");
      }
    })();
  }, [navigate]);

  // ─── Load collection (edit mode) ───────────────────────────────────────────

  useEffect(() => {
    if (!isEdit) {
      const first = makeEmptyField();
      setFields([first]);
      setOpenId(first._id);
      return;
    }

    (async () => {
      try {
        const res = await api.get(`/collections/${collectionName}`);
        const c = res.data;

        setName(c.name || "");
        setOriginalName(c.name || "");
        setIsPublic(Boolean(c.isPublic));
        setIsActive(Boolean(c.isActive));
        setDefaultSortField(c.config?.defaultSort?.fieldId || "");
        setDefaultSortDirection(c.config?.defaultSort?.direction || "asc");

        const mapped = (c.config?.fields || []).map(mapApiField);
        setFields(mapped);
        setOpenId(mapped[0]?._id ?? null);
      } catch {
        navigate("/dashboard");
      }
    })();
  }, [isEdit, collectionName, navigate]);

  // ─── Name uniqueness check ─────────────────────────────────────────────────

  const checkNameExists = useCallback(
    async (nameToCheck: string) => {
      if (!nameToCheck.trim()) {
        setNameExists(false);
        return;
      }
      if (isEdit && nameToCheck.trim().toLowerCase() === originalName.trim().toLowerCase()) {
        setNameExists(false);
        return;
      }

      try {
        setCheckingName(true);
        const res = await api.get("/collections");
        const exists = res.data.some(
          (c: any) => c.name.toLowerCase().trim() === nameToCheck.toLowerCase().trim()
        );
        setNameExists(exists);
      } catch {
        console.error("Failed to check collection name");
      } finally {
        setCheckingName(false);
      }
    },
    [isEdit, originalName]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (name) checkNameExists(name);
    }, 500);
    return () => clearTimeout(t);
  }, [name, checkNameExists]);

  // ─── Field CRUD ────────────────────────────────────────────────────────────

  const handleAddField = () => {
    const field = makeEmptyField();
    setFields((prev) => [...prev, field]);
    setOpenId(field._id);
  };

  const handleRemoveField = (id: string) => {
    setFields((prev) => prev.filter((f) => f._id !== id));
    setOpenId((prev) => (prev === id ? null : prev));
  };

  const updateField = (id: string, key: keyof Field, value: unknown) => {
    setFields((prev) => prev.map((f) => (f._id === id ? { ...f, [key]: value } : f)));
  };

  const addOption = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f._id === fieldId
          ? { ...f, options: [...(f.options || []), { long: "", short: "" }] }
          : f
      )
    );
  };

  const updateOption = (fieldId: string, idx: number, key: keyof DropdownOption, val: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f._id !== fieldId) return f;
        const opts = [...(f.options || [])];
        opts[idx] = { ...opts[idx], [key]: val };
        return { ...f, options: opts };
      })
    );
  };

  const removeOption = (fieldId: string, idx: number) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f._id !== fieldId) return f;
        return { ...f, options: (f.options || []).filter((_, i) => i !== idx) };
      })
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f._id === active.id);
    const newIndex = fields.findIndex((f) => f._id === over.id);
    setFields((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  // ─── Payload & validation ──────────────────────────────────────────────────

  const payload = useMemo(
    () => ({
      name,
      isPublic,
      isActive,
      config: {
        fields,
        defaultSort: defaultSortField
          ? { fieldId: defaultSortField, direction: defaultSortDirection }
          : undefined,
      },
    }),
    [name, isPublic, isActive, fields, defaultSortField, defaultSortDirection]
  );

  const isFormValid = () => {
    if (!name.trim()) return false;
    if (nameExists) return false;
    if (fields.length === 0) return false;
    if (!fields[0].long.trim()) return false;
    if (fields.some((f) => f.type === "dropdown" && (!f.options || f.options.length === 0)))
      return false;
    return true;
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      toast.error("Please fix validation errors before saving");
      return;
    }

    try {
      if (isEdit) {
        // Fetch current collection to preserve layout config
        const res = await api.get(`/collections/${collectionName}`);
        const currentCollection = res.data;
        
        // Merge payload with existing layout to preserve it
        const updatedPayload = {
          ...payload,
          config: {
            ...payload.config,
            layout: currentCollection.config?.layout, // Preserve existing layout
          },
        };
        console.log(JSON.stringify(payload.config.fields, null, 2))
        await api.put(`/collections/${collectionName}`, updatedPayload);
        toast.success("Collection updated successfully!");
      } else {
        await api.post("/collections", payload);
        toast.success("Collection created successfully!");
      }
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save collection");
    }
  };

  // ─── Preview cell ──────────────────────────────────────────────────────────

  const previewCell = (f: Field) => {
    if (f.type === "dropdown") {
      const opts = f.options || [];
      if (!opts.length)
        return <span className="text-muted-foreground italic">no options</span>;
      const idx = Math.abs(hash(f._id || f.short || "")) % opts.length;
      const opt = opts[idx];
      return (
        <span className="text-foreground">
          {f.displayAs === "short" ? opt.short || "(short)" : opt.long || "(long)"}
        </span>
      );
    }

    if (f.type === "checkbox") {
      return (
        <span className="font-medium">{f.displayAs === "short" ? f.short : f.long}</span>
      );
    }

    return (
      <span className="text-muted-foreground">
        {f.displayAs === "short" ? f.short : f.long}
      </span>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="py-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h1 className="text-2xl">{isEdit ? "Edit Collection" : "Create Collection"}</h1>
        <div className=" flex gap-2 ">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/collections/${collectionName}/grid-layout`)}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Grid Layout</span>
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid()}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isEdit ? "Update" : "Save"}</span>
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-6 space-y-6">

          {/* ── Collection Settings ── */}
          <div className="space-y-2">
            {/* Settings grid - responsive: 1 col mobile, 2 cols desktop */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Collection name */}
              <div className="space-y-2">
                <Label htmlFor="name">Collection Name</Label>
                <div className="relative">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={nameExists ? "border-destructive" : ""}
                  />
                  {checkingName && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {nameExists && (
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span>Collection name already exists</span>
                  </div>
                )}
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-6 h-10 items-center">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="isPublic"
                      checked={isPublic}
                      onCheckedChange={(v) => setIsPublic(Boolean(v))}
                    />
                    <Label htmlFor="isPublic">Public</Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="isActive"
                      checked={isActive}
                      onCheckedChange={(v) => setIsActive(Boolean(v))}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
              </div>

              {/* Default Sort Field */}
              <div className="space-y-2">
                <Label>Default Sort Field</Label>
                <Select
                  value={defaultSortField || "__none__"}
                  onValueChange={(v) => setDefaultSortField(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No default sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No default sort</SelectItem>
                    {fields
                      .filter((f) => f.isActive !== false && f.useInGrid !== false)
                      .map((f) => (
                        <SelectItem key={f._id} value={f._id}>
                          {f.long || f.short || "(unnamed)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Direction */}
              {defaultSortField && (
                <div className="space-y-2">
                  <Label>Sort Direction</Label>
                  <Select
                    value={defaultSortDirection}
                    onValueChange={(v: "asc" | "desc") => setDefaultSortDirection(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending (A-Z, 0-9)</SelectItem>
                      <SelectItem value="desc">Descending (Z-A, 9-0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* ── Fields ── */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f._id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((f, idx) => (
                <FieldRow
                  key={f._id}
                  field={f}
                  index={idx}
                  open={openId === f._id}
                  setOpen={(o) => setOpenId(o ? f._id : null)}
                  onRemove={() => handleRemoveField(f._id)}
                  onChange={(k, v) => updateField(f._id, k, v)}
                  onAddOption={() => addOption(f._id)}
                  onChangeOption={(i, k, v) => updateOption(f._id, i, k, v)}
                  onRemoveOption={(i) => removeOption(f._id, i)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <Button type="button" onClick={handleAddField}>
            Add Field
          </Button>
        </CardContent>
      </Card>

      {/* ── Preview ── */}
      {isFormValid() && (
        <div>
          <h3 className="font-semibold">Preview</h3>
          <div className="overflow-x-auto mt-2 border rounded">
            <Table className="min-w-full text-sm">
              <TableCaption>Collection list preview</TableCaption>
              <TableHeader>
                <TableRow>
                  {fields
                    .filter((f) => f.isActive !== false && f.useInGrid !== false)
                    .map((f) => (
                      <TableHead key={f._id}>
                        {f.showInHeader ? f.long || "(no label)" : ""}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {fields
                      .filter((f) => f.isActive !== false && f.useInGrid !== false)
                      .map((f) => (
                        <TableCell
                          key={f._id}
                          style={f.showAsBold ? { fontWeight: "bold" } : {}}
                        >
                          {previewCell(f)}
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  open,
  setOpen,
  onRemove,
  onChange,
  onAddOption,
  onChangeOption,
  onRemoveOption,
}: {
  field: Field;
  index: number;
  open: boolean;
  setOpen: (o: boolean) => void;
  onRemove: () => void;
  onChange: (key: keyof Field, val: unknown) => void;
  onAddOption: () => void;
  onChangeOption: (idx: number, key: keyof DropdownOption, val: string) => void;
  onRemoveOption: (idx: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: field._id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card ref={setNodeRef} style={style} className="py-1 border rounded-2xl">
      <CardContent className="p-0">
        <Collapsible open={open} onOpenChange={setOpen}>

          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-3">
            <span
              className="cursor-grab select-none p-1"
              {...attributes}
              {...listeners}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <GripVertical size={16} />
            </span>

            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex-1 text-left ml-2 text-sm text-muted-foreground"
              >
                <strong>{field.long || "(no label)"}</strong>{" "}
                <span className="text-muted-foreground">[{field.type}]</span>
              </button>
            </CollapsibleTrigger>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash ></Trash>
            </Button>
          </div>

          {/* Expanded content */}
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t">

              {/* Names + Type + Display As */}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Short name</Label>
                  <Input
                    value={field.short}
                    onChange={(e) => onChange("short", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Long name</Label>
                  <Input
                    value={field.long}
                    onChange={(e) => onChange("long", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={field.type}
                    onValueChange={(v: Field["type"]) => onChange("type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display As</Label>
                  <div className="flex items-center gap-3 h-10">
                    <span className={`text-sm ${field.displayAs === "short" ? "font-medium" : "text-muted-foreground"}`}>
                      Short
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.displayAs === "long"}
                      onClick={() => onChange("displayAs", field.displayAs === "long" ? "short" : "long")}
                      className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${field.displayAs === "long" ? "bg-primary" : "bg-muted"}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform
                          ${field.displayAs === "long" ? "translate-x-6" : "translate-x-1"}
                        `}
                      />
                    </button>
                    <span className={`text-sm ${field.displayAs === "long" ? "font-medium" : "text-muted-foreground"}`}>
                      Long
                    </span>
                  </div>
                </div>
              </div>

              {/* Checkboxes row 1 */}
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { id: "showInHeader", label: "Show in header", key: "showInHeader" },
                  { id: "showAsBold", label: "Show as bold", key: "showAsBold" },
                  { id: "isActive", label: "Active", key: "isActive" },
                  { id: "isPublic", label: "Public", key: "isPublic" },
                  
                ].map(({ id, label, key }) => (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox
                      id={`${id}-${field._id}`}
                      checked={Boolean(field[key as keyof Field])}
                      onCheckedChange={(v) => onChange(key as keyof Field, Boolean(v))}
                    />
                    <Label htmlFor={`${id}-${field._id}`}>{label}</Label>
                  </div>
                ))}
              </div>

              {/* Checkboxes row 2 */}
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { id: "useAsFilter", label: "Use as filter", key: "useAsFilter" },
                  { id: "useInGrid", label: "Use in grid", key: "useInGrid" },
                  { id: "persistValue", label: "Persist Value", key: "persistValue" },
                ].map(({ id, label, key }) => (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox
                      id={`${id}-${field._id}`}
                      checked={Boolean(field[key as keyof Field])}
                      onCheckedChange={(v) => onChange(key as keyof Field, Boolean(v))}
                    />
                    <Label htmlFor={`${id}-${field._id}`}>{label}</Label>
                  </div>
                ))}
              </div>

              {/* Dropdown options */}
              {field.type === "dropdown" && (
                <div className="space-y-2">
                  <Label>Dropdown Options</Label>
                  {(field.options || []).map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Long Name"
                        value={opt.long}
                        onChange={(e) => onChangeOption(i, "long", e.target.value)}
                      />
                      <Input
                        placeholder="Short Name"
                        value={opt.short}
                        onChange={(e) => onChangeOption(i, "short", e.target.value)}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        type="button"
                        onClick={() => onRemoveOption(i)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={onAddOption}>
                    Add Option
                  </Button>
                </div>
              )}

              {/* Image orientation */}
              {field.type === "image" && (
                <div className="space-y-2">
                  <Label>Image Orientation</Label>
                  <Select
                    value={field.orientation || "landscape"}
                    onValueChange={(v: "landscape" | "portrait" | "square") =>
                      onChange("orientation", v)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">Landscape</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

