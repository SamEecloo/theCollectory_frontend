import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import { AddFriendButton } from "@/components/add-friend";

interface PublicCollection {
  _id: string;
  name: string;
  itemCount?: number;
}

export default function PublicDashboard() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPublicCollections = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/collections/${username}/collections`);
        setCollections(response.data);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          toast.error("Failed to load collections");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPublicCollections();
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <p className="text-xl font-semibold">User not found</p>
        <p className="text-muted-foreground">No user with the name <strong>{username}</strong> exists.</p>
      </div>
    );
  }
  if (username){
    return (
      <div className="p-6 space-y-4">
        <div className="mb-6">
          <h1 className="text-2xl">{username}'s Collections</h1>
          <AddFriendButton profileUsername={username} />
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">This user has no public collections.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <Card key={collection._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{collection.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {collection.itemCount !== undefined
                      ? `${collection.itemCount} item${collection.itemCount !== 1 ? 's' : ''}`
                      : 'Loading...'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/${username}/${encodeURIComponent(collection.name)}`)}
                  >
                    View Collection
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  };
}