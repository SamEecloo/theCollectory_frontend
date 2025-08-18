// src/pages/CreateCollection.tsx
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate, useParams } from "react-router-dom";
import { GripVertical } from "lucide-react";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";

type DropdownOption = { fullName: string; shortName: string };

type Field = {
  id: string;           // internal unique id for DnD
  short: string;          // schema key
  long: string;        // UI label
  type: string;         // text | number | checkbox | dropdown | textarea | tags | image
  options?: DropdownOption[];
  showInHeader?: boolean;
  displayAs?: "short" | "long";
};

export default function CreateCollection() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [fields, setFields] = useState<Field[]>([
    { id: uuidv4(), short: "short", long: "long", type: "text", showInHeader: true, displayAs: "long" },
  ]);

  // Log live config + show preview
  useEffect(() => {
    console.log("CreateCollection config:", { name, isPublic, fields });
  }, [name, isPublic, fields]);

  // DnD sensors (drag only when pointer moves)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: any) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);
    setFields(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const addField = () =>
    setFields(prev => [
      ...prev,
      { id: uuidv4(), short: "", long: "", type: "text", showInHeader: true, displayAs: "long", options: [] },
    ]);

  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id));

  const updateField = (id: string, key: keyof Field, value: any) =>
    setFields(prev => prev.map(f => (f.id === id ? { ...f, [key]: value } : f)));

  const addOption = (fieldId: string) =>
    setFields(prev =>
      prev.map(f =>
        f.id === fieldId ? { ...f, options: [...(f.options || []), { fullName: "", shortName: "" }] } : f
      )
    );

  const updateOption = (fieldId: string, idx: number, key: keyof DropdownOption, val: string) =>
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        const opts = [...(f.options || [])];
        opts[idx] = { ...opts[idx], [key]: val };
        return { ...f, options: opts };
      })
    );

  const removeOption = (fieldId: string, idx: number) =>
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        const opts = (f.options || []).filter((_, i) => i !== idx);
        return { ...f, options: opts };
      })
    );

  const handleSave = async () => {
    await api.post("/collections", { name, isPublic, isActive, config: { fields: fields.map(({ id, ...rest }) => rest) } });
    navigate("/dashboard");
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Collection</h1>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="grid gap-3">
            <Label htmlFor="name">Collection Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <label className="flex items-center gap-2">
            <Checkbox checked={isPublic} onCheckedChange={v => setIsPublic(Boolean(v))} />
            <span>Public</span>
            <Checkbox checked={isActive} onCheckedChange={v => setIsActive(Boolean(v))} />
            <span>Active</span>
          </label>

          <h2 className="text-lg font-semibold">Fields</h2>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {fields.map((field, idx) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  index={idx}
                  onRemove={() => removeField(field.id)}
                  onChange={(k, v) => updateField(field.id, k, v)}
                  onAddOption={() => addOption(field.id)}
                  onChangeOption={(i, k, v) => updateOption(field.id, i, k, v)}
                  onRemoveOption={(i) => removeOption(field.id, i)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex gap-2">
            <Button type="button" onClick={addField}>Add Field</Button>
            <Button type="button" onClick={handleSave} className="ml-auto">Save Collection</Button>
          </div>
          <div>
            <h3 className="font-semibold">Preview</h3>
            <div className="overflow-x-auto mt-2 border rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {fields.map(f => (
            <th key={f.id} className="border px-2 py-1 text-left">
              {f.showInHeader ? (f.long || "(no label)") : ""}
            </th>
          ))}
                  </tr>
                </thead>
                <tbody>
  <tr>
    {fields.map(f => (
      <td key={f.id} className="border px-2 py-1">
        {f.type === "checkbox" ? (
          <span
            className={
              f.displayAs === "short"
                ? f.isChecked
                  ? "font-bold text-foreground"
                  : "text-muted-foreground"
                : f.isChecked
                  ? "font-bold text-foreground"
                  : "text-muted-foreground"
            }
          >
            {f.displayAs === "short" ? f.short || "(no short)" : f.long || "(no label)"}
          </span>
        ) : (
          <span className="text-muted-foreground italic">{f.type}</span>
        )}
      </td>
    ))}
  </tr>
</tbody>
              </table>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

// ——— Sortable Row ———
// Replace your current SortableFieldRow with this collapsible version
function SortableFieldRow({
  field, index, onRemove, onChange, onAddOption, onChangeOption, onRemoveOption,
}: {
  field: Field;
  index: number;
  onRemove: () => void;
  onChange: (key: keyof Field, val: any) => void;
  onAddOption: () => void;
  onChangeOption: (idx: number, key: "fullName" | "shortName", val: string) => void;
  onRemoveOption: (idx: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card ref={setNodeRef} style={style} className="py-1 border rounded-2xl">
      <CardContent className="p-0">
        <details open className="rounded-2xl">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
            <div className="flex items-center gap-2">
              {/* Drag handle */}
              <span className="cursor-grab" {...attributes} {...listeners}>
                <GripVertical size={16} />
              </span>
              <span className="text-sm text-muted-foreground">
                <strong>{field.long || "(no label)"}</strong> [{field.type}]
              </span>
            </div>
            <Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); onRemove(); }}>
              Delete
            </Button>
          </summary>

          <div className="p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Short</Label>
                <Input value={field.short} onChange={e => onChange("short", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Long</Label>
                <Input value={field.long} onChange={e => onChange("long", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={field.type} onValueChange={v => onChange("type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
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

              <label className="flex items-center gap-2 mt-6 md:mt-0">
                <Checkbox
                  checked={field.showInHeader || false}
                  onCheckedChange={v => onChange("showInHeader", Boolean(v))}
                />
                <span>Show in header</span>
              </label>

              <div className="grid gap-2">
                <Label>Display As</Label>
                <Select value={field.displayAs || "long"} onValueChange={v => onChange("displayAs", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {field.type === "dropdown" && (
              <div className="space-y-2">
                <Label>Dropdown Options</Label>&nbsp;
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Full Name"
                      value={opt.fullName}
                      onChange={e => onChangeOption(i, "fullName", e.target.value)}
                    />
                    <Input
                      placeholder="Short Name"
                      value={opt.shortName}
                      onChange={e => onChangeOption(i, "shortName", e.target.value)}
                    />
                    <Button variant="destructive" type="button" onClick={() => onRemoveOption(i)}>
                      X
                    </Button>
                  </div>
                ))}
                <Button type="button" onClick={onAddOption}>Add Option</Button>
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
