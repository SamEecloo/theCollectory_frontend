// src/pages/UpsertCollection.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { GripVertical } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Toggle } from "@/components/ui/toggle"
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";

type DropdownOption = { long: string; short: string };
type Field = {
  _id: string;
  short: string;
  long: string;
  type: "text" | "number" | "checkbox" | "dropdown" | "textarea" | "tags" | "image";
  options?: DropdownOption[];
  showInHeader?: boolean;
  showAsBold?: boolean;
  isActive?: boolean;
  useAsFilter?: boolean;
  useInGrid?: boolean;
  displayAs?: "long" | "short";
  orientation?: "landscape" | "portrait" | "square";
};

export default function UpsertCollection() {
  const { collectionId } = useParams();
  const isEdit = Boolean(collectionId);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [openId, setOpenId] = useState<string | null>(null); // which panel is open

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Validate token on entry
  useEffect(() => {
    (async () => {
      try {
        await api.get("/auth/validate-token");
      } catch {
        navigate("/login");
      }
    })();
  }, [navigate]);

  // Load for edit
  useEffect(() => {
    if (!isEdit) {
      // seed with one field
      const firstId = uuidv4();
      setFields([{ _id: firstId, short: "", long: "", type: "text", showInHeader: true, showAsBold: false, displayAs: "long", isActive: true, useAsFilter: true, useInGrid: true}]);
      setOpenId(firstId);
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/collections/${collectionId}`);
        const c = res.data;
        setName(c.name || "");
        setIsPublic(Boolean(c.isPublic));
        setIsActive(Boolean(c.isActive));
        const mapped: Field[] = (c.config?.fields || []).map((f: Omit<Field, "id">) => ({
          _id: f._id || "",
          short: f.short || "",
          long: f.long || "",
          type: (f.type as Field["type"]) || "text",
          options: f.options || [],
          showInHeader: f.showInHeader ?? true,
          showAsBold: f.showAsBold ?? false,
          displayAs: (f.displayAs as Field["displayAs"]) || "long",
          isActive: f.isActive ?? true,
          useAsFilter: f.useAsFilter ?? true,
          useInGrid: f.useInGrid ?? true,
          orientation: f.orientation
        }));
        setFields(mapped);
        setOpenId(mapped[0]?._id ?? null);
      } catch {
        navigate("/dashboard");
      }
    })();
  }, [isEdit, collectionId, navigate]);

  const handleAddField = () => {
    const _id = uuidv4();
    setFields(prev => [
      ...prev,
      { _id, short: "", long: "", type: "text", showInHeader: true, showAsBold: false, displayAs: "long", isActive: true, useAsFilter: true, useInGrid: true, orientation: 'landscape' },
    ]);
    setOpenId(_id); // open the new one, collapse others
  };

  const handleRemoveField = (id: string) => {
    setFields(prev => prev.filter(f => f._id !== id));
    setOpenId(prev => (prev === id ? null : prev));
  };

  const updateField = (id: string, key: keyof Field, value: any) => {
    setFields(prev => prev.map(f => (f._id === id ? { ...f, [key]: value } : f)));
  };

  const addOption = (fieldId: string) =>
    setFields(prev =>
      prev.map(f => (f._id === fieldId ? { ...f, options: [...(f.options || []), { long: "", short: "" }] } : f))
    );

  const updateOption = (fieldId: string, idx: number, key: keyof DropdownOption, val: string) =>
    setFields(prev =>
      prev.map(f => {
        if (f._id !== fieldId) return f;
        const opts = [...(f.options || [])];
        opts[idx] = { ...opts[idx], [key]: val };
        return { ...f, options: opts };
      })
    );

  const removeOption = (fieldId: string, idx: number) =>
    setFields(prev =>
      prev.map(f => {
        if (f._id !== fieldId) return f;
        const opts = (f.options || []).filter((_, i) => i !== idx);
        return { ...f, options: opts };
      })
    );

  const onDragEnd = (e: any) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex(f => f._id === active.id);
    const newIndex = fields.findIndex(f => f._id === over.id);
    setFields(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const payload = useMemo(
    () => ({
      name,
      isPublic,
      isActive,
      config: { fields: fields }, // strip local id before save
    }),
    [name, isPublic, isActive, fields]
  );

  const handleSave = async () => {
    if (isEdit) {
      await api.put(`/collections/${collectionId}`, payload);
    } else {
      await api.post("/collections", payload);
    }
    navigate("/dashboard");
  };

  const hash = (s: string) =>
  Array.from(s).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);

const previewCell = (f: Field) => {
  if (f.type === "dropdown") {
    const opts = f.options || [];
    if (!opts.length) return <span className="text-muted-foreground italic">no options</span>;
    const idx = Math.abs(hash(f._id || f.short || "")) % opts.length;
    const opt = opts[idx];
    const text = f.displayAs === "short" ? opt.short || "(short)" : opt.long || "(long)";
    return <span className="text-foreground">{text}</span>;
  }
  if (f.type === "checkbox") {
    // optional: show short/long with muted/active state example
    const label = f.displayAs === "short" ? f.short : f.long;
    const isChecked = true; // preview as checked; or derive if you want
    return (
      <span className={isChecked ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    );
  }
  // fallback for other types
  return <span className="text-muted-foreground">{f.displayAs === "short" ? f.short : f.long}</span>;
};

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{isEdit ? "Edit Collection" : "Create Collection"}</h1>

      <Card>
        <CardContent className="p-6 space-y-2">
          <div className="grid">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                  <Label htmlFor="name">Collection Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-48"
                  />  
              </div>
              <div className="flex items-center gap-3">
                  <Label htmlFor="isPublic">Public</Label>
                  <Checkbox
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={v => setIsPublic(Boolean(v))}
                  />
                
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="isActive">Active</Label>
                  <Checkbox
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={v => setIsActive(Boolean(v))}
                  />
              </div>
              <div className="flex items-center gap-3">
<Button type="button" onClick={handleSave}>
              {isEdit ? "Update Collection" : "Save Collection"}
            </Button>
              </div>
              

              
            </div>
            

            
          </div>

          

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={fields.map(f => f._id)} strategy={verticalListSortingStrategy}>
              {fields.map((f, idx) => (
                <FieldRow
                  key={f._id}
                  field={f}
                  index={idx}
                  open={openId === f._id}
                  setOpen={(o: boolean) => setOpenId(o ? f._id : null)}
                  onRemove={() => handleRemoveField(f._id)}
                  onChange={(k, v) => updateField(f._id, k, v)}
                  onAddOption={() => addOption(f._id)}
                  onChangeOption={(i, k, v) => updateOption(f._id, i, k, v)}
                  onRemoveOption={(i) => removeOption(f._id, i)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAddField}>Add Field</Button>
          </div>
        </CardContent>
      </Card>
      
      <div>
  <h3 className="font-semibold">Preview</h3>
  <div className="overflow-x-auto mt-2 border rounded">
    <Table className="min-w-full text-sm">
      <TableCaption>Collection list preview data.</TableCaption>
      <TableHeader>
        <TableRow>
          {fields
            .filter(f => f.isActive !== false && f.useInGrid !== false)
            .map(f => (
            <TableHead key={f._id}>
              {f.showInHeader ? (f.long || "(no label)") : ""}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {fields
            .filter(f => f.isActive !== false && f.useInGrid !== false)
            .map(f => (
              <TableCell key={f._id} style={f.showAsBold ? { fontWeight: "bold" } : {}}>
                {previewCell(f, rowIndex)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
  <details className="mt-6">
            <summary className="cursor-pointer select-none text-sm text-muted-foreground">
                Show item JSON
            </summary>
            <pre className="mt-2 rounded bg-gray-100 p-3 text-sm overflow-x-auto">
                {JSON.stringify(payload, null, 2)}
            </pre>
        </details>
</div>
    </div>
  );
}

/* ---------- Field Row (collapsible + drag handle) ---------- */
function FieldRow({
  field, index, open, setOpen, onRemove, onChange, onAddOption, onChangeOption, onRemoveOption,
}: {
  field: Field;
  index: number;
  open: boolean;
  setOpen: (o: boolean) => void;
  onRemove: () => void;
  onChange: (key: keyof Field, val: any) => void;
  onAddOption: () => void;
  onChangeOption: (idx: number, key: keyof DropdownOption, val: string) => void;
  onRemoveOption: (idx: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: field._id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card ref={setNodeRef} style={style} className="py-1 border rounded-2xl">
      <CardContent className="p-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between px-4 py-3">
            {/* Drag handle — no toggle */}
            <span
              className="cursor-grab select-none p-1"
              {...attributes}
              {...listeners}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <GripVertical size={16} />
            </span>

            <CollapsibleTrigger asChild className="cursor-pointer">
              <button type="button" className="flex-1 text-left ml-2 text-sm text-muted-foreground cursor:pointer">
                <strong>{field.long || "(no label)"}</strong> [{field.type}]
              </button>
               
            </CollapsibleTrigger>
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            >
              Delete
            </Button>
          </div>

          <CollapsibleContent>
            <div className="p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Short name</Label>
                  <Input value={field.short} onChange={e => onChange("short", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Long name</Label>
                  <Input value={field.long} onChange={e => onChange("long", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={field.type} onValueChange={(v: Field["type"]) => onChange("type", v)}>
                    <SelectTrigger className="w-[100%]"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="dropdown">Drop-down</SelectItem>
                      <SelectItem value="textarea">TextArea</SelectItem>
                      <SelectItem value="tags">Tags</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Display As</Label>
                  <Select value={field.displayAs || "long"} onValueChange={(v: "long" | "short") => onChange("displayAs", v)}>
                    <SelectTrigger className="w-[100%]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showInHeader"
                    checked={field.showInHeader || false}
                    onCheckedChange={v => onChange("showInHeader", Boolean(v))}
                  />
                  <Label htmlFor="showInHeader">Show in header</Label>
                </div>
                <div className="flex items-center gap-3">
                   <Checkbox
                   id="showAsBold"
                    checked={field.showAsBold || false}
                    onCheckedChange={v => onChange("showAsBold", Boolean(v))}
                  />
                  <Label htmlFor="showAsBold">Show as bold</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                  id="isActive"
                    checked={field.isActive || false}
                    onCheckedChange={v => onChange("isActive", Boolean(v))}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                  id="useAsFilter"
                    checked={field.useAsFilter || false}
                    onCheckedChange={v => onChange("useAsFilter", Boolean(v))}
                  />
                  <Label htmlFor="useAsFilter">Use as filter</Label>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showInHeader"
                    checked={field.useInGrid || false}
                    onCheckedChange={v => onChange("useInGrid", Boolean(v))}
                  />
                  <Label htmlFor="useInGrid">Use in grid</Label>
                </div>
              </div>

              {field.type === "dropdown" && (
                <div className="space-y-2">
                  <Label>Dropdown Options</Label>
                  {(field.options || []).map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Long Name"
                        value={opt.long}
                        onChange={e => onChangeOption(i, "long", e.target.value)}
                      />
                      <Input
                        placeholder="Short Name"
                        value={opt.short}
                        onChange={e => onChangeOption(i, "short", e.target.value)}
                      />
                      <Button variant="destructive" type="button" onClick={() => onRemoveOption(i)}>
                        X
                      </Button>
                    </div>
                  ))}
                  <Button type="button" onClick={onAddOption}>Add Option</Button>
                </div>
              )}

              {field.type === "image" && (
                <div className="mt-2">
                  <label className="block mb-1 font-medium">Image Orientation</label>
                  <Select
                    value={field.orientation || "landscape"}
                    onValueChange={(v: "landscape" | "portrait" | "square") => onChange("orientation", v)}
                  >
                    <SelectTrigger className="w-[100%]">
                      <SelectValue placeholder="Select orientation" />
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
