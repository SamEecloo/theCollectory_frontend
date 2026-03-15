import { useState, useCallback, useRef } from "react";
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  AlertCircle,
  Loader2,
  SkipForward,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldConfig {
  isActive: boolean;
  _id: string;
  short: string;
  long: string;
  type: string;
  required?: boolean;
  showInHeader?: boolean;
  showAsBold?: boolean;
  useInGrid?: boolean;
  displayAs?: "long" | "short";
  options?: { _id: string; short: string; long: string }[];
  dropdownOptions?: { _id: string; short: string; long: string }[];
}

type DropdownMatchKey = "long" | "short";

interface ColumnMapping {
  csvColumn: string;
  fieldId: string | "skip";
  // Only relevant when the mapped field is a dropdown
  dropdownMatchKey?: DropdownMatchKey;
}

export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

// ─── Steps ───────────────────────────────────────────────────────────────────

// Internal step indices (resolve step may be skipped in navigation)
const STEP_UPLOAD   = 0;
const STEP_MAP      = 1;
const STEP_RESOLVE  = 2;
const STEP_PREVIEW  = 3;
const STEP_IMPORT   = 4;

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim()); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(
  text: string,
  firstRowIsHeader: boolean
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  let headers: string[];
  let dataLines: string[];

  if (firstRowIsHeader) {
    headers = parseRow(lines[0]);
    dataLines = lines.slice(1);
  } else {
    const colCount = parseRow(lines[0]).length;
    headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
    dataLines = lines;
  }

  const rows = dataLines.map((line) => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });

  return { headers, rows };
}

function autoMap(csvHeaders: string[], fields: FieldConfig[]): ColumnMapping[] {
  return csvHeaders.map((col) => {
    const match = fields.find(
      (f) =>
        f.long.toLowerCase() === col.toLowerCase() ||
        f.short.toLowerCase() === col.toLowerCase()
    );
    return {
      csvColumn: col,
      fieldId: match ? match._id : "skip",
      dropdownMatchKey: "long",
    };
  });
}

// ─── Value coercion ───────────────────────────────────────────────────────────

function resolveDropdownValue(
  field: FieldConfig,
  raw: string,
  matchKey: DropdownMatchKey
): string {
  const opts = field.options ?? field.dropdownOptions ?? [];
  if (!raw) return raw;
  const normalised = raw.trim().toLowerCase();
  const match =
    opts.find((o) => o[matchKey].toLowerCase() === normalised) ??
    opts.find((o) => (matchKey === "long" ? o.short : o.long).toLowerCase() === normalised) ??
    opts.find((o) => o._id === raw.trim());
  return match ? match._id : raw;
}

function coerceValue(field: FieldConfig, raw: string, matchKey: DropdownMatchKey): unknown {
  if (field.type === "checkbox") return ["true", "yes", "1", "x"].includes(raw.toLowerCase());
  if (field.type === "number") return raw === "" ? null : Number(raw);
  if (field.type === "tags") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  if (field.type === "dropdown") return resolveDropdownValue(field, raw, matchKey);
  return raw;
}

function isUnresolvedDropdown(field: FieldConfig, raw: string, matchKey: DropdownMatchKey): boolean {
  if (field.type !== "dropdown" || !raw) return false;
  const opts = field.options ?? field.dropdownOptions ?? [];
  const normalised = raw.trim().toLowerCase();
  return !(
    opts.find((o) => o[matchKey].toLowerCase() === normalised) ??
    opts.find((o) => (matchKey === "long" ? o.short : o.long).toLowerCase() === normalised) ??
    opts.find((o) => o._id === raw.trim())
  );
}

// Returns a map of fieldId → sorted list of unique unresolved values
function getUnresolvedByField(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
  fields: FieldConfig[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const m of mappings) {
    if (m.fieldId === "skip") continue;
    const field = fields.find((f) => f._id === m.fieldId);
    if (!field || field.type !== "dropdown") continue;
    const unknownValues = new Set<string>();
    for (const row of rows) {
      const raw = row[m.csvColumn]?.trim();
      if (raw && isUnresolvedDropdown(field, raw, m.dropdownMatchKey ?? "long")) {
        unknownValues.add(raw);
      }
    }
    if (unknownValues.size > 0) {
      result.set(field._id, Array.from(unknownValues).sort());
    }
  }
  return result;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, hasResolveStep }: { current: number; hasResolveStep: boolean }) {
  const labels = hasResolveStep
    ? ["Upload CSV", "Map Columns", "New Options", "Preview", "Import"]
    : ["Upload CSV", "Map Columns", "Preview", "Import"];

  // Map internal step to display index
  const displayIndex = hasResolveStep
    ? current
    : current >= STEP_PREVIEW ? current - 1 : current;

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < displayIndex
                  ? "bg-primary text-primary-foreground"
                  : i === displayIndex
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < displayIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block ${i === displayIndex ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`h-px w-8 sm:w-16 mb-4 transition-colors ${i < displayIndex ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

function UploadStep({
  onParsed,
}: {
  onParsed: (headers: string[], rows: Record<string, string>[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [rawText, setRawText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = (text: string, isHeader: boolean) => {
    const { headers, rows } = parseCSV(text, isHeader);
    if (headers.length === 0) { setError("CSV appears to be empty."); return; }
    if (rows.length === 0) { setError("CSV has no data rows."); return; }
    setError(null);
    onParsed(headers, rows);
  };

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith(".csv")) { setError("Please upload a .csv file."); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawText(text);
      process(text, firstRowIsHeader);
    };
    reader.readAsText(file);
  };

  const handleHeaderToggle = (checked: boolean) => {
    setFirstRowIsHeader(checked);
    if (rawText) process(rawText, checked);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [firstRowIsHeader, rawText]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-md border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
        }`}
      >
        <Upload className={`w-10 h-10 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
        {fileName ? (
          <p className="text-sm font-medium text-primary">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
            <p className="text-xs text-muted-foreground">Supports comma-separated .csv files</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border px-4 py-3 w-full max-w-md">
        <Switch id="header-toggle" checked={firstRowIsHeader} onCheckedChange={handleHeaderToggle} />
        <div>
          <Label htmlFor="header-toggle" className="text-sm font-medium cursor-pointer">
            First row is a header
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {firstRowIsHeader
              ? "Row 1 will be used as column names for mapping."
              : "Row 1 is data. Columns will be named Column 1, Column 2, …"}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Step 2: Map Columns ──────────────────────────────────────────────────────

function MapStep({
  previewRows,
  fields,
  mappings,
  onChange,
}: {
  previewRows: Record<string, string>[];
  fields: FieldConfig[];
  mappings: ColumnMapping[];
  onChange: (mappings: ColumnMapping[]) => void;
}) {
  const usedFieldIds = mappings.filter((m) => m.fieldId !== "skip").map((m) => m.fieldId);

  const setFieldId = (csvColumn: string, fieldId: string) => {
    onChange(
      mappings.map((m) =>
        m.csvColumn === csvColumn
          ? { ...m, fieldId, dropdownMatchKey: "long" }
          : m
      )
    );
  };

  const setDropdownMatchKey = (csvColumn: string, key: DropdownMatchKey) => {
    onChange(mappings.map((m) => (m.csvColumn === csvColumn ? { ...m, dropdownMatchKey: key } : m)));
  };

  const unmappedRequired = fields.filter((f) => f.required && !usedFieldIds.includes(f._id));

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {unmappedRequired.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Required fields not yet mapped:{" "}
            {unmappedRequired.map((f) => (
              <Badge key={f._id} variant="destructive" className="mr-1">{f.long}</Badge>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Map each CSV column to a field in your collection. Columns you don't need can be set to{" "}
        <strong>Skip</strong>.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>CSV Column</span>
          <span />
          <span>Collection Field</span>
        </div>

        <div className="overflow-y-auto max-h-[420px]">
          {mappings.map((m, idx) => {
            const preview = previewRows[0]?.[m.csvColumn] ?? "";
            const mappedField = fields.find((f) => f._id === m.fieldId);
            const isDropdown = mappedField?.type === "dropdown";

            return (
              <div
                key={m.csvColumn}
                className={`px-4 py-3 border-b last:border-b-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
              >
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{m.csvColumn}</p>
                    {preview && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">e.g. {preview}</p>
                    )}
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

                  <Select value={m.fieldId} onValueChange={(val) => setFieldId(m.csvColumn, val)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select field…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <SkipForward className="w-3.5 h-3.5" /> Skip
                        </span>
                      </SelectItem>
                      {fields.map((f) => (
                        <SelectItem
                          key={f._id}
                          value={f._id}
                          disabled={usedFieldIds.includes(f._id) && m.fieldId !== f._id}
                        >
                          <span className="flex items-center gap-2">
                            {f.long}
                            <Badge variant="outline" className="text-xs capitalize">{f.type}</Badge>
                            {f.required && <Badge variant="secondary" className="text-xs">required</Badge>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isDropdown && (
                  <div className="mt-2 ml-auto flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span className={m.dropdownMatchKey !== "short" ? "text-foreground font-medium" : ""}>
                      Long
                    </span>
                    <Switch
                      checked={m.dropdownMatchKey === "short"}
                      onCheckedChange={(checked) =>
                        setDropdownMatchKey(m.csvColumn, checked ? "short" : "long")
                      }
                      className="scale-75"
                    />
                    <span className={m.dropdownMatchKey === "short" ? "text-foreground font-medium" : ""}>
                      Short
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Resolve New Dropdown Options ─────────────────────────────────────

function ResolveStep({
  unresolvedByField,
  fields,
  collectionName,
  onResolved,
}: {
  unresolvedByField: Map<string, string[]>;
  fields: FieldConfig[];
  collectionName: string;
  onResolved: (updatedFields: FieldConfig[]) => void;
}) {
  // selected: fieldId → Set of values to add
  const [selected, setSelected] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    for (const [fieldId, values] of unresolvedByField) {
      m.set(fieldId, new Set(values)); // all checked by default
    }
    return m;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (fieldId: string, value: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(fieldId) ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next.set(fieldId, set);
      return next;
    });
  };

  const toggleAll = (fieldId: string, values: string[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const set = next.get(fieldId) ?? new Set<string>();
      const allChecked = values.every((v) => set.has(v));
      next.set(fieldId, allChecked ? new Set() : new Set(values));
      return next;
    });
  };

  const totalSelected = Array.from(selected.values()).reduce((acc, s) => acc + s.size, 0);

  const handleAdd = async () => {
    if (totalSelected === 0) {
      onResolved(fields);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch current collection to get full config
      const res = await api.get(`/collections/${collectionName}`);
      const collection = res.data;

      const configFields: FieldConfig[] = collection.config?.fields ?? [];

      const updatedConfigFields = configFields.map((field: FieldConfig) => {
        const toAdd = selected.get(field._id);
        if (!toAdd || toAdd.size === 0) return field;
        const existingOpts = field.options ?? field.dropdownOptions ?? [];
        // No _id — Mongoose will auto-generate valid ObjectIds for new subdocuments
        const newOpts = Array.from(toAdd).map((val) => ({ short: val, long: val }));
        // Preserve whichever key the field already uses
        if (field.dropdownOptions !== undefined) {
          return { ...field, dropdownOptions: [...existingOpts, ...newOpts] };
        }
        return { ...field, options: [...existingOpts, ...newOpts] };
      });

      // Only send what updateCollection actually reads
      await api.put(`/collections/${collectionName}`, {
        name: collection.name,
        isPublic: collection.isPublic,
        isActive: collection.isActive,
        config: { ...collection.config, fields: updatedConfigFields },
      });

      // Re-fetch so we get Mongoose-generated _id values on the new options
      const refreshed = await api.get(`/collections/${collectionName}`);
      const refreshedFields: FieldConfig[] = refreshed.data?.config?.fields ?? updatedConfigFields;

      // Merge the refreshed fields (with real _ids) into localFields for the import step
      const mergedFields = fields.map((f) => {
        const updated = refreshedFields.find((u) => u._id === f._id);
        return updated ?? f;
      });

      onResolved(mergedFields);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(
        err.response?.data?.error ??
        err.response?.data?.message ??
        "Failed to update dropdown options"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The following values from your CSV aren't in the dropdown options yet. Select the ones you'd
        like to add — unselected values will still be imported as raw text.
      </p>

      {Array.from(unresolvedByField.entries()).map(([fieldId, values]) => {
        const field = fields.find((f) => f._id === fieldId);
        if (!field) return null;
        const fieldSelected = selected.get(fieldId) ?? new Set<string>();
        const allChecked = values.every((v) => fieldSelected.has(v));

        return (
          <div key={fieldId} className="rounded-lg border overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-2.5 bg-muted/50 border-b cursor-pointer">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() => toggleAll(fieldId, values)}
                className="h-4 w-4 rounded"
              />
              <span className="font-medium text-sm">{field.long}</span>
              <Badge variant="outline" className="text-xs">dropdown</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {fieldSelected.size}/{values.length} selected
              </span>
            </label>
            <div className="divide-y">
              {values.map((val) => (
                <label
                  key={val}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={fieldSelected.has(val)}
                    onChange={() => toggle(fieldId, val)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">{val}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleAdd} disabled={loading} className="self-start">
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        {totalSelected > 0
          ? `Add ${totalSelected} option${totalSelected !== 1 ? "s" : ""} & continue`
          : "Skip & continue"}
      </Button>
    </div>
  );
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────

function PreviewStep({
  rows,
  mappings,
  fields,
}: {
  rows: Record<string, string>[];
  mappings: ColumnMapping[];
  fields: FieldConfig[];
}) {
  const activeMappings = mappings.filter((m) => m.fieldId !== "skip");
  const PREVIEW_COUNT = Math.min(rows.length, 5);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Showing first {PREVIEW_COUNT} of {rows.length} rows. Columns set to <em>Skip</em> are excluded.
      </p>

      <div className="overflow-y-auto rounded-lg border max-h-[400px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">#</th>
              {activeMappings.map((m) => {
                const field = fields.find((f) => f._id === m.fieldId);
                return (
                  <th key={m.csvColumn} className="px-3 py-2 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {field?.long ?? m.csvColumn}
                    {field?.type === "dropdown" && (
                      <span className="ml-1 font-normal opacity-60">({m.dropdownMatchKey})</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_COUNT).map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                {activeMappings.map((m) => {
                  const field = fields.find((f) => f._id === m.fieldId);
                  const raw = row[m.csvColumn] ?? "";
                  const isWarning =
                    field
                      ? isUnresolvedDropdown(field, raw, m.dropdownMatchKey ?? "long")
                      : false;
                  return (
                    <td
                      key={m.csvColumn}
                      className={`px-3 py-2 max-w-[220px] truncate ${isWarning ? "text-yellow-600" : ""}`}
                      title={isWarning ? `"${raw}" doesn't match any dropdown option` : undefined}
                    >
                      {raw || <span className="text-muted-foreground/50 italic">empty</span>}
                      {isWarning && " ⚠"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="w-4 h-4" />
        <span>
          <strong className="text-foreground">{rows.length}</strong> rows will be imported across{" "}
          <strong className="text-foreground">{activeMappings.length}</strong> fields
        </span>
      </div>
    </div>
  );
}

// ─── Step 5: Import ───────────────────────────────────────────────────────────

function ImportStep({
  rows,
  mappings,
  fields,
  collectionName,
  onDone,
}: {
  rows: Record<string, string>[];
  mappings: ColumnMapping[];
  fields: FieldConfig[];
  collectionName: string;
  collectionId: string;
  onDone: (result: ImportResult) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const activeMappings = mappings.filter((m) => m.fieldId !== "skip");

  const runImport = async () => {
    setStatus("running");
    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const properties: Record<string, unknown> = {};

      activeMappings.forEach((m) => {
        const field = fields.find((f) => f._id === m.fieldId);
        if (!field) return;
        properties[m.fieldId] = coerceValue(field, row[m.csvColumn] ?? "", m.dropdownMatchKey ?? "long");
      });

      try {
        await api.post(`/items/${collectionName}`, { properties });
        imported++;
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Unknown error";
        errors.push({ row: i + 1, message: msg });
      }

      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    const res: ImportResult = { total: rows.length, imported, failed: errors.length, errors };
    setResult(res);
    setStatus("done");
    onDone(res);
  };

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="text-center">
          <p className="text-lg font-semibold">Ready to import</p>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} items will be added to your collection.
          </p>
        </div>
        <Button size="lg" onClick={runImport}>
          <Upload className="w-4 h-4 mr-2" /> Start Import
        </Button>
      </div>
    );
  }

  if (status === "running") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 w-full max-w-md mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Importing… {progress}%</p>
        <Progress value={progress} className="w-full" />
        <p className="text-xs text-muted-foreground">Please don't close this window.</p>
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 w-full max-w-md mx-auto">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${result.failed === 0 ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"}`}>
          {result.failed === 0 ? <Check className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">
            {result.failed === 0 ? "Import complete!" : "Import finished with errors"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {result.imported} of {result.total} items imported successfully.
            {result.failed > 0 && ` ${result.failed} failed.`}
          </p>
        </div>
        {result.errors.length > 0 && (
          <div className="w-full overflow-y-auto max-h-40 rounded-lg border p-3 text-xs font-mono text-destructive bg-destructive/5">
            {result.errors.map((e, i) => (
              <div key={i}>Row {e.row}: {e.message}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ImportCSVProps {
  collectionName: string;
  collectionId: string;
  fields: FieldConfig[];
  onClose: () => void;
  onComplete?: (result: ImportResult) => void;
}

export default function ImportCSV({ collectionName, collectionId, fields, onClose, onComplete }: ImportCSVProps) {
  const [step, setStep] = useState(STEP_UPLOAD);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  // localFields may be updated after the resolve step adds new dropdown options
  const [localFields, setLocalFields] = useState<FieldConfig[]>(fields);
  const [unresolvedByField, setUnresolvedByField] = useState<Map<string, string[]>>(new Map());
  const [hasResolveStep, setHasResolveStep] = useState(false);

  const handleParsed = (headers: string[], rows: Record<string, string>[]) => {
    setCsvRows(rows);
    const mapped = autoMap(headers, localFields);
    setMappings(mapped);
    setStep(STEP_MAP);
  };

  // Called when user clicks Continue on the Map step
  const handleMapContinue = () => {
    const unresolved = getUnresolvedByField(csvRows, mappings, localFields);
    if (unresolved.size > 0) {
      setUnresolvedByField(unresolved);
      setHasResolveStep(true);
      setStep(STEP_RESOLVE);
    } else {
      setHasResolveStep(false);
      setStep(STEP_PREVIEW);
    }
  };

  // Called when the resolve step finishes (either added options or skipped)
  const handleResolved = (updatedFields: FieldConfig[]) => {
    setLocalFields(updatedFields);
    setStep(STEP_PREVIEW);
  };

  const canAdvanceFromMapping = () => {
    const required = localFields.filter((f) => f.required);
    const mappedIds = mappings.filter((m) => m.fieldId !== "skip").map((m) => m.fieldId);
    return required.every((f) => mappedIds.includes(f._id));
  };

  const handleBack = () => {
    if (step === STEP_RESOLVE) {
      setStep(STEP_MAP);
    } else if (step === STEP_PREVIEW) {
      setStep(hasResolveStep ? STEP_RESOLVE : STEP_MAP);
    } else if (step === STEP_IMPORT) {
      setStep(STEP_PREVIEW);
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleDone = (result: ImportResult) => {
    setImportResult(result);
    onComplete?.(result);
  };

  const isLastStep = step === STEP_IMPORT;

  return (
    <div className="flex flex-col min-h-0 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Import from CSV</h2>
      </div>

      <StepIndicator current={step} hasResolveStep={hasResolveStep} />

      <div className="flex-1 overflow-auto">
        {step === STEP_UPLOAD && <UploadStep onParsed={handleParsed} />}
        {step === STEP_MAP && (
          <MapStep
            previewRows={csvRows}
            fields={localFields}
            mappings={mappings}
            onChange={setMappings}
          />
        )}
        {step === STEP_RESOLVE && (
          <ResolveStep
            unresolvedByField={unresolvedByField}
            fields={localFields}
            collectionName={collectionName}
            onResolved={handleResolved}
          />
        )}
        {step === STEP_PREVIEW && (
          <PreviewStep rows={csvRows} mappings={mappings} fields={localFields} />
        )}
        {step === STEP_IMPORT && (
          <ImportStep
            rows={csvRows}
            mappings={mappings}
            fields={localFields}
            collectionName={collectionName}
            collectionId={collectionId}
            onDone={handleDone}
          />
        )}
      </div>

      {/* Navigation — hidden on the resolve step (has its own inline button) and after import finishes */}
      {step !== STEP_RESOLVE && (!isLastStep || !importResult) && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (step === STEP_UPLOAD ? onClose() : handleBack())}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {step === STEP_UPLOAD ? "Cancel" : "Back"}
          </Button>

          {step < STEP_IMPORT && (
            <Button
              onClick={step === STEP_MAP ? handleMapContinue : () => setStep((s) => s + 1)}
              disabled={step === STEP_MAP && !canAdvanceFromMapping()}
            >
              {step === STEP_PREVIEW ? "Start Import" : "Continue"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {isLastStep && importResult && (
        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button onClick={onClose}>
            <Check className="w-4 h-4 mr-1" /> Done
          </Button>
        </div>
      )}
    </div>
  );
}
