// src/components/grid-layout-editor_v2.tsx
// Mobile-friendly version: sliders instead of drag-to-resize, tap-to-add instead of drag-to-add
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Monitor, Smartphone, GripVertical, X, Layers, Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { IGridRowItem, IGridField } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Field = {
  _id: string;
  long: string;
  short: string;
  type: string;
  showInHeader?: boolean;
  showAsBold?: boolean;
  displayAs?: 'long' | 'short';
};
type Device = 'desktop' | 'mobile';

type GroupDefinition = {
  id: string;
  name: string;
  fieldIds: string[];
  fieldSpans: number[];
};

type Props = {
  fields: Field[];
  gridRows: IGridRowItem[];
  onChange: (rows: IGridRowItem[]) => void;
};

const TOTAL_COLS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRowId = (row: IGridRowItem) =>
  row.kind === 'field' ? row.fieldId : row.id;

const getSpan = (item: { desktopSpan: number; mobileSpan: number }, device: Device) =>
  device === 'desktop' ? item.desktopSpan : item.mobileSpan;

const withSpan = <T extends { desktopSpan: number; mobileSpan: number }>(
  item: T,
  device: Device,
  span: number,
): T => ({
  ...item,
  desktopSpan: device === 'desktop' ? span : item.desktopSpan,
  mobileSpan: device === 'mobile' ? span : item.mobileSpan,
});

// ─── Slider Row ───────────────────────────────────────────────────────────────

function SliderRow({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 w-20 shrink-0 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <input
        type="range"
        min={1}
        max={TOTAL_COLS}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-primary cursor-pointer"
      />
      <span className="w-8 text-right text-xs font-medium text-foreground shrink-0">
        {value}/{TOTAL_COLS}
      </span>
    </div>
  );
}

// ─── Sortable Field Card ───────────────────────────────────────────────────────

function SortableFieldCard({
  row,
  field,
  onRemove,
  onCommitSpan,
}: {
  row: Extract<IGridRowItem, { kind: 'field' }>;
  field: Field | undefined;
  onRemove: () => void;
  onCommitSpan: (device: Device, span: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: `row-${row.fieldId}`, data: { source: 'grid' } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div className="bg-background border rounded-lg p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="flex-1 text-sm font-medium truncate">
            {field?.long || field?.short || '?'}
          </span>
          <span className="text-xs text-muted-foreground capitalize">{field?.type}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SliderRow
          label="Desktop"
          icon={<Monitor className="h-3 w-3" />}
          value={row.desktopSpan}
          onChange={(v) => onCommitSpan('desktop', v)}
        />
        <SliderRow
          label="Mobile"
          icon={<Smartphone className="h-3 w-3" />}
          value={row.mobileSpan}
          onChange={(v) => onCommitSpan('mobile', v)}
        />
      </div>
    </div>
  );
}

// ─── Sortable Group Card ───────────────────────────────────────────────────────

function SortableGroupCard({
  row,
  groupName,
  fieldMap,
  onRemove,
  onCommitSpan,
  onEdit,
}: {
  row: Extract<IGridRowItem, { kind: 'group' }>;
  groupName: string;
  fieldMap: Map<string, Field>;
  onRemove: () => void;
  onCommitSpan: (device: Device, span: number) => void;
  onEdit: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: `row-${row.id}`, data: { source: 'grid' } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div className="border-2 border-primary/40 rounded-lg p-3 bg-primary/5 space-y-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 text-sm font-medium text-left truncate hover:text-primary transition-colors"
          >
            {groupName}
          </button>
          <span className="text-xs text-muted-foreground shrink-0">
            {row.fields.length} field{row.fields.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SliderRow
          label="Desktop"
          icon={<Monitor className="h-3 w-3" />}
          value={row.desktopSpan}
          onChange={(v) => onCommitSpan('desktop', v)}
        />
        <SliderRow
          label="Mobile"
          icon={<Smartphone className="h-3 w-3" />}
          value={row.mobileSpan}
          onChange={(v) => onCommitSpan('mobile', v)}
        />
        {/* Inner field spans */}
        <div className="pl-6 space-y-1.5 pt-1 border-t border-primary/20">
          <p className="text-xs text-muted-foreground">Fields inside group (tap group name to edit)</p>
          {row.fields.map((gf) => {
            const f = fieldMap.get(gf.fieldId);
            return (
              <div key={gf.fieldId} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="flex-1 truncate">{f?.long || f?.short || gf.fieldId}</span>
                <span className="shrink-0">{gf.desktopSpan} / {gf.mobileSpan}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Group Creation Dialog ───────────────────────────────────────────────────

function GroupDialog({
  open,
  onOpenChange,
  fields,
  usedFieldIds,
  editingGroup,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: Field[];
  usedFieldIds: Set<string>;
  editingGroup: GroupDefinition | null;
  onSave: (group: GroupDefinition) => void;
}) {
  const [name, setName] = useState('');
  const [selectedFields, setSelectedFields] = useState<Array<{ fieldId: string; span: number }>>([]);

  useEffect(() => {
    if (open && editingGroup) {
      setName(editingGroup.name);
      setSelectedFields(
        editingGroup.fieldIds.map((fieldId, idx) => ({
          fieldId,
          span: editingGroup.fieldSpans[idx] ?? 4,
        }))
      );
    } else if (open) {
      setName('');
      setSelectedFields([]);
    }
  }, [open, editingGroup]);

  const availableFields = fields.filter((f) => {
    if (editingGroup && editingGroup.fieldIds.includes(f._id)) return true;
    return !usedFieldIds.has(f._id);
  });

  const handleSave = () => {
    if (!name.trim() || selectedFields.length === 0) return;
    onSave({
      id: editingGroup?.id || uuidv4(),
      name: name.trim(),
      fieldIds: selectedFields.map((sf) => sf.fieldId),
      fieldSpans: selectedFields.map((sf) => sf.span),
    });
    setName('');
    setSelectedFields([]);
  };

  const totalSpan = selectedFields.reduce((sum, sf) => sum + sf.span, 0);
  const remaining = TOTAL_COLS - totalSpan;

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) => {
      const exists = prev.find((sf) => sf.fieldId === fieldId);
      if (exists) return prev.filter((sf) => sf.fieldId !== fieldId);
      // Default span: fill remaining up to 4, minimum 1
      const defaultSpan = Math.min(4, Math.max(1, TOTAL_COLS - prev.reduce((s, f) => s + f.span, 0)));
      return [...prev, { fieldId, span: defaultSpan }];
    });
  };

  const updateSpan = (fieldId: string, span: number) => {
    setSelectedFields((prev) => {
      const others = prev.filter((sf) => sf.fieldId !== fieldId);
      const othersTotal = others.reduce((s, f) => s + f.span, 0);
      const clamped = Math.min(span, TOTAL_COLS - othersTotal);
      return prev.map((sf) => (sf.fieldId === fieldId ? { ...sf, span: Math.max(1, clamped) } : sf));
    });
  };

  const isSelected = (fieldId: string) => selectedFields.some((sf) => sf.fieldId === fieldId);
  const getFieldSpan = (fieldId: string) =>
    selectedFields.find((sf) => sf.fieldId === fieldId)?.span ?? 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingGroup ? 'Edit Group' : 'Create Group'}</DialogTitle>
          <DialogDescription>
            {editingGroup
              ? 'Update the group name and field configuration.'
              : 'Give your group a name and select fields with their column spans.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g. CIB, Specifications, Details"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <Label>Select Fields & Spans ({selectedFields.length})</Label>
              <span className={`text-xs font-medium ${remaining === 0 ? 'text-primary' : remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {totalSpan}/{TOTAL_COLS} cols used
              </span>
            </div>
            <div className="border rounded-lg p-3 flex-1 overflow-y-auto space-y-3">
              {availableFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All fields are already in use
                </p>
              ) : (
                availableFields.map((field) => {
                  const selected = isSelected(field._id);
                  const span = getFieldSpan(field._id);
                  const othersTotal = selectedFields.filter(sf => sf.fieldId !== field._id).reduce((s, f) => s + f.span, 0);
                  const maxSpan = TOTAL_COLS - othersTotal;
                  return (
                    <div
                      key={field._id}
                      className={`space-y-2 p-2 rounded-lg border transition-colors ${
                        selected ? 'bg-primary/5 border-primary/30' : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`field-${field._id}`}
                          checked={selected}
                          onCheckedChange={() => toggleField(field._id)}
                          disabled={!selected && remaining <= 0}
                        />
                        <Label
                          htmlFor={`field-${field._id}`}
                          className={`text-sm flex-1 font-medium ${!selected && remaining <= 0 ? 'text-muted-foreground' : 'cursor-pointer'}`}
                        >
                          {field.long || field.short}
                        </Label>
                      </div>

                      {selected && (
                        <div className="pl-6 flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={maxSpan}
                            value={span}
                            onChange={(e) => updateSpan(field._id, Number(e.target.value))}
                            className="flex-1 h-1.5 accent-primary cursor-pointer"
                          />
                          <span className="w-10 text-right text-xs font-medium text-foreground shrink-0">
                            {span}/{TOTAL_COLS}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || selectedFields.length === 0}
          >
            {editingGroup ? 'Update Group' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GridLayoutEditorV2({ fields, gridRows, onChange }: Props) {
  const [device, setDevice] = useState<Device>('desktop');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Group management
  const [groups, setGroups] = useState<GroupDefinition[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupDefinition | null>(null);

  // Reconstruct groups from gridRows on mount
  useEffect(() => {
    const groupRows = gridRows.filter((r) => r.kind === 'group') as Extract<IGridRowItem, { kind: 'group' }>[];
    if (groupRows.length > 0 && groups.length === 0) {
      const reconstructed: GroupDefinition[] = groupRows.map((r) => ({
        id: r.id,
        name: (r as any).name || 'Group',
        fieldIds: r.fields.map((gf) => gf.fieldId),
        fieldSpans: r.fields.map((gf) => gf.desktopSpan),
      }));
      setGroups(reconstructed);
    }
  }, [gridRows, groups.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fieldMap = new Map(fields.map((f) => [f._id, f]));

  const usedFieldIds = new Set(
    gridRows.flatMap((r) =>
      r.kind === 'field' ? [r.fieldId] : r.fields.map((gf) => gf.fieldId),
    ),
  );

  const usedGroupIds = new Set(
    gridRows.filter((r) => r.kind === 'group').map((r) => r.id),
  );

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // ── Actions ───────────────────────────────────────────────────────────────

  const addField = (fieldId: string) => {
    if (usedFieldIds.has(fieldId)) return;
    onChange([...gridRows, { kind: 'field', fieldId, desktopSpan: 2, mobileSpan: 12 }]);
  };

  const addGroup = (groupId: string) => {
    if (usedGroupIds.has(groupId)) return;
    const group = groupMap.get(groupId);
    if (!group) return;
    const groupFields: IGridField[] = group.fieldIds.map((fieldId, idx) => ({
      fieldId,
      desktopSpan: group.fieldSpans[idx] ?? 4,
      mobileSpan: group.fieldSpans[idx] ?? 4,
    }));
    onChange([
      ...gridRows,
      {
        kind: 'group',
        id: group.id,
        name: group.name,
        desktopSpan: 8,
        mobileSpan: 12,
        fields: groupFields,
      } as any,
    ]);
  };

  const removeRow = (rowId: string) =>
    onChange(gridRows.filter((r) => getRowId(r) !== rowId));

  const commitRowSpan = useCallback(
    (rowId: string, dev: Device, span: number) =>
      onChange(gridRows.map((r) => (getRowId(r) !== rowId ? r : withSpan(r, dev, span)))),
    [gridRows, onChange],
  );

  const openCreateGroupDialog = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const openEditGroupDialog = (groupId: string) => {
    const group = groupMap.get(groupId);
    if (!group) return;
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = (group: GroupDefinition) => {
    if (editingGroup) {
      setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
      onChange(
        gridRows.map((r) => {
          if (r.kind !== 'group' || r.id !== group.id) return r;
          const groupFields: IGridField[] = group.fieldIds.map((fieldId, idx) => ({
            fieldId,
            desktopSpan: group.fieldSpans[idx] ?? 4,
            mobileSpan: group.fieldSpans[idx] ?? 4,
          }));
          return { ...r, name: group.name, fields: groupFields } as any;
        })
      );
    } else {
      setGroups((prev) => [...prev, group]);
    }
    setGroupDialogOpen(false);
    setEditingGroup(null);
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIdx = gridRows.findIndex((r) => `row-${getRowId(r)}` === active.id);
    const newIdx = gridRows.findIndex((r) => `row-${getRowId(r)}` === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      onChange(arrayMove(gridRows, oldIdx, newIdx));
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────

  // Compute firstRowFieldIds the same way LayoutView does
  const firstRowFieldIds = (() => {
    const ids = new Set<string>();
    let cumulativeSpan = 0;
    for (const row of gridRows) {
      const span = getSpan(row, device);
      if (cumulativeSpan + span > TOTAL_COLS) break;
      if (row.kind === 'field') {
        ids.add(row.fieldId);
      } else {
        row.fields.forEach((gf) => ids.add(gf.fieldId));
      }
      cumulativeSpan += span;
      if (cumulativeSpan >= TOTAL_COLS) break;
    }
    return ids;
  })();

  const colGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '0 4px',
    alignItems: 'center',
    minWidth: 0,
  };

  const getDisplayLabel = (f: Field | undefined) => {
    if (!f) return '—';
    return f.displayAs === 'short' ? (f.short || f.long) : (f.long || f.short);
  };

  const renderPreviewColumns = (isHeader: boolean) => {
    const rowsToRender = isHeader
      ? gridRows.filter((row) => {
          if (row.kind === 'field') return firstRowFieldIds.has(row.fieldId);
          return row.fields.some((gf) => firstRowFieldIds.has(gf.fieldId));
        })
      : gridRows;

    const renderFieldCell = (
      key: string,
      f: Field | undefined,
      span: number,
      isSecondLine: boolean,
    ) => {
      if (isHeader) {
        return (
          <div
            key={key}
            style={{ gridColumn: `span ${span}`, minWidth: 0 }}
            className="truncate"
          >
            {f?.showInHeader ? (f.long || f.short || '') : ''}
          </div>
        );
      }
      return (
        <div
          key={key}
          style={{ gridColumn: `span ${span}`, minWidth: 0 }}
          className={`truncate ${isSecondLine ? 'text-muted-foreground' : ''}`}
        >
          <span
            className={isSecondLine ? 'text-xs' : 'text-sm'}
            style={f?.showAsBold ? { fontWeight: 600 } : undefined}
          >
            {getDisplayLabel(f)}
          </span>
        </div>
      );
    };

    return rowsToRender.map((row) => {
      const span = getSpan(row, device);

      if (row.kind === 'field') {
        const f = fieldMap.get(row.fieldId);
        const isSecondLine = !firstRowFieldIds.has(row.fieldId);
        return renderFieldCell(row.fieldId, f, span, isSecondLine);
      }

      // group row
      return (
        <div key={row.id} style={{ gridColumn: `span ${span}`, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0 4px' }}>
            {row.fields
              .filter((gf) => !isHeader || firstRowFieldIds.has(gf.fieldId))
              .map((gf) => {
                const f = fieldMap.get(gf.fieldId);
                const innerSpan = getSpan(gf, device);
                const isSecondLine = !firstRowFieldIds.has(gf.fieldId);
                return renderFieldCell(gf.fieldId, f, innerSpan, isSecondLine);
              })}
          </div>
        </div>
      );
    });
  };

  // Active drag label for overlay
  const activeDragLabel = (() => {
    if (!activeId) return null;
    const row = gridRows.find((r) => `row-${getRowId(r)}` === activeId);
    if (!row) return null;
    if (row.kind === 'field') return fieldMap.get(row.fieldId)?.long ?? '?';
    return (row as any).name || `Group (${row.fields.length})`;
  })();

  // Available (unused) fields and groups
  const availableFields = fields.filter((f) => !usedFieldIds.has(f._id));
  const availableGroups = groups.filter((g) => !usedGroupIds.has(g.id));

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add fields, then set column widths per device with sliders.
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* ── Available fields ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground tracking-wide">
              Available fields
            </Label>
          </div>

          {availableFields.length === 0 && availableGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg bg-muted/20">
              All fields are in the layout
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/20">
              {availableFields.map((f) => (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => addField(f._id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm bg-background hover:border-primary/60 hover:bg-muted/50 transition-all"
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                  <span>{f.long || f.short}</span>
                </button>
              ))}
              {availableGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => addGroup(g.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/5 text-sm hover:border-primary hover:bg-primary/10 transition-all"
                >
                  <Plus className="h-3 w-3 text-primary" />
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground">({g.fieldIds.length})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Groups management ── */}
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground tracking-wide">
            Groups
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCreateGroupDialog}
            disabled={availableFields.length === 0}
            className="border-dashed h-7 text-xs"
          >
            <Layers className="h-3 w-3 mr-1" />
            Create Group
          </Button>
        </div>
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const isUsed = usedGroupIds.has(g.id);
              return (
                <div
                  key={g.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/5 text-sm ${
                    isUsed ? 'opacity-40' : ''
                  }`}
                >
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground">({g.fieldIds.length})</span>
                  <button
                    type="button"
                    onClick={() => openEditGroupDialog(g.id)}
                    className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                  >
                    edit
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Layout rows ── */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Layout ({gridRows.length} column{gridRows.length !== 1 ? 's' : ''}) — drag to reorder
          </Label>

          {gridRows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg bg-muted/20">
              Tap a field above to add it to your layout
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={gridRows.map((r) => `row-${getRowId(r)}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {gridRows.map((row) => {
                    const rowId = getRowId(row);
                    if (row.kind === 'field') {
                      return (
                        <SortableFieldCard
                          key={rowId}
                          row={row}
                          field={fieldMap.get(row.fieldId)}
                          onRemove={() => removeRow(rowId)}
                          onCommitSpan={(dev, span) => commitRowSpan(rowId, dev, span)}
                        />
                      );
                    }
                    return (
                      <SortableGroupCard
                        key={rowId}
                        row={row}
                        groupName={(row as any).name || 'Group'}
                        fieldMap={fieldMap}
                        onRemove={() => removeRow(rowId)}
                        onCommitSpan={(dev, span) => commitRowSpan(rowId, dev, span)}
                        onEdit={() => openEditGroupDialog(row.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeDragLabel && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background shadow-lg text-sm pointer-events-none opacity-90">
                    <GripVertical className="h-3 w-3" />
                    {activeDragLabel}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* ── Preview ── */}
        {gridRows.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Preview
              </Label>
              <Tabs value={device} onValueChange={(v) => setDevice(v as Device)}>
                <TabsList className="h-7">
                  <TabsTrigger value="desktop" className="h-6 text-xs px-2">
                    <Monitor className="h-3 w-3 mr-1" />Desktop
                  </TabsTrigger>
                  <TabsTrigger value="mobile" className="h-6 text-xs px-2">
                    <Smartphone className="h-3 w-3 mr-1" />Mobile
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="border rounded-lg overflow-hidden text-sm">
              {/* Header row */}
              <div className="px-3 py-2 bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground border-b">
                <div style={colGridStyle}>
                  {renderPreviewColumns(true)}
                </div>
              </div>
              {/* Simulated data row 1 */}
              <div className="flex items-center px-3 py-2 border-b bg-muted">
                <div style={colGridStyle}>
                  {renderPreviewColumns(false)}
                </div>
              </div>
              {/* Simulated data row 2 */}
              <div className="flex items-center px-3 py-2 bg-muted/50">
                <div style={colGridStyle}>
                  {renderPreviewColumns(false)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Group dialog */}
        <GroupDialog
          open={groupDialogOpen}
          onOpenChange={setGroupDialogOpen}
          fields={fields}
          usedFieldIds={usedFieldIds}
          editingGroup={editingGroup}
          onSave={handleSaveGroup}
        />
      </CardContent>
    </Card>
  );
}
