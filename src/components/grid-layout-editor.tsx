// src/components/grid-layout-editor.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Monitor, Smartphone, GripVertical, X, Layers } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type Field = { _id: string; long: string; short: string; type: string };
type Device = 'desktop' | 'mobile';

// Groups are now first-class entities with names
type GroupDefinition = {
  id: string;
  name: string;
  fieldIds: string[];
  fieldSpans: number[]; // Desktop spans for each field in fieldIds
};

type Props = {
  fields: Field[];
  gridRows: IGridRowItem[];
  onChange: (rows: IGridRowItem[]) => void;
};

const TOTAL_COLS = 12;
const PX_PER_COL = 80;

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

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ─── Resize Handle ────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  baseSpan: number;
  minSpan?: number;
  maxSpan?: number;
  onPreview: (span: number) => void;
  onCommit: (span: number) => void;
}

function ResizeHandle({
  baseSpan,
  minSpan = 1,
  maxSpan = TOTAL_COLS,
  onPreview,
  onCommit,
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const baseSpanRef = useRef<number>(baseSpan);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      baseSpanRef.current = baseSpan;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const rawDelta = (ev.clientX - startXRef.current) / PX_PER_COL;
        const colDelta = rawDelta > 0 ? Math.floor(rawDelta) : Math.ceil(rawDelta);
        const next = clamp(baseSpanRef.current + colDelta, minSpan, maxSpan);
        onPreview(next);
      };

      const onMouseUp = (ev: MouseEvent) => {
        const rawDelta = (ev.clientX - startXRef.current) / PX_PER_COL;
        const colDelta = rawDelta > 0 ? Math.floor(rawDelta) : Math.ceil(rawDelta);
        const next = clamp(baseSpanRef.current + colDelta, minSpan, maxSpan);
        onCommit(next);
        setDragging(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [baseSpan, minSpan, maxSpan, onPreview, onCommit],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group z-10 pointer-events-auto"
      title="Drag to resize"
    >
      <div
        className={`w-1 h-8 rounded transition-colors ${
          dragging ? 'bg-primary' : 'bg-muted-foreground/30 group-hover:bg-primary'
        }`}
      />
    </div>
  );
}

// ─── Draggable Pills ──────────────────────────────────────────────────────────

function DraggableFieldPill({ field, isUsed }: { field: Field; isUsed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pill-field-${field._id}`,
    data: { source: 'pill', type: 'field', fieldId: field._id },
    disabled: isUsed,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm select-none transition-all ${
        isUsed
          ? 'opacity-35 bg-muted cursor-not-allowed'
          : isDragging
          ? 'opacity-40 cursor-grabbing bg-primary/10 border-primary'
          : 'cursor-grab bg-background hover:border-primary/60 hover:bg-muted/50'
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span>{field.long || field.short}</span>
    </div>
  );
}

function DraggableGroupPill({ group, isUsed }: { group: GroupDefinition; isUsed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pill-group-${group.id}`,
    data: { source: 'pill', type: 'group', groupId: group.id },
    disabled: isUsed,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/5 text-sm select-none transition-all ${
        isUsed
          ? 'opacity-35 cursor-not-allowed'
          : isDragging
          ? 'opacity-40 cursor-grabbing border-primary bg-primary/10'
          : 'cursor-grab hover:border-primary hover:bg-primary/10'
      }`}
    >
      <Layers className="h-3 w-3 text-primary" />
      <span className="font-medium">{group.name}</span>
      <span className="text-xs text-muted-foreground">({group.fieldIds.length} fields)</span>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${isOver ? 'bg-primary/10 border-primary' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

// ─── Sortable Field ───────────────────────────────────────────────────────────

function SortableField({
  row,
  field,
  device,
  onRemove,
  onCommitSpan,
}: {
  row: Extract<IGridRowItem, { kind: 'field' }>;
  field: Field | undefined;
  device: Device;
  onRemove: () => void;
  onCommitSpan: (span: number) => void;
}) {
  const [localSpan, setLocalSpan] = useState<number | null>(null);
  const committedSpan = getSpan(row, device);
  const displaySpan = localSpan ?? committedSpan;

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: `row-${row.fieldId}`, data: { source: 'grid' } });

  const handleCommit = useCallback(
    (span: number) => {
      setLocalSpan(null);
      onCommitSpan(span);
    },
    [onCommitSpan],
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: `span ${displaySpan}`,
        minWidth: 0,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
      }}
    >
      <div className="bg-background border rounded-lg px-3 py-2 min-h-14 flex flex-col justify-between pr-5">
        <div className="flex items-center gap-1">
          <span className="cursor-grab" {...attributes} {...listeners}>
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </span>
          <span className="text-sm font-medium truncate flex-1">
            {field?.long || field?.short || '?'}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {displaySpan} col{displaySpan !== 1 ? 's' : ''}
        </span>
      </div>
      <ResizeHandle
        baseSpan={committedSpan}
        onPreview={setLocalSpan}
        onCommit={handleCommit}
      />
    </div>
  );
}

// ─── Sortable Group (compact display with edit on click) ────────────────────

function SortableGroup({
  row,
  groupName,
  device,
  onRemove,
  onCommitSpan,
  onEdit,
}: {
  row: Extract<IGridRowItem, { kind: 'group' }>;
  groupName: string;
  device: Device;
  onRemove: () => void;
  onCommitSpan: (span: number) => void;
  onEdit: () => void;
}) {
  const [localSpan, setLocalSpan] = useState<number | null>(null);
  const committedSpan = getSpan(row, device);
  const displaySpan = localSpan ?? committedSpan;

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: `row-${row.id}`, data: { source: 'grid' } });

  const handleCommit = useCallback(
    (span: number) => {
      setLocalSpan(null);
      onCommitSpan(span);
    },
    [onCommitSpan],
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: `span ${displaySpan}`,
        minWidth: 0,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
      }}
    >
      <div
        className="border-2 border-primary/40 rounded-lg p-3 bg-primary/5 min-h-14 flex flex-col justify-between pr-5 cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={onEdit}
      >
        <div className="flex items-center gap-1">
          <span className="cursor-grab" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </span>
          <Layers className="h-3 w-3 text-primary/60" />
          <span className="text-sm font-medium truncate flex-1">{groupName}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {row.fields.length} field{row.fields.length !== 1 ? 's' : ''} · {displaySpan} col{displaySpan !== 1 ? 's' : ''}
        </span>
      </div>

      <ResizeHandle
        baseSpan={committedSpan}
        onPreview={setLocalSpan}
        onCommit={handleCommit}
      />
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

  // Initialize from editingGroup when dialog opens
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

  // When editing, allow selecting fields that are in this group but not elsewhere
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

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) => {
      const exists = prev.find((sf) => sf.fieldId === fieldId);
      if (exists) {
        return prev.filter((sf) => sf.fieldId !== fieldId);
      }
      return [...prev, { fieldId, span: 4 }];
    });
  };

  const updateSpan = (fieldId: string, span: number) => {
    setSelectedFields((prev) =>
      prev.map((sf) => (sf.fieldId === fieldId ? { ...sf, span } : sf))
    );
  };

  const isSelected = (fieldId: string) => selectedFields.some((sf) => sf.fieldId === fieldId);
  const getSpan = (fieldId: string) => selectedFields.find((sf) => sf.fieldId === fieldId)?.span ?? 4;

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
            <Label>Select Fields & Spans ({selectedFields.length})</Label>
            <div className="border rounded-lg p-3 flex-1 overflow-y-auto space-y-3">
              {availableFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All fields are already in use
                </p>
              ) : (
                availableFields.map((field) => {
                  const selected = isSelected(field._id);
                  const span = getSpan(field._id);
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
                        />
                        <Label
                          htmlFor={`field-${field._id}`}
                          className="text-sm cursor-pointer flex-1 font-medium"
                        >
                          {field.long || field.short}
                        </Label>
                      </div>

                      {selected && (
                        <div className="pl-6 flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground w-16">
                            Span:
                          </Label>
                          <div className="flex items-center gap-1 flex-1">
                            {[1, 2, 3, 4, 6, 8, 12].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateSpan(field._id, s)}
                                className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                                  span === s
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'hover:bg-muted border-border'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
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

export default function GridLayoutEditor({ fields, gridRows, onChange }: Props) {
  const [device, setDevice] = useState<Device>('desktop');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);

  // Group management
  const [groups, setGroups] = useState<GroupDefinition[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupDefinition | null>(null);

  // Initialize groups from gridRows on mount (reconstruct from persisted data)
  useEffect(() => {
    const groupRows = gridRows.filter((r) => r.kind === 'group') as Extract<IGridRowItem, { kind: 'group' }>[];
    if (groupRows.length > 0 && groups.length === 0) {
      const reconstructed: GroupDefinition[] = groupRows.map((r) => ({
        id: r.id,
        name: (r as any).name || 'Group', // Read from row data
        fieldIds: r.fields.map((gf) => gf.fieldId),
        fieldSpans: r.fields.map((gf) => gf.desktopSpan),
      }));
      setGroups(reconstructed);
    }
  }, [gridRows, groups.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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

  // Normalize mobile spans for group fields on mount (migration for old data)
  useEffect(() => {
    const needsNormalization = gridRows.some(
      (r) => r.kind === 'group' && r.fields.some((gf) => gf.mobileSpan !== gf.desktopSpan)
    );
    if (needsNormalization) {
      onChange(
        gridRows.map((r) => {
          if (r.kind !== 'group') return r;
          return {
            ...r,
            fields: r.fields.map((gf) => ({
              ...gf,
              mobileSpan: gf.desktopSpan,
            })),
          };
        })
      );
    }
  }, []); // Only run once on mount

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
      // Update existing group
      setGroups((prev) => prev.map((g) => (g.id === group.id ? group : g)));
      // Update the grid row if this group is already placed
      onChange(
        gridRows.map((r) => {
          if (r.kind !== 'group' || r.id !== group.id) return r;
          const groupFields: IGridField[] = group.fieldIds.map((fieldId, idx) => ({
            fieldId,
            desktopSpan: group.fieldSpans[idx] ?? 4,
            mobileSpan: group.fieldSpans[idx] ?? 4,
          }));
          return { ...r, name: group.name, fields: groupFields } as any; // Cast until type updated
        })
      );
    } else {
      // Create new group
      setGroups((prev) => [...prev, group]);
    }
    setGroupDialogOpen(false);
    setEditingGroup(null);
  };

  const removeRow = (rowId: string) =>
    onChange(gridRows.filter((r) => getRowId(r) !== rowId));

  const commitRowSpan = (rowId: string, span: number) =>
    onChange(
      gridRows.map((r) => (getRowId(r) !== rowId ? r : withSpan(r, device, span))),
    );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setActiveDragData(e.active.data.current);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    setActiveDragData(null);
    if (!over) return;

    const src = active.data.current?.source;
    const type = active.data.current?.type;
    const overId = String(over.id);

    // ── Field pill dropped onto grid ───────────────────────────────────────
    if (src === 'pill' && type === 'field' && overId === 'grid-canvas') {
      const fieldId = active.data.current?.fieldId;
      if (usedFieldIds.has(fieldId)) return;
      onChange([...gridRows, { kind: 'field', fieldId, desktopSpan: 2, mobileSpan: 12 }]);
      return;
    }

    // ── Group pill dropped onto grid ───────────────────────────────────────
    if (src === 'pill' && type === 'group' && overId === 'grid-canvas') {
      const groupId = active.data.current?.groupId;
      if (usedGroupIds.has(groupId)) return;
      const group = groupMap.get(groupId);
      if (!group) return;

      // Convert group definition into grid row with configured spans (same for desktop and mobile)
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
          name: group.name, // Store name (type will need updating)
          desktopSpan: 8,
          mobileSpan: 12,
          fields: groupFields,
        } as any, // Cast to any until IGridRowItem type is updated
      ]);
      return;
    }

    // ── Reorder rows in grid ───────────────────────────────────────────────
    if (src === 'grid') {
      const oldIdx = gridRows.findIndex((r) => `row-${getRowId(r)}` === active.id);
      const newIdx = gridRows.findIndex((r) => `row-${getRowId(r)}` === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        onChange(arrayMove(gridRows, oldIdx, newIdx));
      }
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const renderPreview = (row: IGridRowItem) => {
    const span = getSpan(row, device);

    if (row.kind === 'field') {
      const f = fieldMap.get(row.fieldId);
      return (
        <div
          key={row.fieldId}
          className="bg-primary/15 border border-primary/30 rounded px-2 py-1 text-xs text-center truncate"
          style={{ gridColumn: `span ${span}`, minWidth: 0 }}
        >
          {f?.long || f?.short || '?'}
          <span className="text-muted-foreground ml-1">({span})</span>
        </div>
      );
    }

    return (
      <div
        key={row.id}
        className="border-2 border-dashed border-primary/40 rounded px-1 py-1"
        style={{ gridColumn: `span ${span}`, minWidth: 0 }}
      >
        <div className="text-xs text-muted-foreground mb-1 px-1">
          {(row as any).name || 'Group'} ({span})
        </div>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
          {row.fields.map((gf) => {
            const f = fieldMap.get(gf.fieldId);
            const inner = getSpan(gf, device);
            return (
              <div
                key={gf.fieldId}
                className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 text-xs truncate text-center"
                style={{ gridColumn: `span ${inner}`, minWidth: 0 }}
              >
                {f?.long || f?.short || '?'}
                <span className="text-muted-foreground ml-1">({inner})</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const activeDragLabel = (() => {
    if (!activeId || !activeDragData) return null;
    if (activeDragData.source === 'pill' && activeDragData.type === 'field') {
      return fieldMap.get(activeDragData.fieldId)?.long ?? '?';
    }
    if (activeDragData.source === 'pill' && activeDragData.type === 'group') {
      const group = groupMap.get(activeDragData.groupId);
      return group?.name ?? 'Group';
    }
    const row = gridRows.find((r) => `row-${getRowId(r)}` === activeId);
    if (!row) return null;
    if (row.kind === 'field') return fieldMap.get(row.fieldId)?.long ?? '?';
    return (row as any).name || `Group (${row.fields.length})`;
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Grid Layout</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drag fields and groups into the grid. Drag edges to resize.
            </p>
          </div>
          <Tabs value={device} onValueChange={(v) => setDevice(v as Device)}>
            <TabsList>
              <TabsTrigger value="desktop">
                <Monitor className="h-4 w-4 mr-1" />Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile">
                <Smartphone className="h-4 w-4 mr-1" />Mobile
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* ── Available fields & groups ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Fields & Groups — drag into grid
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCreateGroupDialog}
                className="border-dashed h-7 text-xs"
              >
                <Layers className="h-3 w-3 mr-1" />
                Create Group
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/20">
              {/* Field pills */}
              {fields.map((f) => (
                <DraggableFieldPill key={f._id} field={f} isUsed={usedFieldIds.has(f._id)} />
              ))}

              {/* Group pills */}
              {groups.map((g) => (
                <DraggableGroupPill key={g.id} group={g} isUsed={usedGroupIds.has(g.id)} />
              ))}

              {fields.length === 0 && groups.length === 0 && (
                <span className="text-xs text-muted-foreground">No fields or groups defined yet</span>
              )}
            </div>
          </div>

          {/* ── Grid canvas ── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Grid ({device}) — drag edges to resize
            </Label>

            <DropZone
              id="grid-canvas"
              className="min-h-24 p-3 border-2 border-dashed rounded-lg bg-muted/20"
            >
              {gridRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Drag fields or groups here to build your grid layout
                </p>
              ) : (
                <SortableContext
                  items={gridRows.map((r) => `row-${getRowId(r)}`)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
                    {gridRows.map((row) => {
                      const rowId = getRowId(row);
                      if (row.kind === 'field') {
                        return (
                          <SortableField
                            key={rowId}
                            row={row}
                            field={fieldMap.get(row.fieldId)}
                            device={device}
                            onRemove={() => removeRow(rowId)}
                            onCommitSpan={(span) => commitRowSpan(rowId, span)}
                          />
                        );
                      }
                      return (
                        <SortableGroup
                          key={rowId}
                          row={row}
                          groupName={(row as any).name || 'Group'}
                          device={device}
                          onRemove={() => removeRow(rowId)}
                          onCommitSpan={(span) => commitRowSpan(rowId, span)}
                          onEdit={() => openEditGroupDialog(row.id)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              )}
            </DropZone>
          </div>

          {/* ── Preview ── */}
          {gridRows.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Preview ({device})
              </Label>
              <div
                className="p-3 border rounded-lg bg-muted/30 grid gap-1"
                style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}
              >
                {gridRows.map(renderPreview)}
              </div>
            </div>
          )}

          <DragOverlay>
            {activeDragLabel && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background shadow-lg text-sm pointer-events-none">
                <GripVertical className="h-3 w-3" />
                {activeDragLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Group creation/editing dialog */}
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