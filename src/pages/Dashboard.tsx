import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
interface Collection {
  _id: string;
  name: string;
  isPublic: boolean;
}

export default function Dashboard() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/api/collections", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setCollections(data);
        } else {
          console.error("Failed to fetch collections");
        }
      } catch (err) {
        console.error("Error fetching collections:", err);
      }
    };

    fetchCollections();
  }, []);

  const handleDelete = async (id: string) => {
    const confirm = window.confirm("Are you sure? This will permanently delete the collection and all its items.");
    if (!confirm) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`http://localhost:5000/api/collections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setCollections((prev) => prev.filter((c) => c._id !== id));
    } else {
      console.error("Failed to delete collection");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Collections</h1>
        <Button onClick={() => navigate("/collections/new")}>+ Create New Collection</Button>
      </div>

      {collections.length === 0 ? (
        <p className="text-muted-foreground">You don't have any collections yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card key={collection._id} className="grid grid-cols-1">
              <CardContent>
                <h2 className="text-lg font-semibold">{collection.name} {collection.isActive ? "" : "(Inactive)"}</h2>
                <p className="text-sm text-muted-foreground">
                  {collection.isPublic ? "Public" : "Private"}
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => navigate(`/collections/${collection._id}`)}>
                    View
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/collections/${collection._id}/edit`)}>
                    Edit Config
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(collection._id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
