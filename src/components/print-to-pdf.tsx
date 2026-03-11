import { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2 } from "lucide-react";
import api from "@/lib/api";

// ─── Brand colors ────────────────────────────────────────────────────────────
// Mirror your Tailwind/CSS brand colors here as RGB triples for jsPDF.
// Update these if your brand color changes.
const BRAND  = [38,  82,  57]  as const;

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
  properties: Record<string, unknown>;
}

interface PrintToPDFModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionName: string;
  filterParams?: Record<string, unknown>;
  currentSort?: { fieldId: string; direction: "asc" | "desc" } | null;
  isPublicView?: boolean;
  ownerUsername?: string;
  // Pass collection fields directly — same shape as ViewCollection uses
  fields: FieldConfig[];
  // Pass ViewCollection's renderCell so rendering is identical
  renderCell: (field: FieldConfig, value: unknown) => React.ReactNode;
  activeFiltersDescription?: string;
  totalItems: number;
}

// ─── Helper: ReactNode → plain string for jsPDF ───────────────────────────────
// renderCell returns ReactNode (JSX). We need a plain string for the PDF table.
// This walks the React element tree and extracts all text content.

function reactNodeToString(node: React.ReactNode): string {
  if (node === null || node === undefined || node === false) return "—";
  if (typeof node === "string") return node || "—";
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToString).join("");

  // React element — recurse into children
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
    if (props?.children !== undefined) {
      return reactNodeToString(props.children) || "—";
    }
  }

  return "—";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PrintToPDFModal({
  open,
  onOpenChange,
  collectionName,
  filterParams,
  currentSort,
  isPublicView = false,
  ownerUsername,
  fields,
  renderCell,
  activeFiltersDescription,
  totalItems,
}: PrintToPDFModalProps) {
  const [title, setTitle] = useState(collectionName);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset title when collection changes, and clear error when modal opens
  useEffect(() => {
    if (open) {
      setTitle(collectionName);
      setError(null);
    }
  }, [open, collectionName]);

  // Mirror exactly what ViewCollection shows in its table
  const tableFields = fields.filter(
    (f) => f.isActive !== false && f.useInGrid !== false && f.type !== "image"
  );

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      // ── Fetch ALL filtered items (no pagination) ──
      const itemsUrl =
        isPublicView && ownerUsername
          ? `/items/${ownerUsername}/${collectionName}`
          : `/items/${collectionName}`;

      const { page: _page, limit: _limit, ...filterOnly } = (filterParams ?? {}) as Record<string, unknown>;

      const response = await api.get(itemsUrl, {
        params: {
          ...filterOnly,
          limit: 10000,
          page: 1,
          ...(currentSort ? { sort: `${currentSort.fieldId}:${currentSort.direction}` } : {}),
        },
      });

      const allItems: Item[] = response.data.items ?? [];

      // ── Build PDF ──
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      let cursorY = margin;

      // Brand accent bar
      doc.setFillColor(...BRAND);
      doc.rect(0, 0, pageW, 2.5, "F");
      cursorY = 10;

// Logo — render SVG to a small canvas, then add as image
      const logoSvg = `<svg width="174" height="32" viewBox="0 0 174 32" xmlns="http://www.w3.org/2000/svg">
        <g fill="#00421c">
          <path d="m 12.348255,30.637608 c 2.976562,0 5.171777,-1.302246 6.895703,-3.001367 l -1.810742,-2.530078 c -1.376661,1.364258 -3.137793,2.38125 -5.18418,2.38125 -3.5842773,0 -7.0941406,-3.112988 -7.0941406,-7.14375 0,-4.005957 3.4602539,-7.180957 7.0817386,-7.180957 1.95957,0 3.782714,0.930176 5.184179,2.331641 l 1.823145,-2.468067 c -1.959571,-1.90996 -4.353223,-3.013769 -6.945313,-3.050976 -5.6182613,0 -10.3187495,4.725293 -10.3187495,10.355957 0,5.643066 4.7004882,10.306347 10.3683595,10.306347 z m 17.896582,0 c 5.692676,0 10.355957,-4.638476 10.355957,-10.293945 0,-5.705078 -4.663281,-10.368359 -10.343555,-10.368359 -5.692675,0 -10.331152,4.663281 -10.331152,10.368359 0,5.655469 4.638477,10.293945 10.31875,10.293945 z m 0,-3.175 c -3.943945,0 -7.156152,-3.212207 -7.156152,-7.14375 0,-3.956347 3.212207,-7.180956 7.156152,-7.180956 3.943945,0 7.180957,3.224609 7.180957,7.180956 0,3.931543 -3.237012,7.14375 -7.180957,7.14375 z M 46.615931,27.189757 V 10.32257 h -3.137793 v 19.992577 h 12.055078 v -3.12539 z m 14.560353,0 V 10.32257 h -3.137793 v 19.992577 h 12.055078 v -3.12539 z M 84.505089,13.410753 V 10.32257 h -11.90625 v 19.992577 h 11.90625 v -3.12539 h -8.768457 v -5.531445 h 7.56543 v -3.125391 h -7.56543 v -5.122168 z m 12.675197,17.226855 c 2.976564,0 5.171774,-1.302246 6.895704,-3.001367 l -1.81074,-2.530078 c -1.37666,1.364258 -3.137796,2.38125 -5.184183,2.38125 -3.584277,0 -7.09414,-3.112988 -7.09414,-7.14375 0,-4.005957 3.460254,-7.180957 7.081738,-7.180957 1.95957,0 3.782715,0.930176 5.184175,2.331641 l 1.82315,-2.468067 c -1.95957,-1.90996 -4.353224,-3.013769 -6.945313,-3.050976 -5.618262,0 -10.31875,4.725293 -10.31875,10.355957 0,5.643066 4.700488,10.306347 10.368359,10.306347 z M 119.09523,10.32257 h -13.86582 v 3.112988 h 5.35781 v 16.879589 h 3.1502 V 13.435558 h 5.35781 z m 10.86445,20.315038 c 5.69267,0 10.35596,-4.638476 10.35596,-10.293945 0,-5.705078 -4.66329,-10.368359 -10.34356,-10.368359 -5.69267,0 -10.33115,4.663281 -10.33115,10.368359 0,5.655469 4.63848,10.293945 10.31875,10.293945 z m 0,-3.175 c -3.94395,0 -7.15615,-3.212207 -7.15615,-7.14375 0,-3.956347 3.2122,-7.180956 7.15615,-7.180956 3.94394,0 7.18096,3.224609 7.18096,7.180956 0,3.931543 -3.23702,7.14375 -7.18096,7.14375 z m 28.0789,2.852539 -5.8167,-7.999511 c 2.29444,-0.744141 3.95635,-2.988965 3.95635,-5.568652 0,-3.559473 -3.05097,-6.424414 -6.77168,-6.424414 h -6.21357 l 0.0124,19.992577 h 3.13779 v -7.739062 h 2.45567 l 5.38261,7.739062 z M 146.33077,19.971593 v -6.536035 h 3.1502 c 1.86035,0 3.46025,1.37666 3.46025,3.237011 0,1.785938 -1.5751,3.311426 -3.46025,3.299024 z m 16.58194,10.343554 h 3.11299 v -8.545214 l 6.63525,-11.447363 h -3.53466 l -4.66329,7.962304 -4.65087,-7.962304 h -3.53467 l 6.63525,11.447363 z" />
          <path d="M 7.0138048,1.922205 H 1.9026999 V 3.0696892 H 3.8776528 V 9.2917051 H 5.0388519 V 3.0696892 h 1.9749529 z m 5.2619692,0 V 5.0309272 H 9.0847622 V 1.922205 H 7.9327064 V 9.2917051 H 9.0847622 V 6.1784114 h 3.1910118 v 3.1132937 h 1.156628 V 1.922205 Z m 6.962623,1.1383409 V 1.922205 h -4.388784 v 7.3695001 h 4.388784 V 8.1396493 H 16.00624 v -2.038956 h 2.788707 V 4.9486375 H 16.00624 V 3.0605459 Z" />
        </g>
      </svg>`;

      const logoDataUrl = await new Promise<string>((resolve) => {
        const blob = new Blob([logoSvg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          // Render at 3x for crispness
          canvas.width = 174 * 3;
          canvas.height = 32 * 3;
          const ctx = canvas.getContext("2d")!;
          ctx.scale(3, 3);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.src = url;
      });

      // Logo: ~40mm wide, ~7.5mm tall (proportional to 174:32)
      const logoW = 40;
      const logoH = (32 / 174) * logoW;
      doc.addImage(logoDataUrl, "PNG", margin, cursorY, logoW, logoH);
      cursorY += logoH + 5;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(30, 30, 30);
      doc.text(title || collectionName, margin, cursorY + 6);
      cursorY += 14;

      // Metadata line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);

      const dateStr = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(
        `${allItems.length} item${allItems.length !== 1 ? "s" : ""}  ·  Exported ${dateStr}`,
        margin,
        cursorY
      );

      if (activeFiltersDescription) {
        cursorY += 5;
        doc.setFontSize(8);
        doc.setTextColor(...BRAND);
        doc.text(`Filters: ${activeFiltersDescription}`, margin, cursorY);
      }

      cursorY += 6;

      // ── Table — use renderCell for every value, same as ViewCollection ──
      const columns = tableFields.map((f) => ({
        header: f.long || f.short,
        dataKey: f._id,
      }));

      // Also track raw checkbox booleans so we can dim false values in didParseCell
      const checkboxValues: boolean[][] = [];

      const rows = allItems.map((item, rowIdx) => {
        const row: Record<string, string> = {};
        checkboxValues[rowIdx] = [];
        tableFields.forEach((f, colIdx) => {
          const rendered = renderCell(f, item.properties[f._id]);
          row[f._id] = reactNodeToString(rendered);
          if (f.type === "checkbox") {
            checkboxValues[rowIdx][colIdx] = !!item.properties[f._id];
          }
        });
        return row;
      });

      // Track pages drawn so we can add footers in a second pass
      const drawnPages: number[] = [];

      autoTable(doc, {
        startY: cursorY,
        columns,
        body: rows,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 9,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [...BRAND],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 255],
        },
        didParseCell: (data) => {
          if (data.section === "body") {
            const field = tableFields[data.column.index];
            if (field?.showAsBold) {
              data.cell.styles.fontStyle = "bold";
            }
            // Dim checkbox cells where value is false
            if (field?.type === "checkbox") {
              const isChecked = checkboxValues[data.row.index]?.[data.column.index];
              if (!isChecked) {
                data.cell.styles.textColor = [220, 220, 220];
              }
            }
          }
        },
        didDrawPage: (data) => {
          drawnPages.push(data.pageNumber);
        },
      });

      // Second pass: footers now that total page count is known
      const totalPages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } })
        .internal.getNumberOfPages();

      for (const pageNumber of drawnPages) {
        doc.setPage(pageNumber);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `theCollectory.eu  ·  ${title || collectionName}  ·  Page ${pageNumber} of ${totalPages}`,
          pageW / 2,
          pageH - 6,
          { align: "center" }
        );
      }

      const safeTitle = (title || collectionName)
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      doc.save(`${safeTitle}_export.pdf`);

      onOpenChange(false);
    } catch (err) {
      console.error("PDF export failed:", err);
      setError("Failed to fetch items. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-brand" />
            Export to PDF
          </DialogTitle>
          <DialogDescription>
            Export the current filtered list as a PDF document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-title">Document title</Label>
            <Input
              id="pdf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={collectionName}
            />
            <p className="text-xs text-muted-foreground">
              This will appear as the heading on the printed PDF.
            </p>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-medium">Export summary</p>
            <p className="text-muted-foreground">
              {totalItems} item{totalItems !== 1 ? "s" : ""} ·{" "}
              {tableFields.length} column{tableFields.length !== 1 ? "s" : ""}
            </p>
            {activeFiltersDescription && (
              <p className="text-muted-foreground text-xs">
                <span className="text-brand font-medium">Active filters:</span>{" "}
                {activeFiltersDescription}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || totalItems === 0}
            className="gap-2 mb-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching {totalItems} items…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}