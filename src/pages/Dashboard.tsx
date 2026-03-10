import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Copy, CheckCircle2, Circle, Check, BarChart3, Settings, Trash, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import api from "@/lib/api";

interface Collection {
  _id: string;
  name: string;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
  itemCount?: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await api.get("/collections");
      setCollections(response.data);
    } catch (err) {
      console.error("Error fetching collections:", err);
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (name: string) => {
    setCollectionToDelete(name);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!collectionToDelete) return;

    try {
      await api.delete(`/collections/${collectionToDelete}`);
      setCollections(prev => prev.filter(c => c.name !== collectionToDelete));
      toast.success("Collection deleted");
    } catch (err) {
      console.error("Failed to delete collection:", err);
      toast.error("Failed to delete collection");
    } finally {
      setDeleteDialogOpen(false);
      setCollectionToDelete(null);
    }
  };

  const handleCopyUrl = (e: React.MouseEvent, collectionName: string, collectionId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/${username}/${encodeURIComponent(collectionName)}`;
    navigator.clipboard.writeText(url);
    
    toast.success('URL copied to clipboard!', {
      description: collectionName,
    });
    
    setCopiedId(collectionId);
    setTimeout(() => setCopiedId(null), 2000);
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
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl">My Collections</h1>
        <Button onClick={() => navigate("/collections/new")}>
          + New Collection
        </Button>
      </div>

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You don't have any collections yet.</p>
          <Button onClick={() => navigate("/collections/new")}>
            Create Your First Collection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card key={collection._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{collection.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <span 
                      title={collection.isPublic ? "Public - Anyone can view" : "Private - Only you can view"}
                      className="inline-flex cursor-help"
                    >
                      {collection.isPublic ? (
                        <Eye className="h-4 w-4 text-primary" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <span 
                      title={collection.isActive ? "Active" : "Inactive"}
                      className="inline-flex cursor-help"
                    >
                      {collection.isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Item Count */}
                <div className="text-sm text-muted-foreground">
                  {collection.itemCount !== undefined 
                    ? `${collection.itemCount} item${collection.itemCount !== 1 ? 's' : ''}`
                    : 'Loading...'
                  }
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/collections/${collection.name}`)}
                    className="flex-1"
                  >
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => navigate(`/collections/${collection.name}/edit`)}
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => navigate(`/collections/${collection.name}/stats`)}
                    title="Statistics"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={() => handleDeleteClick(collection.name)}
                    title="Delete"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>

                {/* Public URL */}
                {collection.isPublic && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Public URL:</p>
                    <div className="flex gap-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {window.location.origin}/{username}/{encodeURIComponent(collection.name)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => handleCopyUrl(e, collection.name, collection._id)}
                      >
                        {copiedId === collection._id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{collectionToDelete}</strong> and all its items. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}