import { useEffect, useState } from 'react';
import { Image } from 'lucide-react';
import api from '@/lib/api';
import ProgressBar from './ProgressBar';
import WidgetCard from './WidgetCard';

type ImageStats = {
  totalItems: number;
  withImages: number;
  withoutImages: number;
  percentageWithImages: number;
};

type Props = {
  collectionId?: string;
  onRemove?: () => void;
};

export default function ImageStatsWidget({ collectionId, onRemove }: Props) {
  const [stats, setStats] = useState<ImageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (collectionId) {
      fetchStats();
    }
  }, [collectionId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/image-stats', {
        params: { collectionId }
      });
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch image stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WidgetCard
      title="Image Statistics"
      icon={Image}
      loading={loading}
      onRemove={onRemove}
    >
      {stats && (
        <div className="space-y-4">
          {/* With Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">With Images</span>
              <span className="text-muted-foreground">{stats.withImages}</span>
            </div>
            <div className="relative bg-muted rounded-full h-6 overflow-hidden">
              <ProgressBar
                percentage={stats.percentageWithImages}
                label={`${Math.round(stats.percentageWithImages)}%`}
              />
            </div>
          </div>

          {/* Without Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Without Images</span>
              <span className="text-muted-foreground">{stats.withoutImages}</span>
            </div>
            <div className="relative bg-muted rounded-full h-6 overflow-hidden">
              <ProgressBar
                percentage={100 - stats.percentageWithImages}
                label={`${Math.round(100 - stats.percentageWithImages)}%`}
              />
            </div>
          </div>
          <div className="pt-2 border-t text-sm text-muted-foreground">
            Total: {stats.totalItems} items
          </div>
        </div>
      )}
    </WidgetCard>
  );
}