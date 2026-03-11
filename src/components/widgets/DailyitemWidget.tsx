import { useEffect, useState } from 'react';
import { Shuffle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import WidgetCard from './WidgetCard';

type Field = {
  _id: string;
  long: string;
  short: string;
  type: string;
  isActive?: boolean;
  showInHeader?: boolean;
  orientation?: 'landscape' | 'portrait' | 'square';
  options?: Array<{ _id: string; long: string; short: string }>;
};

type Item = {
  _id: string;
  properties: Record<string, any>;
  createdAt: string;
};

type Props = {
  id?: string;
  collectionId?: string;
  collectionName?: string;
  config?: {
    titleFieldId?: string;
    subtitleFieldId?: string;
  };
  onConfigChange?: (config: any) => void;
  onRemove?: () => void;
};

/**
 * Seeded RNG (mulberry32) — given the same seed it always returns the same sequence.
 * Using today's date as seed ensures the same item is picked all day.
 */
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function todaySeed(): number {
  const d = new Date();
  // YYYYMMDD as integer — unique per day
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export default function DailyItemWidget({ collectionId, collectionName, onRemove }: Props) {
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageOrientation, setImageOrientation] = useState<'landscape' | 'portrait' | 'square'>('landscape');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionId || !collectionName) return;
    fetchDailyItem();
  }, [collectionId, collectionName]);

  const fetchDailyItem = async () => {
    try {
      setLoading(true);

      // Fetch collection config for field metadata
      const collectionRes = await api.get(`/collections/${collectionName}`);
      const activeFields: Field[] = collectionRes.data.config.fields.filter(
        (f: Field) => f.isActive !== false
      );
      setFields(activeFields);

      // Fetch all items (just ids + properties — keep payload light)
      const itemsRes = await api.get(`/items/${collectionName}`, {
        params: { collectionId, limit: 1000 },
      });

      const items: Item[] = itemsRes.data.items ?? itemsRes.data;
      if (!items || items.length === 0) {
        setLoading(false);
        return;
      }

      // Pick a stable daily index using the seeded RNG
      const rng = seededRandom(todaySeed());
      const index = Math.floor(rng * items.length);
      const picked = items[index];
      setItem(picked);
      
      // Find image field and build URL if present
      const imageField = activeFields.find((f) => f.type === 'image');
       
      if (imageField) {
        setImageOrientation(imageField.orientation ?? 'landscape');
        const imgValue = picked.properties[imageField._id];

        if (Array.isArray(imgValue) && imgValue.length > 0) {
            const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000';
            setImageUrl(backendUrl + (imgValue[0].thumbnailUrl ?? imgValue[0].url ?? ''));
        }
      }
    } catch (err) {
      console.error('Failed to fetch daily item:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFieldValue = (field: Field, properties: Record<string, any>): string | null => {
    const raw = properties[field._id];
    if (raw === undefined || raw === null || raw === '') return null;

    if (field.type === 'dropdown') {
      const option = field.options?.find((o) => String(o._id) === String(raw));
      return option?.long ?? option?.short ?? String(raw);
    }
    if (field.type === 'checkbox') return raw ? 'Yes' : 'No';
    if (field.type === 'tags' && Array.isArray(raw)) return raw.join(', ');
    if (field.type === 'image') return null; // shown separately
    return String(raw);
  };

  // Fields to display: header fields first, then others — skip image
  const displayFields = fields.filter(
    (f) => f.type !== 'image' && f.isActive !== false
  );
  const headerFields = displayFields.filter((f) => f.showInHeader);
  const otherFields = displayFields.filter((f) => !f.showInHeader);

  const today = new Date().toLocaleDateString('default', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <WidgetCard
      title="Item of the Day"
      icon={Shuffle}
      loading={loading}
      onRemove={onRemove}
    >
      {!item ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No items in this collection yet
        </p>
      ) : (
        <div className="space-y-3">
          {/* Date badge */}
          <p className="text-xs text-muted-foreground">{today}</p>

          {/* Image */}
          {imageUrl && (
            <div className={`rounded-xl overflow-hidden bg-muted w-full ${
              imageOrientation === 'portrait' ? 'aspect-[3/4]' :
              imageOrientation === 'square'   ? 'aspect-square' :
                                               'aspect-[4/3]'
            }`}>
              <img
                src={imageUrl}
                alt="Item"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Header fields (bold/prominent) */}
          {headerFields.map((field) => {
            const value = getFieldValue(field, item.properties);
            if (!value) return null;
            return (
              <div key={field._id}>
                <p className="text-base font-semibold leading-snug">{value}</p>
                <p className="text-xs text-muted-foreground">{field.long}</p>
              </div>
            );
          })}

          {/* Other fields */}
          {otherFields.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 border-t">
              {otherFields.map((field) => {
                const value = getFieldValue(field, item.properties);
                if (!value) return null;
                return (
                  <div key={field._id} className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{field.long}</p>
                    <p className="text-sm font-medium truncate">{value}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Link to item */}
          <button
            onClick={() => navigate(`/collections/${collectionName}/items/${item._id}/edit`)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            <ExternalLink className="h-3 w-3" />
            View item
          </button>
        </div>
      )}
    </WidgetCard>
  );
}