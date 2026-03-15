// src/pages/GridLayout.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import GridLayoutEditor from "@/components/grid-layout-editor_v2";
import { Save, ArrowLeft, TriangleAlert } from "lucide-react";
import { type IGridRowItem, type ILayoutConfig, DEFAULT_LAYOUT } from "@/types";
import api from "@/lib/api";

type Field = {
  _id: string;
  short: string;
  long: string;
  type: string;
  isActive?: boolean;
  useInGrid?: boolean;
  showInHeader?: boolean;
  showAsBold?: boolean;
  displayAs?: "long" | "short";
};

export default function GridLayout() {
  const { collectionName } = useParams();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [gridRows, setGridRows] = useState<IGridRowItem[]>([]);
  const [layoutConfig, setLayoutConfig] = useState<Omit<ILayoutConfig, "gridRows">>(
    (() => {
      const { gridRows: _omit, ...rest } = DEFAULT_LAYOUT;
      return rest;
    })()
  );
  const [loading, setLoading] = useState(true);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  // Load collection
  useEffect(() => {
    if (!collectionName) {
      navigate("/dashboard");
      return;
    }

    (async () => {
      try {
        const res = await api.get(`/collections/${collectionName}`);
        const c = res.data;

        setFields((c.config?.fields || []).filter((f: Field) => f.useInGrid !== false));
        const loadedRows = c.config?.layout?.gridRows ?? [];
        setGridRows(loadedRows);

        if (c.config?.layout) {
          const { gridRows: _omit, ...rest } = c.config.layout;
          setLayoutConfig(rest);
          setSavedSnapshot(JSON.stringify({ gridRows: loadedRows, layoutConfig: rest }));
        } else {
          setSavedSnapshot(JSON.stringify({ gridRows: loadedRows, layoutConfig }));
        }

        setLoading(false);
      } catch (err) {
        toast.error("Failed to load collection");
        navigate("/dashboard");
      }
    })();
  }, [collectionName, navigate]);

  const handleSave = async () => {
    try {
      // Fetch current collection to preserve all other settings
      const res = await api.get(`/collections/${collectionName}`);
      const currentCollection = res.data;

      // Update only the layout config
      const updatedPayload = {
        ...currentCollection,
        config: {
          ...currentCollection.config,
          layout: {
            ...layoutConfig,
            gridRows,
          },
        },
      };

      await api.put(`/collections/${collectionName}`, updatedPayload);
      toast.success("Grid layout saved successfully!");
      setSavedSnapshot(JSON.stringify({ gridRows, layoutConfig }));
      navigate(`/collections/${collectionName}/edit`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save grid layout");
    }
  };

  const isDirty = savedSnapshot !== null &&
    JSON.stringify({ gridRows, layoutConfig }) !== savedSnapshot;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h1 className="text-2xl">Grid Layout</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/collections/${collectionName}/edit`)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </div>
      <GridLayoutEditor
        fields={fields}
        gridRows={gridRows}
        onChange={setGridRows}
      />

      {isDirty && (
        <div className="flex items-center gap-2 px-4 sm:px-0 text-sm text-muted-foreground">
          <TriangleAlert className="h-4 w-4 text-yellow-500" />
          <span>Unsaved changes</span>
        </div>
      )}
    </div>
  );
}