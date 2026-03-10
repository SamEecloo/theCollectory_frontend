import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Image, ImageOff, BarChart3, Settings, Plus } from 'lucide-react';
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FiltersPanel from "@/components/filters-panel";
import Pagination from "@/components/pagination";
import BulkActions from "@/components/bulk-actions";
import ViewToggle from '@/components/view-toggle';
import type { IGridRowItem } from '@/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldConfig {
  isActive: boolean;
  _id: string;
  short: string;
  long: string;
  type: string;
  showInHeader: boolean;
  showAsBold: boolean;
  useInGrid: boolean;
  displayAs: "long" | "short";
  options?: { _id: string; short: string; long: string }[];
  dropdownOptions?: { _id: string; short: string; long: string }[];
}

interface Item {
  _id: string;
  properties: Record<string, any>;
}

interface Collection {
  _id: string;
  name: string;
  owner?: { username: string };
  config: {
    fields: FieldConfig[];
    defaultSort: { fieldId: string; direction: "asc" | "desc" };
    layout?: {
      gridRows?: IGridRowItem[];
    };
  };
}

type ViewMode = 'table' | 'grid';

type ViewCollectionProps = {
  isPublicView?: boolean;
};

// ─── Breakpoint hook ──────────────────────────────────────────────────────────
// Matches the editor's Device type: anything narrower than 768px is 'mobile'.

function useDevice(): 'desktop' | 'mobile' {
  const [device, setDevice] = useState<'desktop' | 'mobile'>(
    () => window.innerWidth < 768 ? 'mobile' : 'desktop'
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setDevice(e.matches ? 'mobile' : 'desktop');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return device;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSpan = (
  item: { desktopSpan: number; mobileSpan: number },
  device: 'desktop' | 'mobile',
) => (device === 'desktop' ? item.desktopSpan : item.mobileSpan);

// ─── Skeleton Loaders ─────────────────────────────────────────────────────────

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="animate-pulse">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <TableCell key={colIdx}>
                  <div className="h-4 bg-muted rounded w-full"></div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GridSkeleton({ items }: { items: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="w-full aspect-landscape bg-muted"></div>
          <div className="p-3 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Grid layout renderer ─────────────────────────────────────────────────────

interface LayoutViewProps {
  gridRows: IGridRowItem[];
  device: 'desktop' | 'mobile';
  fields: FieldConfig[];
  items: Item[];
  isPublicView: boolean;
  selectedIds: string[];
  currentSortField: string | null;
  currentSortDirection: 'asc' | 'desc';
  onItemClick: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSort: (fieldId: string) => void;
  renderCell: (field: FieldConfig, value: any) => React.ReactNode;
  optionMaps: Map<string, Map<string, any>>;
  onDelete: (id: string) => void;
}

function LayoutView({
  gridRows,
  device,
  fields,
  items,
  isPublicView,
  selectedIds,
  currentSortField,
  currentSortDirection,
  onItemClick,
  onToggleSelect,
  onSort,
  renderCell,
  onDelete,
}: LayoutViewProps) {
  const fieldMap = useMemo(
    () => new Map(fields.map((f) => [f._id, f])),
    [fields],
  );

  const renderSortIcon = (fieldId: string) => {
    if (currentSortField !== fieldId) return null;
    return currentSortDirection === "asc" ? " ▲" : " ▼";
  };

  if (gridRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No grid layout configured. Edit the collection to set one up.
      </p>
    );
  }

  // The 12-col grid is used for field columns only. The checkbox lives in a
  // flex wrapper outside the grid so it never steals a span from the layout.
  const colGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '0 12px',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  };

  // Renders the field columns for a single row (header labels or item values).
  // For headers: receives a callback that returns the label + sort icon.
  const renderColumns = (getValue: (fieldId: string) => React.ReactNode, isHeader = false) =>
    gridRows.map((row) => {
      const span = getSpan(row, device);

      if (row.kind === 'field') {
        const field = fieldMap.get(row.fieldId);
        if (!field || field.isActive === false) return null;
        
        const content = getValue(row.fieldId);
        
        // Header cells are clickable for sorting
        if (isHeader && field.showInHeader) {
          return (
            <div
              key={row.fieldId}
              style={{ gridColumn: `span ${span}`, minWidth: 0 }}
              className="truncate cursor-pointer hover:bg-muted/50 transition-colors rounded px-1 -mx-1"
              onClick={() => onSort(row.fieldId)}
            >
              {content}
            </div>
          );
        }
        
        return (
          <div key={row.fieldId} style={{ gridColumn: `span ${span}`, minWidth: 0 }} className="truncate">
            {content}
          </div>
        );
      }

      // Group — nested 12-col grid keeps inner fields aligned with their header.
      return (
        <div key={row.id} style={{ gridColumn: `span ${span}`, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0 8px' }}>
            {row.fields.map((gf) => {
              const field = fieldMap.get(gf.fieldId);
              if (!field || field.isActive === false) return null;
              const innerSpan = getSpan(gf, device);
              
              const content = getValue(gf.fieldId);
              
              // Inner header cells are also clickable
              if (isHeader && field.showInHeader) {
                return (
                  <div
                    key={gf.fieldId}
                    style={{ gridColumn: `span ${innerSpan}`, minWidth: 0 }}
                    className="truncate cursor-pointer hover:bg-muted/50 transition-colors rounded px-1 -mx-1"
                    onClick={() => onSort(gf.fieldId)}
                  >
                    {content}
                  </div>
                );
              }
              
              return (
                <div key={gf.fieldId} style={{ gridColumn: `span ${innerSpan}`, minWidth: 0 }} className="truncate">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      );
    });

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none">
      {/* Fixed-width spacer that mirrors the checkbox in data rows */}
      {!isPublicView && <div className="w-4 shrink-0" />}
      <div style={colGridStyle}>
        {renderColumns((fieldId) => {
          const field = fieldMap.get(fieldId);
          if (!field?.showInHeader) return '';
          return (
            <>
              {field.long || field.short}
              {renderSortIcon(fieldId)}
            </>
          );
        }, true)}
      </div>
    </div>
  );

  // ── Data rows ────────────────────────────────────────────────────────────────
  const rows = items.map((item) => (
    <SwipeableRow
      key={item._id}
      onDelete={() => onDelete(item._id)}
      isPublicView={isPublicView}
      device={device}
    >
      <div
        className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => onItemClick(item._id)}
      >
        {!isPublicView && device === 'desktop' && (
          <div className="w-4 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.includes(item._id)}
              onCheckedChange={() => onToggleSelect(item._id)}
            />
          </div>
        )}
        <div style={colGridStyle}>
          {renderColumns((fieldId) => {
            const field = fieldMap.get(fieldId);
            if (!field) return null;
            return (
              <span
                className="text-sm"
                style={field.showAsBold ? { fontWeight: 600 } : undefined}
              >
                {renderCell(field, item.properties[fieldId])}
              </span>
            );
          })}
        </div>
      </div>
    </SwipeableRow>
  ));

  return (
    <div className="border rounded-lg overflow-hidden">
      {header}
      {rows}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Swipeable Row for Mobile ────────────────────────────────────────────────

function SwipeableRow({
  children,
  onDelete,
  isPublicView,
  device,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  isPublicView: boolean;
  device: 'desktop' | 'mobile';
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);

  // Don't use swipe on desktop or public view
  if (device === 'desktop' || isPublicView) {
    return <>{children}</>;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentOffsetRef.current = offset;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    const newOffset = currentOffsetRef.current + diff;
    // Only allow swiping left (negative offset)
    setOffset(Math.min(0, Math.max(-80, newOffset)));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Snap to open (-80) or closed (0)
    setOffset(offset < -40 ? -80 : 0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-end bg-destructive">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-full w-full flex items-center justify-center text-destructive-foreground font-medium"
        >
          Delete
        </button>
      </div>

      {/* Swipeable content */}
      <div
        className="bg-background relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export default function ViewCollection({ isPublicView = false }: ViewCollectionProps) {
  const { collectionId, username, collectionName } = useParams();
  const navigate = useNavigate();
  const device = useDevice();

  // State
  const [collection, setCollection] = useState<Collection | null>(null);
  const [owner, setOwner] = useState<{ username: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false); // For filter/sort/pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterParams, setFilterParams] = useState<Record<string, any>>(() => {
    // Restore filters from localStorage on mount (survives F5 refresh)
    // We need to reconstruct the full params object that FiltersPanel's buildParams would create
    // Use collectionName initially since routes use names, FiltersPanel will update to use collection._id once loaded
    const stableId = isPublicView 
      ? `public-${collectionName}` 
      : collectionName;
    const savedFilters = localStorage.getItem(`filters_${stableId}`);
    if (!savedFilters) return { page: 1, limit: 25 };
    
    const { search, values } = JSON.parse(savedFilters);
    
    // Reconstruct params in the same format FiltersPanel's buildParams creates
    const f: Record<string, any> = {};
    for (const [fieldId, value] of Object.entries(values || {})) {
      if (value === undefined || value === "" || value === null) continue;
      
      if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        // Number range filter
        const rangeValue = value as { min?: string; max?: string };
        if (rangeValue.min !== undefined && rangeValue.min !== "") f[`f[min_${fieldId}]`] = String(rangeValue.min);
        if (rangeValue.max !== undefined && rangeValue.max !== "") f[`f[max_${fieldId}]`] = String(rangeValue.max);
      } else if (Array.isArray(value)) {
        // Tags filter
        if (value.length > 0) f[`f[${fieldId}]`] = value;
      } else {
        // Other filters
        f[`f[${fieldId}]`] = value;
      }
    }
    
    return {
      page: 1,
      limit: 25,
      ...(search ? { search } : {}),
      ...f,
    };
  });

  // Stable ID for storage keys
  const stableId = isPublicView ? `public-${collectionId}` : collection?._id || 'unknown';

  // Derived layout info
  const gridRows = useMemo<IGridRowItem[]>(
    () => collection?.config?.layout?.gridRows ?? [],
    [collection],
  );
  const hasGridLayout = gridRows.length > 0;

  const hasImageField = useMemo(
    () => collection?.config.fields.some((f) => f.type === 'image' && f.isActive !== false) ?? false,
    [collection],
  );

  const imageField = useMemo(
    () => collection?.config.fields.find((f) => f.type === 'image' && f.isActive !== false) ?? null,
    [collection],
  );

  // View mode — default to 'table', or 'grid' if saved preference + has images
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const storageKey = isPublicView ? `public-${collectionName}` : collectionName;
    const saved = localStorage.getItem(`viewMode_${storageKey}`);
    if (saved === 'table' || saved === 'grid') return saved as ViewMode;
    return 'table';
  });

  useEffect(() => {
    const storageKey = isPublicView ? `public-${collectionName}` : collectionName;
    localStorage.setItem(`viewMode_${storageKey}`, viewMode);
  }, [viewMode, collectionName, isPublicView]);

  // Pagination
  const [page, setPage] = useState(() => {
    // Restore from consolidated filter state
    const tempStableId = isPublicView ? `public-${collectionName}` : collectionName;
    const savedFilters = localStorage.getItem(`filters_${tempStableId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.page) return parsed.page;
    }
    // Fallback to old sessionStorage
    const savedPage = sessionStorage.getItem(`collection_page_${stableId}`);
    return savedPage ? parseInt(savedPage) : 1;
  });

  const [limit, setLimit] = useState(() => {
    // Try to restore from consolidated filter state first
    const tempStableId = isPublicView ? `public-${collectionName}` : collectionName;
    const savedFilters = localStorage.getItem(`filters_${tempStableId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.itemsPerPage) return parsed.itemsPerPage;
    }
    // Fallback to old sessionStorage
    const saved = sessionStorage.getItem("items_per_page");
    return saved ? parseInt(saved) : 25;
  });

  // Sort
  const storageKey = `collection_sort_${stableId}`;

  const [currentSortField, setCurrentSortField] = useState<string | null>(() => {
    // Try to restore from consolidated filter state
    const tempStableId = isPublicView ? `public-${collectionName}` : collectionName;
    const savedFilters = localStorage.getItem(`filters_${tempStableId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.sort?.fieldId) return parsed.sort.fieldId;
    }
    // Fallback to old sessionStorage
    const saved = sessionStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).fieldId : null;
  });

  const [currentSortDirection, setCurrentSortDirection] = useState<"asc" | "desc">(() => {
    // Try to restore from consolidated filter state
    const tempStableId = isPublicView ? `public-${collectionName}` : collectionName;
    const savedFilters = localStorage.getItem(`filters_${tempStableId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.sort?.direction) return parsed.sort.direction;
    }
    // Fallback to old sessionStorage
    const saved = sessionStorage.getItem(storageKey);
    return saved ? JSON.parse(saved).direction : "asc";
  });

  // Fetch
  const fetchData = useCallback(async () => {
    try {
      // Only show spinner on initial load, show skeletons on refetch
      if (!collection) {
        setInitialLoading(true);
      } else {
        setFetching(true);
      }

      const collectionUrl = isPublicView
        ? `/collections/${username}/${encodeURIComponent(collectionName || '')}`
        : `/collections/${collectionName}`;
      const collectionRes = await api.get(collectionUrl);

      if (!collectionRes.data) {
        console.error("Collection not found");
        return;
      }

      setCollection(collectionRes.data);

      const itemsUrl = isPublicView
        ? `/items/${username}/${collectionName}`
        : `/items/${collectionName}`;

      const params: Record<string, any> = { ...filterParams, page, limit };

      const savedSort = sessionStorage.getItem(storageKey);
      if (currentSortField) {
        params.sort = `${currentSortField}:${currentSortDirection}`;
      } else if (!savedSort && collectionRes.data.config?.defaultSort) {
        const { fieldId, direction } = collectionRes.data.config.defaultSort;
        params.sort = `${fieldId}:${direction}`;
        setCurrentSortField(fieldId);
        setCurrentSortDirection(direction);
        // Only persist if we have a valid ID (not 'unknown')
        const collectionStorageKey = `collection_sort_${isPublicView ? `public-${collectionId}` : collectionRes.data._id}`;
        sessionStorage.setItem(collectionStorageKey, JSON.stringify({ fieldId, direction }));
      }

      const itemsRes = await api.get(itemsUrl, { params });
      setItems(itemsRes.data.items);
      setTotalItems(itemsRes.data.total);

      if (isPublicView) {
        setOwner(collectionRes.data.owner || itemsRes.data.owner);
      } else {
        const currentUsername = localStorage.getItem('username');
        setOwner(currentUsername ? { username: currentUsername } : null);
      }
    } catch (err) {
      console.error("Failed to fetch collection or items", err);
    } finally {
      setInitialLoading(false);
      setFetching(false);
    }
  }, [
    isPublicView, username, collectionName,
    page, limit, filterParams,
    currentSortField, currentSortDirection,
    storageKey,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helpers
  const getMainImage = (item: Item) => {
    if (!imageField) return null;
    const images = item.properties[imageField._id];
    return Array.isArray(images) && images.length > 0 ? images[0] : null;
  };

  const getItemDisplayValue = (item: Item) => {
    const defaultSortFieldId = collection?.config.defaultSort?.fieldId;
    if (defaultSortFieldId && item.properties[defaultSortFieldId]) {
      return item.properties[defaultSortFieldId];
    }
    const firstField = collection?.config.fields.find((f) => f.isActive !== false);
    return firstField ? item.properties[firstField._id] || 'Untitled' : 'Untitled';
  };

  // Event handlers
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    sessionStorage.setItem(`collection_page_${stableId}`, String(newPage));
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleSort = (fieldId: string) => {
    const newDirection: "asc" | "desc" =
      currentSortField === fieldId && currentSortDirection === "asc" ? "desc" : "asc";
    setCurrentSortField(fieldId);
    setCurrentSortDirection(newDirection);
    if (stableId !== 'unknown') {
      sessionStorage.setItem(storageKey, JSON.stringify({ fieldId, direction: newDirection }));
    }
  };

  const resetSortToDefault = () => {
    if (!collection?.config?.defaultSort) {
      setCurrentSortField(null);
      setCurrentSortDirection("asc");
      if (stableId !== 'unknown') {
        sessionStorage.removeItem(storageKey);
      }
      return;
    }
    const { fieldId, direction } = collection.config.defaultSort;
    setCurrentSortField(fieldId);
    setCurrentSortDirection(direction);
    if (stableId !== 'unknown') {
      sessionStorage.setItem(storageKey, JSON.stringify({ fieldId, direction }));
    }
  };

  const handleItemClick = (itemId: string) => {
    const itemIds = items.map((i) => i._id);
    sessionStorage.setItem('itemNavigationList', JSON.stringify({
      itemIds,
      collectionId: collection?._id,
      collectionName,
      timestamp: Date.now(),
    }));

    if (isPublicView && owner) {
      navigate(`/${owner.username}/${encodeURIComponent(collectionName || '')}/items/${itemId}`);
    } else {
      navigate(`/collections/${collectionName}/items/${itemId}/edit`);
    }
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === items.length ? [] : items.map((item) => item._id));
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleDeleteComplete = () => {
    setSelectedIds([]);
    fetchData();
  };

  const handleSwipeDelete = (itemId: string) => {
    setDeletingItemId(itemId);
    setShowDeleteDialog(true);
  };

  const confirmSwipeDelete = async () => {
    if (!collection || !deletingItemId) return;
    
    setDeleting(true);
    try {
      await api.delete(`/items/item/${deletingItemId}`);
      //await api.delete(`/items/${collection.name}/${deletingItemId}`);
      setShowDeleteDialog(false);
      setDeletingItemId(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  // Cell rendering
  const renderSortIcon = (fieldId: string) => {
    if (currentSortField !== fieldId) return null;
    return currentSortDirection === "asc" ? " ▲" : " ▼";
  };

  const optionMaps = useMemo(() => {
    const map = new Map<string, Map<string, any>>();
    collection?.config?.fields.forEach((f) => {
      const opts = f.options ?? f.dropdownOptions;
      if (f.type === "dropdown" && opts?.length) {
        const inner = new Map<string, any>();
        opts.forEach((o) => inner.set(String(o._id), o));
        map.set(String(f._id), inner);
      }
    });
    return map;
  }, [collection]);

  const renderCell = useCallback((field: FieldConfig, value: any): React.ReactNode => {
    if (field.type === "checkbox") {
      const text = field.displayAs === "short" ? field.short : field.long;
      return (
        <span className={value ? "font-semibold" : "text-checkbox-unchecked"}>{text}</span>
      );
    }

    if (field.type === "dropdown") {
      const opts = field.options ?? field.dropdownOptions;
      const byId = optionMaps.get(String(field._id));
      const opt = byId?.get(String(value)) || opts?.find((o) => o._id === value);
      return opt ? (field.displayAs === "short" ? opt.short : opt.long) : "";
    }

    if (field.type === "image") {
      const hasImages = Array.isArray(value) && value.length > 0;
      return (
        <div className="flex items-center gap-2">
          <Image className={`h-5 w-5 ${hasImages ? 'text-primary' : 'text-image-empty'}`} />
          {hasImages && <span className="text-xs text-muted-foreground">{value.length}</span>}
        </div>
      );
    }

    if (Array.isArray(value)) return value.join(", ");
    return value ?? "";
  }, [optionMaps]);

  return (
    <div className="space-y-4">
      {isPublicView && owner && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Collection by{' '}
            <span className="font-medium text-foreground">@{owner.username}</span>
          </p>
        </div>
      )}

      {collection && (
        <FiltersPanel
          fields={collection.config.fields}
          onApply={setFilterParams}
          onClearAll={resetSortToDefault}
          defaultLimit={limit}
          collectionId={collection._id}
          collectionName={collection.name}
          currentSort={currentSortField ? { fieldId: currentSortField, direction: currentSortDirection } : null}
          currentPage={page}
          itemsPerPage={limit}
          onPageReset={() => setPage(1)}
        />
      )}

      <Card className="border-0 shadow-none md:border md:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{collection?.name || "Collection"}</CardTitle>

          <div className="flex items-center gap-2">
            {/* View toggle — show when collection has images */}
            {hasImageField && (
              <ViewToggle value={viewMode} onChange={setViewMode} />
            )}

            {!isPublicView && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/collections/${collection?.name}/stats`)}
                >
                  <BarChart3 className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/collections/${collection?.name}/edit`)}
                >
                  <Settings className="h-5 w-5" />
                </Button>
                <Button onClick={() => navigate(`/collections/${collection?.name}/add-item`)}>
                  Add Item
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 md:px-6">
          {(initialLoading || fetching) ? (
            // Show skeleton loaders while loading
            <div className="py-4">
              {viewMode === 'table' || !collection ? (
                <TableSkeleton rows={limit} columns={6} />
              ) : (
                <GridSkeleton items={limit} />
              )}
            </div>
          ) : collection ? (
            <>
              <Pagination
                currentPage={page}
                totalItems={totalItems}
                itemsPerPage={limit}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />

              {/* ── TABLE VIEW ── */}
              {viewMode === 'table' && (
                <>
                  {hasGridLayout ? (
                    <LayoutView
                      gridRows={gridRows}
                      device={device}
                      fields={collection.config.fields}
                      items={items}
                      isPublicView={isPublicView}
                      selectedIds={selectedIds}
                      currentSortField={currentSortField}
                      currentSortDirection={currentSortDirection}
                      onItemClick={handleItemClick}
                      onToggleSelect={toggleSelectItem}
                      onSort={handleSort}
                      renderCell={renderCell}
                      optionMaps={optionMaps}
                      onDelete={handleSwipeDelete}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {!isPublicView && device === 'desktop' && (
                            <TableHead className="w-12">
                              <Checkbox
                                checked={selectedIds.length === items.length && items.length > 0}
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                          )}
                          {collection.config.fields
                            .filter((f) => f.isActive !== false && f.useInGrid !== false)
                            .map((f) => (
                              <TableHead
                                key={f._id}
                                onClick={() => (f.showInHeader ? handleSort(f._id) : null)}
                                className={
                                  f.showInHeader ? "cursor-pointer hover:bg-muted select-none" : ""
                                }
                              >
                                {f.showInHeader && (
                                  <>
                                    {f.long}
                                    {renderSortIcon(f._id)}
                                  </>
                                )}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <SwipeableRow
                            key={item._id}
                            onDelete={() => handleSwipeDelete(item._id)}
                            isPublicView={isPublicView}
                            device={device}
                          >
                            <TableRow
                              onClick={() => handleItemClick(item._id)}
                              className="cursor-pointer hover:bg-muted"
                            >
                              {!isPublicView && device === 'desktop' && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedIds.includes(item._id)}
                                    onCheckedChange={() => toggleSelectItem(item._id)}
                                  />
                                </TableCell>
                              )}
                              {collection.config.fields
                                .filter((f) => f.isActive !== false && f.useInGrid !== false)
                                .map((f) => (
                                  <TableCell
                                    key={f._id}
                                    style={f.showAsBold ? { fontWeight: "bold" } : {}}
                                  >
                                    {renderCell(f, item.properties[f._id])}
                                  </TableCell>
                                ))}
                            </TableRow>
                          </SwipeableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}

              {/* ── IMAGE GRID VIEW ── */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {items.map((item) => {
                    const mainImage = getMainImage(item);
                    const displayValue = getItemDisplayValue(item);

                    return (
                      <Card
                        key={item._id}
                        className="relative group py-0 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                        onClick={() => handleItemClick(item._id)}
                      >
                        {!isPublicView && (
                          <div
                            className="absolute top-2 left-2 z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.includes(item._id)}
                              onCheckedChange={() => toggleSelectItem(item._id)}
                            />
                          </div>
                        )}
                        <div className="w-full h-full aspect-landscape bg-muted relative overflow-hidden">
                          {mainImage ? (
                            <img
                              src={`${BACKEND_URL}${mainImage.thumbnailUrl}`}
                              alt={displayValue}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="h-12 w-12 text-image-placeholder" />
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              <Pagination
                currentPage={page}
                totalItems={totalItems}
                itemsPerPage={limit}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />

              {!isPublicView && selectedIds.length > 0 && (
                <BulkActions
                  selectedIds={selectedIds}
                  fields={collection.config.fields}
                  onClearSelection={() => setSelectedIds([])}
                  onDeleteComplete={handleDeleteComplete}
                  onUpdateComplete={handleDeleteComplete}
                />
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog for swipe-to-delete */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item from your collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwipeDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete item"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          onClick={() => navigate(`/collections/${collection?.name}/add-item`)}
        >
          <Plus className="h-6 w-6" />
        </Button>

    </div>
  );
}