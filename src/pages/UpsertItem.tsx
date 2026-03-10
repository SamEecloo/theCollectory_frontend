// src/pages/UpsertItem.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useBlocker  } from "react-router-dom";
import { Trash2, Loader2, Heart } from "lucide-react";
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import TagSelector from '@/components/tag-selector';
import ItemNavigation from '@/components/ItemNavigation';
import ImageUploadManager from '@/components/image-upload-manager_v2';
import api from "@/lib/api";

type DropdownOption = {
  _id: string;
  short: string;
  long: string;
};

type Field = {
  _id: string;
  short: string;
  long: string;
  type: "text" | "number" | "checkbox" | "dropdown" | "textarea" | "tags" | "image" | "date";
  options?: DropdownOption[];
  isActive?: boolean;
  persistValue?: boolean;
  orientation?: "landscape" | "portrait" | "square";
};

type Collection = {
  _id: string;
  name: string;
  config: { fields: Field[] };
};

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

const getRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const moveTemporaryImages = async (
  userId: string,
  collectionId: string,
  newItemId: string,
  retries = 3
): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await api.post('/images/move-temp', {
        userId,
        collectionId,
        tempId: 'temp',
        itemId: newItemId,
      });
      return true;
    } catch (err) {
      console.error(`move-temp attempt ${attempt} failed:`, err);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return false;
};

export default function UpsertItem() {
  const navigate = useNavigate();
  const { collectionName, itemId } = useParams();
  const userId = getUserIdFromToken();
  const isEdit = Boolean(itemId);

  // State
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newAdded, setNewAdded] = useState<Date | undefined>(undefined);
  const [pendingDate, setPendingDate] = useState<Date | undefined>(undefined);
  const [imageKey, setImageKey] = useState(0);
  const [pendingImageDeletions, setPendingImageDeletions] = useState<string[]>([]);
  const [resetImageDeletions, setResetImageDeletions] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isWishlist, setIsWishlist] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );
  // Load collection and item data
  useEffect(() => {
    if (!collectionName) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [collectionRes, itemRes] = await Promise.all([
          api.get(`/collections/${collectionName}`),
          isEdit ? api.get(`/items/item/${itemId}`) : Promise.resolve({ data: null })
        ]);

        setCollection(collectionRes.data);
        if (isEdit && itemRes.data) {
          // Editing existing item
          setValues(itemRes.data.properties ?? {});
          if (itemRes.data.wishlist !== undefined) {
            setIsWishlist(itemRes.data.wishlist);
          }
          if (itemRes.data.updatedAt) {
            setLastUpdated(new Date(itemRes.data.updatedAt));
          }
          if (itemRes.data.createdAt) {
            setNewAdded(new Date(itemRes.data.createdAt));
          }
        } else {
          // Creating new item - apply filter defaults
          const storageKey = `filters_${collectionRes.data.name}`;
          const savedFilters = localStorage.getItem(storageKey);
          if (savedFilters) {
            const { values: filterValues } = JSON.parse(savedFilters);
            const initial: Record<string, any> = {};

            collectionRes.data.config.fields.forEach((field: Field) => {
              if (['dropdown', 'checkbox', 'number'].includes(field.type)) {
                if (filterValues[field._id] !== undefined) {
                  initial[field._id] = filterValues[field._id];
                }
              }
            });

            setValues(initial);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [collectionName, itemId, isEdit, navigate]);

  const activeFields: Field[] = useMemo(
    () => (collection?.config.fields || []).filter(f => f.isActive !== false),
    [collection]
  );

  const setValue = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    setIsDirty(true);
  };

  const handleWishlistToggle = () => {
    setIsWishlist(prev => {
      setIsDirty(true);
      return !prev;
    });
  };

  // same for setNewAdded
  const handleDateChange = (date: Date | undefined) => {
    setNewAdded(date);
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    const collectionId = collection?._id;
    if (!collectionId) return;
    setSaving(true);
    try {
      // Clean up empty arrays
      const cleanedValues = { ...values };
      activeFields.forEach(field => {
        if ((field.type === 'image' || field.type === 'tags') && 
            Array.isArray(cleanedValues[field._id]) && 
            cleanedValues[field._id].length === 0) {
          delete cleanedValues[field._id];
        }
      });

      if (isEdit && itemId) {
        // Update existing item
        await api.put(`/items/item/${itemId}`, { properties: cleanedValues, wishlist: isWishlist, ...(newAdded && { createdAt: newAdded }), });
        setLastUpdated(new Date());

        // Handle pending image deletions
        if (pendingImageDeletions.length > 0 && userId) {
          await api.post('/images/delete-multiple', {
            userId,
            collectionId,
            itemId,
            imageIds: pendingImageDeletions
          });
          setPendingImageDeletions([]);
          setResetImageDeletions(true);
          setTimeout(() => setResetImageDeletions(false), 100);
        }

        toast.success('Item updated successfully!', {
          description: 'Your changes have been saved.',
        });
        setIsDirty(false);
      } else {
        // Create new item
        const response = await api.post(`/items/${collectionName}`, { properties: cleanedValues, wishlist: isWishlist, createdAt: newAdded ?? new Date(), });
        const newItemId = response.data._id;

        // Move temporary images
        if (userId) {
          const moveSuccess = await moveTemporaryImages(userId, collectionId, newItemId);

          if (!moveSuccess) {
            toast.error('Item created, but images failed to save. Please re-upload them.', {
              duration: 5000,
              action: {
                label: 'Re-upload',
                onClick: () => navigate(`/collections/${collectionName}/items/${newItemId}/edit`),
              },
            });
          }
        }

        // Clear non-persisted values
        const persistedValues: Record<string, any> = {};
        activeFields.forEach(field => {
          if (field.persistValue === true) {
            persistedValues[field._id] = values[field._id];
          }
        });
        setValues(persistedValues);

        // Force remount of image fields if needed
        const hasNonPersistedImages = activeFields.some(
          f => f.type === 'image' && f.persistValue !== true
        );
        if (hasNonPersistedImages) {
          setImageKey(prev => prev + 1);
        }

        toast.success('Item created successfully!', {
          description: 'Your new item has been added to the collection.',
          action: {
            label: 'View',
            onClick: () => navigate(`/collections/${collectionName}/items/${newItemId}/edit`)
          }
        });
        setIsDirty(false);
      }
    } catch (err) {
      console.error("Save failed:", err);
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemId) return;
    if (!collectionName) return;
    setDeleting(true);
    try {
      await api.delete(`/items/item/${itemId}`);
      toast.success('Item deleted successfully');
      navigate(`/collections/${collectionName}`);
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {isEdit && <ItemNavigation mode="edit" />}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{isEdit ? "Edit Item " : "Add Item "}</CardTitle>
            <div
              className="flex items-center gap-1 cursor-pointer select-none"
              onClick={handleWishlistToggle}
            >
              <Heart className={`h-4 w-4 ${isWishlist ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
              <span className={`text-sm ${isWishlist ? 'text-rose-500' : 'text-muted-foreground'}`}>
                {isWishlist ? 'On wishlist' : 'Add to wishlist'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Two column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column - standard fields */}
              <div className="space-y-4">
                {activeFields.map(field => {
                  const fieldId = `field-${field._id}`;
                  const value = values[field._id];

                  switch (field.type) {
                    case "text":
                      return (
                        <div key={field._id} className="space-y-2">
                          <Label htmlFor={fieldId}>{field.long}</Label>
                          <Input
                            className="w-full"
                            id={fieldId}
                            value={value ?? ""}
                            onChange={(e) => setValue(field._id, e.target.value)}
                          />
                        </div>
                      );

                    case "number":
                      return (
                        <div key={field._id} className="space-y-2">
                          <Label htmlFor={fieldId}>{field.long}</Label>
                          <Input
                            className="w-full"
                            id={fieldId}
                            type="number"
                            value={value ?? ""}
                            onChange={(e) => setValue(field._id, e.target.value === "" ? "" : Number(e.target.value))}
                          />
                        </div>
                      );

                    case "checkbox":
                      return (
                        <div key={field._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={fieldId}
                            checked={Boolean(value)}
                            onCheckedChange={(v) => setValue(field._id, v === true)}
                          />
                          <Label htmlFor={fieldId}>{field.long}</Label>
                        </div>
                      );

                    case "dropdown":
                      return (
                        <div key={field._id} className="space-y-2">
                          <Label htmlFor={fieldId}>{field.long}</Label>
                          <Select value={value ?? ""} onValueChange={(v) => setValue(field._id, v)}>
                            <SelectTrigger className="w-full" id={fieldId}>
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map(option => (
                                <SelectItem key={option._id} value={option._id}>
                                  {option.long}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );

                    case "textarea":
                      return (
                        <div key={field._id} className="space-y-2">
                          <Label htmlFor={fieldId}>{field.long}</Label>
                          <Textarea
                            className="w-full"
                            id={fieldId}
                            value={value ?? ""}
                            onChange={(e) => setValue(field._id, e.target.value)}
                          />
                        </div>
                      );

                    case "date":
                      return (
                        <div key={field._id} className="space-y-2">
                          <Label htmlFor={fieldId}>{field.long}</Label>
                          <DatePicker
                            value={value ? new Date(value) : undefined}
                            onChange={(date) => setValue(field._id, date ? date.toISOString() : undefined)}
                            placeholder="Select a date..."
                          />
                        </div>
                      );

                    default:
                      return null;
                  }
                })}
              </div>

              {/* Right column - tags and images */}
              <div className="space-y-4">
                {activeFields.map(field => {
                  const value = values[field._id];

                  if (field.type === "tags") {
                    if(!collection) return;
                    return (
                      <div key={field._id} className="space-y-2">
                        <Label>{field.long}</Label>
                        <TagSelector
                          collectionName={collectionName!}
                          collectionId={collection._id!}
                          value={value || []}
                          onChange={(tags) => setValue(field._id, tags)}
                          placeholder="Select or create tags..."
                          allowCreate={true}
                        />
                      </div>
                    );
                  }

                  if (field.type === "image") {
                    if(!collection) return;
                    return (
                      <div key={field._id} className="space-y-2">
                        <Label>{field.long}</Label>
                        <ImageUploadManager
                          key={`${itemId || 'new'}-${field._id}-${imageKey}`}
                          userId={userId!}
                          collectionId={collection._id!}
                          itemId={itemId || 'temp'}
                          initialImages={value || []}
                          onImagesChange={(images) => setValue(field._id, images)}
                          orientation={field.orientation || 'landscape'}
                          onPendingDeletionsChange={setPendingImageDeletions}
                          resetPendingDeletions={resetImageDeletions}
                        />
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  isEdit ? "Update Item" : "Save Item"
                )}
              </Button>
              {isDirty && (
                <span className="text-sm text-muted-foreground italic">
                  Unsaved changes
                </span>
              )}
              {isEdit && (
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" className="ml-auto">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this item from your collection.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {/* Date dialog */}
              <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Set added date</DialogTitle>
                  </DialogHeader>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Override the date this item was added to your collection.
                  </DialogDescription>
                  <DatePicker
                    value={pendingDate}
                    onChange={(date) => setPendingDate(date ?? undefined)}
                    placeholder="Pick a date..."
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setPendingDate(undefined);
                      setShowDateDialog(false);
                    }}>
                      Cancel
                    </Button>
                    <Button className="mb-2" onClick={() => {
                      handleDateChange(pendingDate);
                      setShowDateDialog(false);
                    }}>
                      Confirm
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <AlertDialog open={blocker.state === 'blocked'}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                    <AlertDialogDescription>
                      You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => blocker.reset?.()}>
                      Stay
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => blocker.proceed?.()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Leave anyway
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        {lastUpdated && isEdit && (
          <span className="text-sm text-muted-foreground mt-1">
            Updated {getRelativeTime(lastUpdated)}
          </span> 
        )}
        {newAdded && isEdit && (
          <span
            className="text-sm text-muted-foreground mt-1 mr-4 cursor-pointer"
            onClick={() => {
              setPendingDate(newAdded); // pre-fill with current value
              setShowDateDialog(true);
            }}
          >
            Added {getRelativeTime(newAdded)}
          </span>
        )}
      </div>
      {/* Debug JSON */}
      {/*<details className="mt-6">
        <summary className="cursor-pointer select-none text-sm text-muted-foreground">
          Show item JSON
        </summary>
        <pre className="mt-2 rounded bg-muted p-3 text-sm overflow-x-auto">
          {JSON.stringify(values, null, 2)}
        </pre>
      </details>*/}
    </div>
  );
}