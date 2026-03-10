// src/components/collection-viewer.tsx (NEW FILE)
// This component is used by BOTH private and public pages

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination";
import { Image } from "lucide-react";

type FieldConfig = {
  _id: string;
  short: string;
  long: string;
  type: string;
  isActive: boolean;
  showInHeader: boolean;
  showAsBold: boolean;
  useInGrid: boolean;
  displayAs: "long" | "short";
  options?: { _id: string; short: string; long: string }[];
};

type Item = {
  _id: string;
  properties: Record<string, any>;
};

type CollectionViewerProps = {
  collectionName: string;
  fields: FieldConfig[];
  items: Item[];
  totalItems: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
  onItemClick?: (itemId: string) => void;
  onSort?: (fieldId: string) => void;
  currentSortField?: string | null;
  currentSortDirection?: "asc" | "desc";
  showActions?: boolean; // For edit/delete buttons
  headerActions?: React.ReactNode; // Custom header buttons
};

export default function CollectionViewer({
  collectionName,
  fields,
  items,
  totalItems,
  page,
  limit,
  onPageChange,
  onItemsPerPageChange,
  onItemClick,
  onSort,
  currentSortField,
  currentSortDirection,
  headerActions,
}: CollectionViewerProps) {
  
  const renderSortIcon = (fieldId: string) => {
    if (currentSortField !== fieldId) return null;
    return currentSortDirection === "asc" ? " ▲" : " ▼";
  };

  const renderCell = (field: FieldConfig, value: any) => {
    if (field.type === "checkbox") {
      const text = field.displayAs === "short" ? field.short : field.long;
      return (
        <span className={value ? "font-semibold" : "text-muted-foreground"}>
          {text}
        </span>
      );
    }

    if (field.type === "dropdown") {
      const opts = field.options;
      const opt = opts?.find((o: any) => o._id === value);
      return opt ? (field.displayAs === "short" ? opt.short : opt.long) : "";
    }

    if (field.type === "image") {
      const hasImages = value && Array.isArray(value) && value.length > 0;
      return (
        <div className="flex items-center gap-2">
          <Image 
            className={`h-5 w-5 ${hasImages ? 'text-primary' : 'text-muted-foreground'}`}
          />
          {hasImages && (
            <span className="text-xs text-muted-foreground">
              {value.length}
            </span>
          )}
        </div>
      );
    }

    if (Array.isArray(value)) return value.join(", ");
    return value ?? "";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{collectionName}</CardTitle>
        {headerActions && <div className="flex gap-2">{headerActions}</div>}
      </CardHeader>
      <CardContent>
        <Pagination
          currentPage={page}
          totalItems={totalItems}
          itemsPerPage={limit}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
        />
        
        <Table>
          <TableHeader>
            <TableRow>
              {fields
                .filter((f) => f.isActive !== false && f.useInGrid !== false)
                .map(f => (
                  <TableHead
                    key={f._id}
                    onClick={() => f.showInHeader && onSort ? onSort(f._id) : null}
                    className={f.showInHeader && onSort ? "cursor-pointer hover:bg-muted select-none" : ""}
                  >
                    {f.showInHeader ? (
                      <>
                        {f.long}
                        {renderSortIcon(f._id)}
                      </>
                    ) : ""}
                  </TableHead>
                ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow
                key={item._id}
                onClick={() => onItemClick?.(item._id)}
                className={onItemClick ? "cursor-pointer hover:bg-muted" : ""}
              >
                {fields
                  .filter((f) => f.isActive !== false && f.useInGrid !== false)
                  .map(f => (
                    <TableCell 
                      key={f._id} 
                      style={f.showAsBold ? { fontWeight: "bold" } : {}}
                    >
                      {renderCell(f, item.properties[f._id])}
                    </TableCell>
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Pagination
          currentPage={page}
          totalItems={totalItems}
          itemsPerPage={limit}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      </CardContent>
    </Card>
  );
}