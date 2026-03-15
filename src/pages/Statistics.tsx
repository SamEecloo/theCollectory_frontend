import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import api from '@/lib/api';
import RecentItemsWidget from '@/components/widgets/RecentItemsWidget';
import TagsDistributionWidget from '@/components/widgets/TagsDistributionWidget';
import ActivityWidget from '@/components/widgets/ActivityWidget';
import DropdownDistributionWidget from '@/components/widgets/DropdownDistributionWidget';
import ImageStatsWidget from '@/components/widgets/ImageStatsWidget';
import NumberStatsWidget from '@/components/widgets/NumberStatsWidget';
import DailyItemWidget from '@/components/widgets/DailyitemWidget';
import { AVAILABLE_WIDGETS } from '@/constants/widgetTypes';

type Widget = {
  id: string;
  type: string;
  position: number;
  config: Record<string, any>;
};

type Collection = {
  _id: string;
  name: string;
};

// ─── Sortable wrapper ────────────────────────────────────────────────────────

type SortableWidgetProps = {
  widget: Widget;
  children: React.ReactNode;
  isDragging?: boolean;
};

function SortableWidget({ widget, children }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging: isSelfDragging,
  } = useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSelfDragging ? 0.35 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="break-inside-avoid">
      {/* Drag handle — sits above the card in the top-left corner */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="
          absolute left-0 top-11 z-10
          flex items-center justify-center
          w-6 h-6 rounded-md
          text-muted-foreground/40 hover:text-muted-foreground
          hover:bg-muted
          cursor-grab active:cursor-grabbing
          transition-colors touch-none
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {children}
    </div>
  );
}

// ─── Statistics page ─────────────────────────────────────────────────────────

export default function Statistics() {
  const { collectionName } = useParams();
  const userName = localStorage.getItem('username');

  const [collection, setCollection] = useState<Collection | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors: pointer (mouse) + touch + keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small movement before starting drag,
      // so clicks on buttons inside the card still work.
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchCollection(), fetchWidgets()]);
    };
    loadData();
  }, [userName, collectionName]);

  const fetchCollection = async () => {
    try {
      const encodedName = encodeURIComponent(collectionName || '');
      const response = await api.get(`/collections/${encodedName}`);
      setCollection(response.data);
    } catch (err) {
      console.error('Failed to fetch collection:', err);
      toast.error('Failed to load collection');
    }
  };

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const encodedName = encodeURIComponent(collectionName || '');
      const response = await api.get(`/widgets/settings/${encodedName}`);
      setWidgets(response.data);
    } catch (err) {
      console.error('Failed to fetch widgets:', err);
      toast.error('Failed to load widgets');
    } finally {
      setLoading(false);
    }
  };

  const saveWidgets = async (updatedWidgets: Widget[]) => {
    try {
      const encodedName = encodeURIComponent(collectionName || '');
      await api.put(`/widgets/settings/${encodedName}`, { widgets: updatedWidgets });
      setWidgets(updatedWidgets);
    } catch (err) {
      console.error('Failed to save widgets:', err);
      toast.error('Failed to save widgets');
    }
  };

  const addWidget = (type: string) => {
    const newWidget: Widget = {
      id: Date.now().toString(),
      type,
      position: widgets.length,
      config: {},
    };
    saveWidgets([...widgets, newWidget]);
    setDialogOpen(false);
    toast.success('Widget added');
  };

  const removeWidget = (id: string) => {
    const updated = widgets
      .filter(w => w.id !== id)
      .map((w, idx) => ({ ...w, position: idx }));
    saveWidgets(updated);
    toast.success('Widget removed');
  };

  const updateWidgetConfig = (id: string, config: any) => {
    const updated = widgets.map(w =>
      w.id === id ? { ...w, config } : w
    );
    saveWidgets(updated);
    toast.success('Widget settings saved');
  };

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sorted = [...widgets].sort((a, b) => a.position - b.position);
    const oldIndex = sorted.findIndex(w => w.id === active.id);
    const newIndex = sorted.findIndex(w => w.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((w, idx) => ({
      ...w,
      position: idx,
    }));

    saveWidgets(reordered);
  };

  // ── Widget renderer ────────────────────────────────────────────────────────

  const renderWidgetContent = (widget: Widget) => {
    const commonProps = {
      id: widget.id,
      collectionId: collection?._id,
      collectionName,
      onRemove: () => removeWidget(widget.id),
    };

    switch (widget.type) {
      case 'recent-items':
        return (
          <RecentItemsWidget
            {...commonProps}
            config={widget.config}
            onConfigChange={(config) => updateWidgetConfig(widget.id, config)}
          />
        );
      case 'activity':
        return <ActivityWidget {...commonProps} />;
      case 'dropdown-distribution':
        return (
          <DropdownDistributionWidget
            {...commonProps}
            config={widget.config}
            onConfigChange={(config) => updateWidgetConfig(widget.id, config)}
          />
        );
      case 'tags-distribution':
        return (
          <TagsDistributionWidget
            {...commonProps}
            config={widget.config}
            onConfigChange={(config) => updateWidgetConfig(widget.id, config)}
          />
        );
      case 'image-stats':
        return <ImageStatsWidget {...commonProps} />;
      case 'number-stats':
        return (
          <NumberStatsWidget
            {...commonProps}
            config={widget.config}
            onConfigChange={(config) => updateWidgetConfig(widget.id, config)}
          />
        );
      case 'daily-item':
        return (
          <DailyItemWidget
            {...commonProps}
            config={widget.config}
            onConfigChange={(config) => updateWidgetConfig(widget.id, config)}
          />
        );
      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position);
  const activeWidget = activeId ? widgets.find(w => w.id === activeId) : null;

  return (
    <div className="py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-0">
        <div>
          <h1 className="text-2xl">{collection?.name} Statistics</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Add widgets to track your activity
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Widget</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Widget</DialogTitle>
              <DialogDescription>
                Choose a widget to add to your statistics dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {AVAILABLE_WIDGETS.map((widget) => (
                <button
                  key={widget.type}
                  onClick={() => addWidget(widget.type)}
                  className="w-full p-4 text-left border rounded-lg hover:bg-muted transition-colors"
                >
                  <h3 className="font-medium">{widget.name}</h3>
                  <p className="text-sm text-muted-foreground">{widget.description}</p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Widgets */}
      {widgets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No widgets yet</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Widget
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedWidgets.map(w => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* 
              Masonry-style columns layout.
              On mobile: single column. On md+: two columns.
              Padding-left gives space for the drag handle.
            */}
            <div className="columns-1 md:columns-2 gap-6 space-y-6 sm:pl-5">
              {sortedWidgets.map((widget) => (
                <SortableWidget key={widget.id} widget={widget}>
                  {renderWidgetContent(widget)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>

          {/* DragOverlay: renders a floating ghost of the dragged card */}
          <DragOverlay>
            {activeWidget ? (
              <div className="opacity-90 shadow-2xl rotate-1 scale-[1.02] transition-transform">
                {renderWidgetContent(activeWidget)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}