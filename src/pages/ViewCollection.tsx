import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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
  dropdownOptions?: { short: string; long: string }[];
}

interface Item {
  _id: string;
  properties: Record<string, string | boolean>;
}

export default function ViewCollection() {
  const { collectionId } = useParams();
  const navigate = useNavigate();

  const [collection, setCollection] = useState<{ name: string; config: { fields: FieldConfig[] } } | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!collectionId) return;

    const fetchData = async () => {
      try {
        const [collectionRes, itemsRes] = await Promise.all([
          api.get(`/collections/${collectionId}`),
          api.get(`/items/${collectionId}`)
        ]);
        setCollection(collectionRes.data);
        setItems(itemsRes.data);
      } catch (err) {
        console.error("Failed to fetch collection or items", err);
      }
    };

    fetchData();
  }, [collectionId]);
  const renderCell = (field: FieldConfig, value: any) => {
    if (field.type === "checkbox") {
      const text = field.displayAs === "short" ? field.short : field.long;
      return (
        <span className={value ? "font-bold text-muted-foreground" : "text-muted"}>
          {text}
        </span>
      );
    }
    if (field.type === "dropdown") {
      const opt = field.dropdownOptions?.find(o => o.short === value || o.long === value);
      return opt ? (field.displayAs === "short" ? opt.short : opt.long) : "";
    }
    return value ?? "";
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{collection?.name || "Collection"}</CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => navigate(`/collections/${collectionId}/edit`)}>Edit Collection</Button>
            <Button onClick={() => navigate(`/collections/${collectionId}/add-item`)}>Add Item</Button>
          </div>
        </CardHeader>
        <CardContent>
          {collection && (
            <Table>
              <TableHeader>
                <TableRow>
                  {collection.config.fields
                    .filter((f) => f.isActive !== false && f.useInGrid !== false)
                    .map(f => (
                      <TableHead key={f.id}>{f.showInHeader ? f.long : ""}</TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow 
                    key={item._id}
                    onClick={() =>
                      navigate(`/collections/${collectionId}/items/${item._id}/edit`)
                    }
                    className="cursor-pointer hover:bg-muted"
                  >
                    {collection.config.fields
                      .filter((f) => f.isActive !== false && f.useInGrid !== false)
                      .map(f => (
                        <TableCell key={f._id} style={f.showAsBold ? { fontWeight: "bold" } : {}}>
                            {f.type == "checkbox" ? renderCell(f, item.properties[f._id]) : item.properties[f._id]}
                        </TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
