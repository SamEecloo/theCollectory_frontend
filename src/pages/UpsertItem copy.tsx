import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImageEditorUploader from "@/components/ImageEditorUploader";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
type DropdownOption = { short: string; long: string };
type Field = {
  _id: string;
  short: string;
  long: string;
  type: "text" | "number" | "checkbox" | "dropdown" | "textarea" | "tags" | "image";
  options?: DropdownOption[];
  isActive?: boolean;
  orientation?: "landscape" | "portrait" | "square";
};

type CollectionDto = { name: string; config: { fields: Field[] } };

export default function UpsertItem() {
  const { collectionId, itemId } = useParams();
  const isEdit = Boolean(itemId);
  const navigate = useNavigate();

  const [collection, setCollection] = useState<CollectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!collectionId) return;
    (async () => {
      try {
        //await api.get("/auth/validate-token"); // optional token check
        const [cRes, iRes] = await Promise.all([
          api.get(`/collections/${collectionId}`),
          isEdit ? api.get(`/items/item/${itemId}`) : Promise.resolve({ data: null }), // adjust path if different
          
        ]);
        setCollection(cRes.data);
        setValues(iRes.data?.properties ?? {});
        console.log(values)
      } catch (e) {
        console.error("Failed to load", e);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [collectionId, itemId, isEdit, navigate]);

  const activeFields: Field[] = useMemo(
    () => (collection?.config.fields || []).filter(f => f.isActive !== false),
    [collection]
  );

  const setValue = (short: string, v: any) =>
    setValues(prev => ({ ...prev, [short]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionId) return;
    setSaving(true);
    try {
      if (isEdit && itemId) {
        await api.put(`/items/item/${itemId}`, { properties: values }); // adjust to your PUT route
      } else {
        await api.post(`/items/${collectionId}`, { properties: values });
      }
      //navigate(`/collections/${collectionId}`);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEdit ? "Edit Item" : "Add Item"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-10">
                <div className="grid-rows-subgrid">
                    
            {activeFields.map((f) => {
              const id = `field-${f._id}`;
              const val = values[f.long];
              
              switch (f.type) {
                case "text":
                  return (
                    <div key={f._id} className="space-y-6">
                      <Label htmlFor={id}>{f.long}</Label>
                      <Input id={id} value={val ?? ""} onChange={(e) => setValue(f._id, e.target.value)} />
                    </div>
                  );
                case "number":
                  return (
                    <div key={f._id} className="space-y-6">
                      <Label htmlFor={id}>{f.long}</Label>
                      <Input
                        id={id}
                        type="number"
                        value={val ?? ""}
                        onChange={(e) => setValue(f._id, e.target.value === "" ? "" : Number(e.target.value))}
                      />
                    </div>
                  );
                case "checkbox":
                  return (
                    <div key={f._id} className="space-y-6">
                      <Checkbox
                        id={id}
                        checked={Boolean(val)}
                        onCheckedChange={(v) => setValue(f._id, v === true)}
                      />
                      &nbsp;<Label htmlFor={id}>{f.long}</Label>
                    </div>
                  );
                case "dropdown":
                  return (
                    <div key={f._id} className="space-y-6">
                      <Label htmlFor={id}>{f.long}</Label>
                      <Select value={val ?? ""} onValueChange={(v) => setValue(f._id, v)}>
                        <SelectTrigger id={id} className="w-[100%]"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {(f.options || []).map((o, i) => (
                            <SelectItem key={`${f._id}-${i}`} value={o.short}>
                              {o.long}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                case "textarea":
                  return (
                    <div key={f._id} className="space-y-6">
                      <Label htmlFor={id}>{f.long}</Label>
                      <Textarea id={id} value={val ?? ""} onChange={(e) => setValue(f._id, e.target.value)} />
                    </div>
                  );
                default:
                  return null;
              }
            })}
            </div>
            <div className="grid-rows-subgrid">
                {activeFields.map((f) => {
              const id = `field-${f._id}`;
              const val = values[f.long];
              
              switch (f.type) {

                case "tags":
                  return (
                    <div key={f._id} className="space-y-6">
                      <Label htmlFor={id}>{f.long}</Label>
                      <Input
                        id={id}
                        placeholder="comma,separated,tags"
                        value={Array.isArray(val) ? val.join(",") : (val ?? "")}
                        onChange={(e) =>
                          setValue(
                            f.short,
                            e.target.value
                              .split(",")
                              .map(s => s.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    </div>
                  );
                case "image":
                  return (
                    <div key={f._id} className="space-y-2">
                    <Label>{f.long}</Label>
                    <ImageEditorUploader
                        orientation={f.orientation ?? "landscape"}
                        collectionId={collectionId!}
                        itemId={itemId ?? "temp"} 
                        onDone={(uploaded) => {
                        // uploaded: [{url, thumbUrl}]
                        setValue(f.short, uploaded.map(u => u.url)); // or store full objects
                        }}
                    />
                    {/* preview already attached to item */}
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(values[f.short] || []).map((u: string, i: number) => (
                        <img key={`${f._id}-${i}`} src={`${BACKEND_URL}${u}`} alt="" />
                        ))}
                    </div>
                    </div>
                  );
                default:
                  return null;
              }
            })}
            </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Update Item" : "Save Item"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
       <details className="mt-6">
            <summary className="cursor-pointer select-none text-sm text-muted-foreground">
                Show item JSON
            </summary>
            <pre className="mt-2 rounded bg-gray-100 p-3 text-sm overflow-x-auto">
                {JSON.stringify(values, null, 2)}
            </pre>
        </details>
    </div>
  );
}
