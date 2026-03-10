import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImageUploadManager from '@/components/image-upload-manager';
import ItemNavigation from '@/components/ItemNavigation';
import { setTagFilter } from '@/lib/filterUtils';
type DropdownOption = { _id: string; short: string; long: string };
type Field = {
  _id: string;
  short: string;
  long: string;
  type: "text" | "number" | "checkbox" | "dropdown" | "textarea" | "tags" | "image";
  options?: DropdownOption[];
  isActive?: boolean;
  isPublic?: boolean;
  persistValue?: boolean;
  orientation?: "landscape" | "portrait" | "square";
};

type CollectionDto = { _id: string; name: string; config: { fields: Field[] } };

export default function ViewItem() { 
  const getUserIdFromToken = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    } catch {
      return null;
    }
  };
  const { username, collectionName, itemId } = useParams();
  console.log(useParams());
  const userId = getUserIdFromToken();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<CollectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, any>>({});  

  useEffect(() => {
    console.log(username);
    console.log(collectionName);
    console.log(itemId);
    if (!collectionName) return;
    if (!username) return;
    (async () => {
      try {
        const [cRes, iRes] = await Promise.all([
          api.get(`/collections/${username}/${collectionName}`),
          api.get(`/items/${username}/${collectionName}/${itemId}`)
        ]);
        setCollection(cRes.data);
        setValues(iRes.data?.properties ?? {});
      } catch (e) {
        console.error("Failed to load", e);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [username, collectionName, itemId, navigate]);
  const collectionId = collection?._id;
  const activeFields: Field[] = useMemo(
    () => (collection?.config.fields || []).filter(f => f.isActive !== false),
    [collection]
  );

  const setValue = (_id: string, v: any) =>
    setValues(prev => ({ ...prev, [_id]: v }));

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <ItemNavigation mode="view" />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>View Item</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid-rows-subgrid">
                <table className="w-full">
              <tbody>
                {activeFields
                  .filter(f => f.type !== "image" && f.type !== "tags")
                  .map((f) => {
                    const val = values[f._id];
                    
                    let displayValue: React.ReactNode = val || "-";

                    // Handle different field types
                    if (f.type === "checkbox") {
                      displayValue = (
                        <span className={val ? "font-semibold text-green-600" : "text-muted-foreground"}>
                          {val === true ? "Yes" : "No"}
                        </span>
                      );
                    } else if (f.type === "dropdown") {
                      displayValue = f.options?.find(o => o._id === val)?.long ?? "No selection";
                    } else if (f.type === "textarea") {
                      displayValue = (
                        <div className="whitespace-pre-wrap">{val || "-"}</div>
                      );
                    }

                    return (
                      <tr key={f._id}>
                        <td className="py-3 pr-4 align-top font-medium text-muted-foreground w-1/3">
                          {f.long}
                        </td>
                        <td className="py-3 pl-4 align-top">
                          {displayValue}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="grid-rows-subgrid">
            {activeFields.map((f) => {
              const val = values[f._id];
              switch (f.type) {
                case "tags":
                  if (!Array.isArray(val) || val.length === 0) return null;
                  return (
                    <div key={f._id} className="space-y-2 py-3">
                      <Label>{f.long}</Label>
                      <div className="flex flex-wrap gap-2 py-3">
                        {Array.isArray(val) && val.map((tag: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => 
                              {
                                if (!collectionId) return;
                                if (!username) return;
                                 setTagFilter(
                                  collectionName!, 
                                  username,
                                  f._id, 
                                  tag,
                                  true,
                                  navigate
                                );
                            }}
                            className="inline-flex items-center gap-1 px-2 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                case "image":
                  return (
                    <div key={f._id} className="space-y-2 col-span-2">
                      <ImageUploadManager
                        key={`${itemId}-${f._id}`}
                        userId={userId!}
                        collectionId={collectionName!}
                        itemId={itemId || 'temp'}
                        initialImages={val || []}
                        onImagesChange={(images) => setValue(f._id, images)}
                        orientation={f.orientation || 'landscape'} // ADD THIS
                        isPublicView={true}
                      />
                    </div>
                  );
                default:
                  return null;
            }
          })}
        </div>
      </div>
    </CardContent>
  </Card>
  </div>
  );
}
