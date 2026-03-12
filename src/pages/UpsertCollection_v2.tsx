// src/pages/UpsertCollection_v2.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { GripVertical, AlertCircle, Loader2, Trash, LayoutGrid, Save, Settings2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FIELD_TYPES } from "@/constants/fieldTypes";
import api from "@/lib/api";

// ─── Local types ──────────────────────────────────────────────────────────────

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
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

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

  // ─── Auth check ───────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        await api.get("/auth/validate-token");
      } catch {
        navigate("/login");
      }
    })();
  }, [navigate]);

  // ─── Load collection (edit mode) ──────────────────────────────────────────

  useEffect(() => {
    if (!isEdit) {
      const first = makeEmptyField();
      setFields([first]);
      setEditingFieldId(first._id);
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
      } catch {
        navigate("/dashboard");
      }
    })();
  }, [isEdit, collectionName, navigate]);

  // ─── Name uniqueness check ────────────────────────────────────────────────

  const checkNameExists = useCallback(
    async (nameToCheck: string) => {
      if (!nameToCheck.trim()) { setNameExists(false); return; }
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
    const t = setTimeout(() => { if (name) checkNameExists(name); }, 500);
    return () => clearTimeout(t);
  }, [name, checkNameExists]);

  // ─── Field CRUD ───────────────────────────────────────────────────────────

  const handleAddField = () => {
    const field = makeEmptyField();
    setFields((prev) => [...prev, field]);
    setEditingFieldId(field._id);
  };

  const handleRemoveField = (id: string) => {
    setFields((prev) => prev.filter((f) => f._id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
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

  // ─── Payload & validation ─────────────────────────────────────────────────

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
        const res = await api.get(`/collections/${collectionName}`);
        const currentCollection = res.data;
        const updatedPayload = {
          ...payload,
          config: {
            ...payload.config,
            layout: currentCollection.config?.layout,
          },
        };
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

  // ─── Editing field ────────────────────────────────────────────────────────

  const editingField = fields.find((f) => f._id === editingFieldId) ?? null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="py-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h1 className="text-2xl">{isEdit ? "Edit Collection" : "Create Collection"}</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/collections/${collectionName}/grid-layout`)}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Grid Layout</span>
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isFormValid()}>
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isEdit ? "Update" : "Save"}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">

          {/* ── Collection Settings ── */}
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

          {/* ── Fields ── */}
          <div className="space-y-1">
            <Label>Fields</Label>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f._id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1 mt-1">
                  {fields.map((f) => (
                    <FieldRow
                      key={f._id}
                      field={f}
                      onEdit={() => setEditingFieldId(f._id)}
                      onRemove={() => handleRemoveField(f._id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button type="button" onClick={handleAddField} className="mt-2">
              Add Field
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* ── Field settings dialog ── */}
      {editingField && (
        <FieldDialog
          field={editingField}
          onClose={() => setEditingFieldId(null)}
          onChange={(key, val) => updateField(editingField._id, key, val)}
          onAddOption={() => addOption(editingField._id)}
          onChangeOption={(i, key, val) => updateOption(editingField._id, i, key, val)}
          onRemoveOption={(i) => removeOption(editingField._id, i)}
        />
      )}
    </div>
  );
}

// ─── FieldRow (compact) ───────────────────────────────────────────────────────

function FieldRow({
  field,
  onEdit,
  onRemove,
}: {
  field: Field;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: field._id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
    >
      <span
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <GripVertical className="h-4 w-4" />
      </span>

      <button
        type="button"
        className="flex-1 flex items-center gap-2 text-left min-w-0"
        onClick={onEdit}
      >
        <span className="text-sm font-medium truncate">
          {field.long || field.short || <span className="text-muted-foreground italic">(unnamed)</span>}
        </span>
        <Badge variant="secondary" className="text-xs shrink-0">{field.type}</Badge>
        {field.isActive === false && (
          <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">inactive</Badge>
        )}
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onEdit}
        title="Settings"
      >
        <Settings2 className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove"
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── FieldDialog ──────────────────────────────────────────────────────────────

function FieldDialog({
  field,
  onClose,
  onChange,
  onAddOption,
  onChangeOption,
  onRemoveOption,
}: {
  field: Field;
  onClose: () => void;
  onChange: (key: keyof Field, val: unknown) => void;
  onAddOption: () => void;
  onChangeOption: (idx: number, key: keyof DropdownOption, val: string) => void;
  onRemoveOption: (idx: number) => void;
}) {
  const CHECKBOXES: { key: keyof Field; label: string }[] = [
    { key: "showInHeader", label: "Show in header" },
    { key: "showAsBold",   label: "Show as bold" },
    { key: "isActive",     label: "Active" },
    { key: "isPublic",     label: "Public" },
    { key: "useAsFilter",  label: "Use as filter" },
    { key: "useInGrid",    label: "Use in grid" },
    { key: "persistValue", label: "Persist value" },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {field.long || field.short || "New Field"} — Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto max-h-[65vh]">

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Short name</Label>
              <Input
                value={field.short}
                onChange={(e) => onChange("short", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Long name</Label>
              <Input
                value={field.long}
                onChange={(e) => onChange("long", e.target.value)}
              />
            </div>
          </div>

          {/* Type + Display As */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    field.displayAs === "long" ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                      field.displayAs === "long" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className={`text-sm ${field.displayAs === "long" ? "font-medium" : "text-muted-foreground"}`}>
                  Long
                </span>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {CHECKBOXES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`${key}-${field._id}`}
                  checked={Boolean(field[key])}
                  onCheckedChange={(v) => onChange(key, Boolean(v))}
                />
                <Label htmlFor={`${key}-${field._id}`} className="font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>

          {/* Image orientation */}
          {field.type === "image" && (
            <div className="space-y-1.5">
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

          {/* Dropdown options */}
          {field.type === "dropdown" && (
            <div className="space-y-2">
              <Label>Dropdown Options</Label>
              <div className="space-y-2">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Long name"
                      value={opt.long}
                      onChange={(e) => onChangeOption(i, "long", e.target.value)}
                    />
                    <Input
                      placeholder="Short name"
                      value={opt.short}
                      onChange={(e) => onChangeOption(i, "short", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveOption(i)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onAddOption}>
                Add Option
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="mb-2">
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
