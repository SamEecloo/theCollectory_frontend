// src/pages/GridLayout.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import GridLayoutEditor from "@/components/grid-layout-editor";
import { type IGridRowItem, type ILayoutConfig, DEFAULT_LAYOUT } from "@/types";
import api from "@/lib/api";

type Field = {
  _id: string;
  short: string;
  long: string;
  type: string;
  isActive?: boolean;
  useInGrid?: boolean;
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

        setFields(c.config?.fields || []);
        setGridRows(c.config?.layout?.gridRows ?? []);

        if (c.config?.layout) {
          const { gridRows: _omit, ...rest } = c.config.layout;
          setLayoutConfig(rest);
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
      navigate(`/collections/${collectionName}/edit`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save grid layout");
    }
  };

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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Grid Layout - {collectionName}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/collections/${collectionName}/edit`)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Layout</Button>
        </div>
      </div>

      {/* Grid Layout Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Configure Grid Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <GridLayoutEditor
            fields={fields}
            gridRows={gridRows}
            onChange={setGridRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}