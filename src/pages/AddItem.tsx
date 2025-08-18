import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function AddItem() {
  const { collectionId } = useParams();
  const [ collectionName, setCollectionName ] = useState<any>("Collection");
  const navigate = useNavigate();
  const [fields, setFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const itemJson = {
    collectionId,
    properties: formValues, // keys = field.short; values = user input
    };

  // ✅ Token validity check + fetch collection config
  useEffect(() => {const checkTokenAndFetch = async () => {
      try {
        //await api.get("/auth/check"); // endpoint to verify token
        const res = await api.get(`/collections/${collectionId}`);
        console.log(res.data.config);
        console.log(res.data.name);
        setFields(res.data.config?.fields || []);
        setCollectionName(res.data?.name || "Collection");
        setLoading(false);
      } catch (err) {
        console.error("Auth or fetch error", err);
        navigate("/login");
      }
    };
    checkTokenAndFetch();}, [collectionId, navigate]);

  const handleChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/items", itemJson);
      navigate(`/collections/${collectionId}`);
    } catch (err) {
      console.error("Failed to add item", err);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
  <form onSubmit={handleSubmit} className="space-y-4">
   <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Add New Item</h2>
      <div className="grid grid-cols-2 gap-10">  
        <div className="grid-rows-subgrid">
      
        {fields
          .filter((f) => f.isActive !== false)
          .map((field) => {
            const inputId = `field-${field.key}`; // unique per field
            return (
                
              <div key={field.key} className="space-y-6">
                <Label htmlFor={inputId}>{field.long || field.short}</Label>&nbsp;

                {field.type === "text" && (
                  <Input
                    id={inputId} // link label to input
                    value={formValues[field.short] || ""}
                    onChange={(e) => handleChange(field.short, e.target.value)}
                  />
                )}

                {field.type === "number" && (
                  <Input
                    id={inputId}
                    type="number"
                    value={formValues[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}

                {field.type === "checkbox" && (
                  <Checkbox
                    
                    id={inputId}
                    checked={!!formValues[field.long]}
                    onCheckedChange={(v) => handleChange(field.long, Boolean(v))}
                  />
                )}

                {field.type === "dropdown" && (
                  <Select
                    onValueChange={(v) => handleChange(field.long, v)}
                    value={formValues[field.long] || field.short}
                  >
                    <SelectTrigger id={inputId} className="w-[100%]">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt: any, idx: number) => (
                        <SelectItem key={idx} value={opt.short}>
                          {opt.long}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === "textarea" && (
                  <Textarea
                    id={inputId}
                    value={formValues[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}

                {field.type === "tags" && (
                  <Input
                    id={inputId}
                    placeholder="Comma separated tags"
                    value={formValues[field.key] || ""}
                    onChange={(e) =>
                      handleChange(field.key, e.target.value.split(",").map((t) => t.trim()))
                    }
                  />
                )}

                {field.type === "image" && (
                  <Input
                    id={inputId}
                    type="url"
                    placeholder="Image URL"
                    value={formValues[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}
                

              </div>
              
            );
            
          })}
          </div>
          </div>
        <details className="mt-6">
            <summary className="cursor-pointer select-none text-sm text-muted-foreground">
                Show item JSON
            </summary>
            <pre className="mt-2 rounded bg-gray-100 p-3 text-sm overflow-x-auto">
                {JSON.stringify(itemJson, null, 2)}
            </pre>
        </details>
        <Button type="submit">Save Item</Button>
      
    </div>
    </form>
  );
}
