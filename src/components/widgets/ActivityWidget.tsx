import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import WidgetCard from './WidgetCard';
import ProgressBar from './ProgressBar';

type ActivityData = {
  date: string;
  itemsAdded: number;
};

type Props = {
  collectionId?: string;
  onRemove?: () => void;
};

export default function ActivityWidget({ collectionId, onRemove }: Props) {
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (collectionId) { // ADD THIS CHECK
      fetchActivity();
    }
  }, [collectionId]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/activity', {
        params: { 
          days: 7,
          collectionId: collectionId // This should already be here
        }
      });
      setActivity(response.data);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxItems = Math.max(...activity.map(a => a.itemsAdded), 1);

  return (
    <WidgetCard
      title="Activity (Last 7 Days)"
      icon={TrendingUp}
      loading={loading}
      onRemove={onRemove}
    >
      <div className="space-y-2">
        {activity.map((day) => (
          <div key={day.date} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-20">
              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
              <ProgressBar
                percentage={(day.itemsAdded / maxItems) * 100}
                label={day.itemsAdded.toString()}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}