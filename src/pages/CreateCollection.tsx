import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import { FIELD_TYPES } from "@/constants/fieldTypes";

type DropdownOption = {
  fullName: string;
  shortName: string;
};

type Field = {
  id: string;
  short: string;
  long: string;
  type: string;
  options?: DropdownOption[];
  showInHeader?: boolean;
  displayAs?: "short" | "long";
};

export default function CreateCollection() {
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<Field[]>([
    { id: uuidv4(), short: "name", long: "Name", type: "text", showInHeader: true, displayAs: "long" },
  ]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);
    setFields(arrayMove(fields, oldIndex, newIndex));
  };

  const addField = () => {
    setFields(prev => [
      ...prev,
      {
        id: uuidv4(),
        short: "",
        long: "",
        type: "text",
        showInHeader: true,
        displayAs: "long",
        options: []
      },
    ]);
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const updateField = (id: string, key: keyof Field, value: any) => {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, [key]: value } : f)));
  };

  const addOption = (fieldId: string) => {
    setFields(prev =>
      prev.map(f =>
        f.id === fieldId
          ? { ...f, options: [...(f.options || []), { fullName: "", shortName: "" }] }
          : f
      )
    );
  };

  const updateOption = (fieldId: string, idx: number, key: keyof DropdownOption, val: string) => {
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        const opts = [...(f.options || [])];
        opts[idx] = { ...opts[idx], [key]: val };
        return { ...f, options: opts };
      })
    );
  };

  const removeOption = (fieldId: string, idx: number) => {
    setFields(prev =>
      prev.map(f => {
        if (f.id !== fieldId) return f;
        return { ...f, options: (f.options || []).filter((_, i) => i !== idx) };
      })
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a collection name");
      return;
    }

    if (fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    try {
      // Remove internal 'id' field before saving
      const cleanedFields = fields.map(({ id, ...rest }) => rest);
      
      await api.post("/collections", {
        name,
        isPublic,
        isActive,
        config: { fields: cleanedFields }
      });

      toast.success("Collection created successfully!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to create collection:", err);
      toast.error("Failed to create collection");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Collection</h1>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Collection Settings */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Collection Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Collection"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isPublic}
                  onCheckedChange={v => setIsPublic(Boolean(v))}
                />
                <span>Public</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isActive}
                  onCheckedChange={v => setIsActive(Boolean(v))}
                />
                <span>Active</span>
              </label>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Fields</h2>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.map(field => (
                  <SortableFieldRow
                    key={field.id}
                    field={field}
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
              <Button type="button" onClick={addField}>
                Add Field
              </Button>
              <Button type="button" onClick={handleSave} className="ml-auto">
                Save Collection
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="font-semibold mb-2">Preview</h3>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    {fields.map(f => (
                      <th key={f.id} className="border px-3 py-2 text-left font-medium">
                        {f.showInHeader ? (f.long || "(no label)") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {fields.map(f => (
                      <td key={f.id} className="border px-3 py-2">
                        <span className="text-muted-foreground italic text-xs">
                          {f.type}
                        </span>
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

// Sortable Field Row Component
function SortableFieldRow({
  field,
  onRemove,
  onChange,
  onAddOption,
  onChangeOption,
  onRemoveOption,
}: {
  field: Field;
  onRemove: () => void;
  onChange: (key: keyof Field, val: any) => void;
  onAddOption: () => void;
  onChangeOption: (idx: number, key: "fullName" | "shortName", val: string) => void;
  onRemoveOption: (idx: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: field.id
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <Card ref={setNodeRef} style={style} className="border rounded-lg">
      <CardContent className="p-0">
        <details open>
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <span
                className="cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
                onClick={(e) => e.preventDefault()}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="text-sm">
                <strong>{field.long || "(no label)"}</strong>{" "}
                <span className="text-muted-foreground">[{field.type}]</span>
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                onRemove();
              }}
            >
              Delete
            </Button>
          </summary>

          <div className="p-4 space-y-4 border-t">
            {/* Short and Long names */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Short Name (key)</Label>
                <Input
                  value={field.short}
                  onChange={e => onChange("short", e.target.value)}
                  placeholder="name"
                />
              </div>
              <div className="space-y-2">
                <Label>Long Name (display)</Label>
                <Input
                  value={field.long}
                  onChange={e => onChange("long", e.target.value)}
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Type, Show in Header, Display As */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={field.type} onValueChange={v => onChange("type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Display As</Label>
                <Select
                  value={field.displayAs || "long"}
                  onValueChange={v => onChange("displayAs", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 mt-8 cursor-pointer">
                <Checkbox
                  checked={field.showInHeader || false}
                  onCheckedChange={v => onChange("showInHeader", Boolean(v))}
                />
                <span>Show in header</span>
              </label>
            </div>

            {/* Dropdown Options */}
            {field.type === "dropdown" && (
              <div className="space-y-2">
                <Label>Dropdown Options</Label>
                <div className="space-y-2">
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
                </div>
                <Button type="button" variant="outline" onClick={onAddOption}>
                  Add Option
                </Button>
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}