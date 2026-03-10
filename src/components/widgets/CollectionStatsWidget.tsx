import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package } from 'lucide-react';
import api from '@/lib/api';

type CollectionStats = {
  totalCollections: number;
  totalItems: number;
  publicCollections: number;
  privateCollections: number;
};

export default function CollectionStatsWidget() {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/collection-stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collection Statistics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Collection Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Collections</p>
            <p className="text-2xl font-bold">{stats?.totalCollections || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Items</p>
            <p className="text-2xl font-bold">{stats?.totalItems || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Public</p>
            <p className="text-lg font-semibold text-primary">{stats?.publicCollections || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Private</p>
            <p className="text-lg font-semibold text-muted-foreground">{stats?.privateCollections || 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}