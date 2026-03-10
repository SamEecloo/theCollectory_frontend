// ViewCollection.tsx
import { PrintToPDFModal } from "@/components/print-to-pdf";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Image, ImageOff, BarChart3, Settings, MoreHorizontal, Upload, FileDown, Heart, SlidersHorizontal } from 'lucide-react';
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FiltersPanel from "@/components/filters-panel-slide";
import ImportCSV from "@/components/ImportCSV";
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
  orientation?: 'landscape' | 'portrait' | 'square';
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
  isPublic: boolean;
}

type ViewMode = 'table' | 'grid';

type ViewCollectionProps = {
  isPublicView?: boolean;
  isWishlistView?: boolean;
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getSortFromStorage(stableId: string): { fieldId: string | null; direction: "asc" | "desc" } {
  try {
    const raw = localStorage.getItem(`filters_${stableId}`);
    if (!raw) return { fieldId: null, direction: "asc" };
    const parsed = JSON.parse(raw);
    return {
      fieldId: parsed.sort?.fieldId ?? null,
      direction: parsed.sort?.direction ?? "asc",
    };
  } catch {
    return { fieldId: null, direction: "asc" };
  }
}

function saveSortToStorage(stableId: string, fieldId: string | null, direction: "asc" | "desc") {
  try {
    const raw = localStorage.getItem(`filters_${stableId}`);
    const existing = raw ? JSON.parse(raw) : {};
    if (fieldId) {
      existing.sort = { fieldId, direction };
    } else {
      delete existing.sort;
    }
    localStorage.setItem(`filters_${stableId}`, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

// ─── Breakpoint hook ──────────────────────────────────────────────────────────

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
  renderCell: (field: FieldConfig, value: any, isSecondLine?: boolean) => React.ReactNode;
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

  const firstRowFieldIds = useMemo(() => {
    const ids = new Set<string>();
    let cumulativeSpan = 0;

    for (const row of gridRows) {
      const span = getSpan(row, device);
      if (cumulativeSpan + span > 12) break;
      if (row.kind === 'field') {
        ids.add(row.fieldId);
      } else {
        row.fields.forEach(gf => ids.add(gf.fieldId));
      }
      cumulativeSpan += span;
      if (cumulativeSpan >= 12) break;
    }

    return ids;
  }, [gridRows, device]);

  const colGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '0 4px',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  };

  const renderColumns = (
    getValue: (fieldId: string, isSecondLine: boolean) => React.ReactNode,
    isHeader = false
  ) => {
    const rowsToRender = isHeader
      ? gridRows.filter((row) => {
          if (row.kind === 'field') return firstRowFieldIds.has(row.fieldId);
          return row.fields.some(gf => firstRowFieldIds.has(gf.fieldId));
        })
      : gridRows;

    return rowsToRender.map((row) => {
      const span = getSpan(row, device);

      if (row.kind === 'field') {
        const field = fieldMap.get(row.fieldId);
        if (!field || field.isActive === false) return null;
        const isSecondLine = !firstRowFieldIds.has(row.fieldId);
        const content = getValue(row.fieldId, isSecondLine);

        if (isHeader && field.showInHeader && firstRowFieldIds.has(row.fieldId)) {
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
          <div
            key={row.fieldId}
            style={{ gridColumn: `span ${span}`, minWidth: 0 }}
            className={`truncate ${isSecondLine ? 'text-muted-foreground text-xs' : ''}`}
          >
            {content}
          </div>
        );
      }

      return (
        <div key={row.id} style={{ gridColumn: `span ${span}`, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0 0px' }}>
            {row.fields
              .filter(gf => !isHeader || firstRowFieldIds.has(gf.fieldId))
              .map((gf) => {
                const field = fieldMap.get(gf.fieldId);
                if (!field || field.isActive === false) return null;
                const innerSpan = getSpan(gf, device);
                const isSecondLine = !firstRowFieldIds.has(gf.fieldId);
                const content = getValue(gf.fieldId, isSecondLine);

                if (isHeader && field.showInHeader && firstRowFieldIds.has(gf.fieldId)) {
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
                  <div
                    key={gf.fieldId}
                    style={{ gridColumn: `span ${innerSpan}`, minWidth: 0 }}
                    className={`truncate ${isSecondLine ? 'text-muted-foreground text-xs' : ''}`}
                  >
                    {content}
                  </div>
                );
              })}
          </div>
        </div>
      );
    });
  };

  const header = (
    <div className="flex items-center gap-3 px-3 py-2 md:border-b bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none">
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

  const rows = items.map((item, index) => (
    <SwipeableRow
      key={item._id}
      onDelete={() => onDelete(item._id)}
      isPublicView={isPublicView}
      device={device}
    >
      <div
        className={`flex items-center gap-1 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/40 transition-colors ${index % 2 === 0 ? 'bg-muted' : 'bg-muted/50'}`}
        onClick={() => onItemClick(item._id)}
      >
        {!isPublicView && device === 'desktop' && (
          <div className="w-5 h-5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.includes(item._id)}
              onCheckedChange={() => onToggleSelect(item._id)}
            />
          </div>
        )}
        <div style={colGridStyle}>
          {renderColumns((fieldId, isSecondLine) => {
            const field = fieldMap.get(fieldId);
            if (!field) return null;
            return (
              <span
                className="text-sm"
                style={field.showAsBold ? { fontWeight: 600 } : undefined}
              >
                {renderCell(field, item.properties[fieldId], isSecondLine)}
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
    setOffset(Math.min(0, Math.max(-80, newOffset)));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setOffset(offset < -40 ? -80 : 0);
  };

  return (
    <div className="relative overflow-hidden">
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ViewCollection({ isPublicView = false, isWishlistView = false }: ViewCollectionProps) {
  const { username, collectionName } = useParams();
  const navigate = useNavigate();
  const device = useDevice();
  const storageId = isPublicView ? `public-${collectionName}` : collectionName ?? 'unknown';
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // ─── State ──────────────────────────────────────────────────────────────────

  const [collection, setCollection] = useState<Collection | null>(null);
  const [owner, setOwner] = useState<{ username: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Filters — restored from localStorage on mount
  const [filterParams, setFilterParams] = useState<Record<string, any>>(() => {
    const savedFilters = localStorage.getItem(`filters_${storageId}`);
    if (!savedFilters) return { page: 1, limit: 25 };

    const { search, values } = JSON.parse(savedFilters);
    const f: Record<string, any> = {};

    for (const [fieldId, value] of Object.entries(values || {})) {
      if (value === undefined || value === "" || value === null) continue;

      if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        const rangeValue = value as { min?: string; max?: string };
        if (rangeValue.min !== undefined && rangeValue.min !== "") f[`f[min_${fieldId}]`] = String(rangeValue.min);
        if (rangeValue.max !== undefined && rangeValue.max !== "") f[`f[max_${fieldId}]`] = String(rangeValue.max);
      } else if (Array.isArray(value)) {
        if (value.length > 0) f[`f[${fieldId}]`] = value;
      } else {
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

  // ── Keep a ref always pointing to latest filterParams so fetchData
  //    doesn't need it as a dependency (avoids re-render loops) ──
  const filterParamsRef = useRef(filterParams);
  useEffect(() => {
    filterParamsRef.current = filterParams;
  }, [filterParams]);

  // Bump this counter to imperatively trigger a refetch when filters change
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Wrap setFilterParams so every filter change also bumps the trigger
  const applyFilterParams = useCallback((params: Record<string, any>) => {
    setFilterParams(params);
    setFetchTrigger((v) => v + 1);
  }, []);

  // Pagination — restored from localStorage
  const [page, setPage] = useState(() => {
    const savedFilters = localStorage.getItem(`filters_${storageId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.page) return parsed.page;
    }
    return 1;
  });

  const [limit, setLimit] = useState(() => {
    const savedFilters = localStorage.getItem(`filters_${storageId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.itemsPerPage) return parsed.itemsPerPage;
    }
    return 25;
  });

  // Sort — restored from localStorage
  const [currentSortField, setCurrentSortField] = useState<string | null>(() => {
    return getSortFromStorage(storageId).fieldId;
  });

  const [currentSortDirection, setCurrentSortDirection] = useState<"asc" | "desc">(() => {
    return getSortFromStorage(storageId).direction;
  });

  // ─── Derived ────────────────────────────────────────────────────────────────

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

  // Stable fields reference for PDF modal — only recalculates when collection changes
  const pdfFields = useMemo(
    () => collection?.config.fields ?? [],
    [collection?._id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── View mode ──────────────────────────────────────────────────────────────

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(`viewMode_${storageId}`);
    if (saved === 'table' || saved === 'grid') return saved as ViewMode;
    return 'table';
  });

  useEffect(() => {
    localStorage.setItem(`viewMode_${storageId}`, viewMode);
  }, [viewMode, storageId]);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const collectionRef = useRef<Collection | null>(null);

  const fetchCollection = useCallback(async () => {
    try {
      setInitialLoading(true);
      const collectionUrl = isPublicView
        ? `/collections/${username}/${encodeURIComponent(collectionName || '')}`
        : `/collections/${collectionName}`;
      const collectionRes = await api.get(collectionUrl);

      if (!collectionRes.data) {
        console.error("Collection not found");
        return;
      }

      collectionRef.current = collectionRes.data;
      setCollection(collectionRes.data);

      if (isPublicView) {
        setOwner(collectionRes.data.owner ?? null);
      } else {
        const currentUsername = localStorage.getItem('username');
        setOwner(currentUsername ? { username: currentUsername } : null);
      }

      // Apply default sort if none is set yet
      if (!getSortFromStorage(storageId).fieldId && collectionRes.data.config?.defaultSort) {
        const { fieldId, direction } = collectionRes.data.config.defaultSort;
        setCurrentSortField(fieldId);
        setCurrentSortDirection(direction);
        saveSortToStorage(storageId, fieldId, direction);
      }
    } catch (err) {
      console.error("Failed to fetch collection", err);
    } finally {
      setInitialLoading(false);
    }
  }, [isPublicView, username, collectionName, storageId]);

  const fetchItems = useCallback(async () => {
    if (!collectionRef.current) return;
    try {
      setFetching(true);
      const itemsUrl = isWishlistView
        ? (isPublicView && username
            ? `/items/${username}/${collectionName}/wishlist`
            : `/items/${collectionName}/wishlist`)
        : (isPublicView && username
            ? `/items/${username}/${collectionName}`
            : `/items/${collectionName}`);

      const params: Record<string, any> = { ...filterParamsRef.current, page, limit };

      if (currentSortField) {
        params.sort = `${currentSortField}:${currentSortDirection}`;
      } else if (collectionRef.current.config?.defaultSort) {
        const { fieldId, direction } = collectionRef.current.config.defaultSort;
        params.sort = `${fieldId}:${direction}`;
      }

      const itemsRes = await api.get(itemsUrl, { params });
      setItems(itemsRes.data.items);
      setTotalItems(itemsRes.data.total);

      if (isPublicView && itemsRes.data.owner) {
        setOwner(itemsRes.data.owner);
      }
    } catch (err) {
      console.error("Failed to fetch items", err);
    } finally {
      setFetching(false);
    }
  }, [
    isPublicView, isWishlistView, username, collectionName,
    page, limit, fetchTrigger,
    currentSortField, currentSortDirection,
  ]);

  const fetchData = fetchItems;

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  useEffect(() => {
    if (!collection) return;
    fetchItems();
  }, [fetchItems, collection?._id]);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getGridAspectClass = () => {
    const orientation = (imageField as any)?.orientation;
    switch (orientation) {
      case 'portrait': return 'aspect-[3/4]';
      case 'square':   return 'aspect-square';
      default:         return 'aspect-[4/3]';  // landscape
    }
  };

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

  // ─── Event handlers ─────────────────────────────────────────────────────────

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    try {
      const raw = localStorage.getItem(`filters_${storageId}`);
      const existing = raw ? JSON.parse(raw) : {};
      existing.page = newPage;
      localStorage.setItem(`filters_${storageId}`, JSON.stringify(existing));
    } catch { /* ignore */ }
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    try {
      const raw = localStorage.getItem(`filters_${storageId}`);
      const existing = raw ? JSON.parse(raw) : {};
      existing.itemsPerPage = newLimit;
      existing.page = 1;
      localStorage.setItem(`filters_${storageId}`, JSON.stringify(existing));
    } catch { /* ignore */ }
  };

  const handleSort = (fieldId: string) => {
    const newDirection: "asc" | "desc" =
      currentSortField === fieldId && currentSortDirection === "asc" ? "desc" : "asc";
    setCurrentSortField(fieldId);
    setCurrentSortDirection(newDirection);
    saveSortToStorage(storageId, fieldId, newDirection);
  };

  const resetSortToDefault = () => {
    if (!collection?.config?.defaultSort) {
      setCurrentSortField(null);
      setCurrentSortDirection("asc");
      saveSortToStorage(storageId, null, "asc");
      return;
    }
    const { fieldId, direction } = collection.config.defaultSort;
    setCurrentSortField(fieldId);
    setCurrentSortDirection(direction);
    saveSortToStorage(storageId, fieldId, direction);
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
      navigate(`/${owner.username}/${collectionName}/items/${itemId}`);
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
      await api.delete(`/items/${collection.name}/${deletingItemId}`);
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

  // ─── Cell rendering ─────────────────────────────────────────────────────────

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

  const activeFiltersDescription = useMemo(() => {
    if (!collection) return "";
    const parts: string[] = [];

    for (const [key, value] of Object.entries(filterParams)) {
      if (key === "page" || key === "limit" || key === "sort" || !value) continue;

      const minMatch = key.match(/^f\[min_(.+)\]$/);
      const maxMatch = key.match(/^f\[max_(.+)\]$/);
      const fieldMatch = key.match(/^f\[(.+)\]$/);

      let fieldId: string | null = null;
      let prefix = "";

      if (minMatch) { fieldId = minMatch[1]; prefix = "min "; }
      else if (maxMatch) { fieldId = maxMatch[1]; prefix = "max "; }
      else if (fieldMatch) { fieldId = fieldMatch[1]; }
      else if (key === "search") {
        parts.push(`Search: "${value}"`);
        continue;
      }

      if (!fieldId) continue;

      const field = collection.config.fields.find((f) => f._id === fieldId);
      if (!field) continue;

      const fieldName = field.long || field.short;

      if (field.type === "dropdown") {
        const opts = field.options ?? field.dropdownOptions ?? [];
        const ids = Array.isArray(value) ? value : [value];
        const labels = ids.map((id) => {
          const opt = opts.find((o) => o._id === String(id));
          return opt ? (field.displayAs === "short" ? opt.short : opt.long) : String(id);
        });
        parts.push(`${fieldName}: ${labels.join(", ")}`);
      } else {
        const displayVal = Array.isArray(value) ? value.join(", ") : String(value);
        parts.push(`${prefix}${fieldName}: ${displayVal}`);
      }
    }

    return parts.join("  ·  ");
  }, [filterParams, collection]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const [key, value] of Object.entries(filterParams)) {
      if (key === 'page' || key === 'limit' || key === 'sort' || !value) continue;
      if (key === 'search' && value) { count++; continue; }
      if (key.startsWith('f[')) count++;
    }
    return count;
  }, [filterParams]);

  // ─── renderCell — accepts optional isSecondLine for LayoutView rows ──────────

  const renderCell = useCallback((field: FieldConfig, value: any, isSecondLine = false): React.ReactNode => {
    if (field.type === "date") {
      if (!value) return "";
      const date = new Date(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (field.type === "checkbox") {
      const text = field.displayAs === "short" ? field.short : field.long;
      return (
        <span className={`${value ? "font-semibold" : "text-checkbox-unchecked"}`}>{text}</span>
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
          <Image className={`h-5 w-5 ${hasImages ? (isSecondLine ? 'text-muted-foreground' : 'text-primary') : 'text-image-empty'}`} />
          {hasImages && <span className="text-xs text-muted-foreground">{value.length}</span>}
        </div>
      );
    }
    if (Array.isArray(value)) return value.join(", ");
    return value ?? "";
  }, [optionMaps]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {collection && collection.owner && (
        <FiltersPanel
          fields={collection.config.fields}
          onApply={applyFilterParams}
          onClearAll={resetSortToDefault}
          defaultLimit={limit}
          username={collection.owner.username}
          collectionId={collection._id}
          collectionName={collection.name}
          currentSort={currentSortField ? { fieldId: currentSortField, direction: currentSortDirection } : null}
          currentPage={page}
          itemsPerPage={limit}
          onPageReset={() => setPage(1)}
          isPublic={collection.isPublic}
          isPublicView={isPublicView}
          isOpen={filterPanelOpen}
          onClose={() => setFilterPanelOpen(false)}
        />
      )}
      <Card className="border-0 shadow-none md:border md:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="relative gap-2"
              onClick={() => setFilterPanelOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {hasImageField && (
              <ViewToggle value={viewMode} onChange={setViewMode} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPublicView && (
              <>
                <Button onClick={() => navigate(`/collections/${collection?.name}/add-item`)}>
                  Add Item
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowImport(true)}>
                      <Upload className="h-4 w-4 mr-2" /> Import CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPdfModalOpen(true)}>
                      <FileDown className="h-4 w-4 mr-2" /> Export PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/collections/${collection?.name}/wishlist`)}>
                      <Heart className="h-4 w-4 mr-2" /> Wishlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/collections/${collection?.name}/stats`)}>
                      <BarChart3 className="h-4 w-4 mr-2" /> Stats
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/collections/${collection?.name}/edit`)}>
                      <Settings className="h-4 w-4 mr-2" /> Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 md:px-6">
          {(initialLoading || fetching) ? (
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
                                className={f.showInHeader ? "cursor-pointer hover:bg-muted select-none" : ""}
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
                        {items.map((item, index) => (
                          <SwipeableRow
                            key={item._id}
                            onDelete={() => handleSwipeDelete(item._id)}
                            isPublicView={isPublicView}
                            device={device}
                          >
                            <TableRow
                              onClick={() => handleItemClick(item._id)}
                              className={`cursor-pointer hover:bg-muted ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
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
                        <div className={`w-full ${getGridAspectClass()} bg-muted relative overflow-hidden`}>
                          {mainImage ? (
                            <img
                              src={`${BACKEND_URL}${mainImage.thumbnailUrl}`}
                              alt={displayValue}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="h-20 w-20 text-image-placeholder" />
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
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {collection && (
            <ImportCSV
              collectionName={collection.name}
              collectionId={collection._id}
              fields={collection.config.fields.filter((f) => f.isActive !== false)}
              onClose={() => setShowImport(false)}
              onComplete={() => { setShowImport(false); fetchData(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {collection && (
        <PrintToPDFModal
          open={pdfModalOpen}
          onOpenChange={setPdfModalOpen}
          collectionName={collection.name}
          filterParams={filterParams}
          currentSort={currentSortField ? { fieldId: currentSortField, direction: currentSortDirection } : null}
          totalItems={totalItems}
          isPublicView={isPublicView}
          ownerUsername={username}
          fields={pdfFields}
          renderCell={renderCell}
          activeFiltersDescription={activeFiltersDescription}
        />
      )}
    </div>
  );
}