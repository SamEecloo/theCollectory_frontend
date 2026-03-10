import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GripVertical, X, Monitor, Smartphone, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IGridField } from '@/types';

type Field = {
  _id: string;
  long: string;
  short: string;
  type: string;
};

type Props = {
  fields: Field[];
  gridFields: IGridField[];
  onChange: (gridFields: IGridField[]) => void;
};

// Draggable field pill (from available fields)
function DraggableField({ field, isInGrid }: { field: Field; isInGrid: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-${field._id}`,
    data: { type: 'field', field },
    disabled: isInGrid,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm select-none transition-all ${
        isInGrid
          ? 'opacity-40 cursor-not-allowed bg-muted'
          : isDragging
          ? 'opacity-50 cursor-grabbing bg-primary/10 border-primary'
          : 'cursor-grab bg-background hover:bg-muted hover:border-primary/50'
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span className="truncate">{field.long || field.short}</span>
    </div>
  );
}

// Drop zone for the grid
function GridDropZone({ children, hasItems }: { children: React.ReactNode; hasItems: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'grid-drop-zone' });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 p-3 border-2 border-dashed rounded-lg transition-colors ${
        isOver
          ? 'border-primary bg-primary/5'
          : hasItems
          ? 'border-muted-foreground/20 bg-muted/30'
          : 'border-muted-foreground/20'
      }`}
    >
      {!hasItems && (
        <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
          Drag fields here
        </div>
      )}
      {children}
    </div>
  );
}

// Span selector buttons (1-12)
function SpanSelector({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
          <Button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-7 h-7 text-xs rounded border transition-all ${
              value === n
                ? 'bg-primary text-primary-foreground border-primary font-bold'
                : 'bg-background hover:bg-muted border-muted-foreground/30'
            }`}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Grid field card (inside the grid)
function GridFieldCard({
  gridField,
  field,
  activeTab,
  onRemove,
  onChangeSpan,
}: {
  gridField: IGridField;
  field: Field | undefined;
  activeTab: 'desktop' | 'mobile';
  onRemove: () => void;
  onChangeSpan: (span: number) => void;
}) {
  const span = activeTab === 'desktop' ? gridField.desktopSpan : gridField.mobileSpan;

  return (
    <div
      className="bg-background border rounded-lg p-3 space-y-3"
      style={{
        gridColumn: `span ${span}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">
          {field?.long || field?.short || 'Unknown'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {span} col{span !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SpanSelector
        value={span}
        onChange={onChangeSpan}
        label={activeTab === 'desktop' ? 'Desktop span' : 'Mobile span'}
      />
    </div>
  );
}

export default function GridFieldConfig({ fields, gridFields, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fieldMap = new Map(fields.map(f => [f._id, f]));
  const inGridIds = new Set(gridFields.map(gf => gf.fieldId));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Dropping a field into the grid
    if (
      active.data.current?.type === 'field' &&
      over.id === 'grid-drop-zone'
    ) {
      const field = active.data.current.field as Field;
      if (inGridIds.has(field._id)) return;

      onChange([
        ...gridFields,
        {
          fieldId: field._id,
          desktopSpan: 1,
          mobileSpan: 12,
        },
      ]);
    }
  };

  const removeFromGrid = (fieldId: string) => {
    onChange(gridFields.filter(gf => gf.fieldId !== fieldId));
  };

  const updateSpan = (fieldId: string, span: number) => {
    onChange(
      gridFields.map(gf =>
        gf.fieldId === fieldId
          ? {
              ...gf,
              desktopSpan: activeTab === 'desktop' ? span : gf.desktopSpan,
              mobileSpan: activeTab === 'mobile' ? span : gf.mobileSpan,
            }
          : gf
      )
    );
  };

  // Active dragging field (for overlay)
  const activeDragField = activeId
    ? fields.find(f => `field-${f._id}` === activeId)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Grid Column Layout</CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag fields into the grid and set their column span (out of 12) for each device.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-3 gap-4">
            {/* Available Fields */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Available Fields
              </Label>
              <div className="space-y-2 p-3 border rounded-lg bg-muted/30 min-h-32">
                {fields.map(f => (
                  <DraggableField
                    key={f._id}
                    field={f}
                    isInGrid={inGridIds.has(f._id)}
                  />
                ))}
                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">No fields defined yet</p>
                )}
              </div>
            </div>

            {/* Grid Config */}
            <div className="col-span-2 space-y-2">
              <Tabs
                value={activeTab}
                onValueChange={v => setActiveTab(v as 'desktop' | 'mobile')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="desktop">
                    <Monitor className="h-4 w-4 mr-2" />
                    Desktop
                  </TabsTrigger>
                  <TabsTrigger value="mobile">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Mobile
                  </TabsTrigger>
                </TabsList>

                {(['desktop', 'mobile'] as const).map(tab => (
                  <TabsContent key={tab} value={tab} className="space-y-3 mt-3">
                    <GridDropZone hasItems={gridFields.length > 0}>
                      {gridFields.length > 0 && (
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}
                        >
                          {gridFields.map(gf => (
                            <GridFieldCard
                              key={gf.fieldId}
                              gridField={gf}
                              field={fieldMap.get(gf.fieldId)}
                              activeTab={tab}
                              onRemove={() => removeFromGrid(gf.fieldId)}
                              onChangeSpan={span => updateSpan(gf.fieldId, span)}
                            />
                          ))}
                        </div>
                      )}
                    </GridDropZone>

                    {/* Preview */}
                    {gridFields.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Preview ({tab})
                        </Label>
                        <div
                          className="grid gap-1 p-3 border rounded-lg bg-muted/30"
                          style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}
                        >
                          {gridFields.map(gf => {
                            const field = fieldMap.get(gf.fieldId);
                            const span = tab === 'desktop' ? gf.desktopSpan : gf.mobileSpan;
                            return (
                              <div
                                key={gf.fieldId}
                                className="bg-primary/15 border border-primary/20 rounded px-2 py-1 text-xs truncate text-center"
                                style={{ gridColumn: `span ${span}` }}
                              >
                                {field?.long || field?.short || '?'}
                                <span className="text-muted-foreground ml-1">({span})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeDragField && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background shadow-lg text-sm">
                <GripVertical className="h-3 w-3" />
                {activeDragField.long || activeDragField.short}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}