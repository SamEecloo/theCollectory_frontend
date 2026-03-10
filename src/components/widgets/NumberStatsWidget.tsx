import { useEffect, useState } from 'react';
import { Hash, Loader2 } from 'lucide-react';
import ProgressBar from './ProgressBar';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import WidgetCard from './WidgetCard';

type Field = {
  _id: string;
  long: string;
  type: string;
  isActive?: boolean;
};

type GroupedData = {
  period: string;
  sum: number;
};

type StatsData = {
  total: number;
  count: number;
  average: number;
  min: number;
  max: number;
  grouped?: GroupedData[];
};

type ActiveConfig = {
  numberFieldId: string;
  dateFieldId: string;
  groupBy: 'none' | 'month' | 'year';
};

type Props = {
  collectionId?: string;
  collectionName?: string;
  config?: {
    numberFieldId?: string;
    dateFieldId?: string;
    groupBy?: 'none' | 'month' | 'year';
  };
  onConfigChange?: (config: any) => void;
  onRemove?: () => void;
};

const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping (total only)' },
  { value: 'month', label: 'Group by month' },
  { value: 'year', label: 'Group by year' },
];

export default function NumberStatsWidget({
  collectionId,
  collectionName,
  config = {},
  onConfigChange,
  onRemove,
}: Props) {
  const [numberFields, setNumberFields] = useState<Field[]>([]);
  const [dateFields, setDateFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Draft settings — live in the settings dialog, only committed on Save
  const [draftNumberFieldId, setDraftNumberFieldId] = useState(config.numberFieldId || '');
  const [draftDateFieldId, setDraftDateFieldId] = useState(config.dateFieldId || '');
  const [draftGroupBy, setDraftGroupBy] = useState<'none' | 'month' | 'year'>(config.groupBy || 'none');

  // Active settings — what the widget actually uses to fetch data.
  // Stored as a single object so they always update atomically, preventing
  // fetchStats from firing with a stale groupBy after a save.
  const [active, setActive] = useState<ActiveConfig>({
    numberFieldId: config.numberFieldId || '',
    dateFieldId: config.dateFieldId || '',
    groupBy: config.groupBy || 'none',
  });

  // Fetch collection fields on mount
  useEffect(() => {
    if (!collectionName) return;

    const fetchCollection = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/collections/${collectionName}`);
        const fields: Field[] = response.data.config.fields.filter(
          (f: Field) => f.isActive !== false
        );

        setNumberFields(fields.filter((f) => f.type === 'number'));
        setDateFields(fields.filter((f) => f.type === 'date'));

        const numbers = fields.filter((f) => f.type === 'number');

        // Auto-select the number field only if none is saved in config yet
        if (!config.numberFieldId && numbers.length === 1) {
          setDraftNumberFieldId(numbers[0]._id);
          setActive((prev) => ({ ...prev, numberFieldId: numbers[0]._id }));
        }
      } catch (err) {
        console.error('Failed to fetch collection:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionName]);

  // Fetch stats whenever active config or collectionId changes
  useEffect(() => {
    if (!active.numberFieldId || !collectionId) return;

    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const params: Record<string, string> = {
          collectionId,
          numberFieldId: active.numberFieldId,
        };

        if (active.dateFieldId && active.groupBy !== 'none') {
          params.dateFieldId = active.dateFieldId;
          params.groupBy = active.groupBy;
        }

        const response = await api.get('/stats/number-stats', { params });
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch number stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [active, collectionId]);

  const handleSaveSettings = () => {
    const newActive: ActiveConfig = {
      numberFieldId: draftNumberFieldId,
      dateFieldId: draftDateFieldId,
      groupBy: draftGroupBy,
    };
    // Single state update — fetchStats will see all three values together
    setActive(newActive);
    onConfigChange?.(newActive);
  };

  const activeNumberField = numberFields.find((f) => f._id === active.numberFieldId);
  const activeDateField = dateFields.find((f) => f._id === active.dateFieldId);

  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value % 1 === 0 ? value.toString() : value.toFixed(2);
  };

  const settingsContent = (
    <div className="space-y-4">
      {/* Number field */}
      <div className="space-y-2">
        <Label>Number Field</Label>
        {numberFields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No number fields in this collection</p>
        ) : (
          <Select
            value={draftNumberFieldId || '__none__'}
            onValueChange={(v) => setDraftNumberFieldId(v === '__none__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a number field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select a field</SelectItem>
              {numberFields.map((f) => (
                <SelectItem key={f._id} value={f._id}>
                  {f.long}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date field (optional) — createdAt always available, plus any collection date fields */}
      <>
        <div className="space-y-2">
          <Label>Date Field (optional)</Label>
          <Select
            value={draftDateFieldId || '__none__'}
            onValueChange={(v) => setDraftDateFieldId(v === '__none__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None — total only" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None — total only</SelectItem>
              <SelectItem value="__createdAt__">Date added</SelectItem>
              {dateFields.map((f) => (
                <SelectItem key={f._id} value={f._id}>
                  {f.long}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {draftDateFieldId && (
          <div className="space-y-2">
            <Label>Group By</Label>
            <Select
              value={draftGroupBy}
              onValueChange={(v) => setDraftGroupBy(v as 'none' | 'month' | 'year')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </>
    </div>
  );

  return (
    <WidgetCard
      title={activeNumberField ? `${activeNumberField.long} Stats` : 'Number Stats'}
      icon={Hash}
      loading={loading}
      onRemove={onRemove}
      hasSettings
      settingsTitle="Number Stats Settings"
      settingsDescription="Choose a number field to summarize, and optionally group by a date field."
      settingsContent={settingsContent}
      onSaveSettings={handleSaveSettings}
      settingsDisabled={!draftNumberFieldId}
    >
      {!active.numberFieldId && numberFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No number fields in this collection
        </p>
      )}

      {!active.numberFieldId && numberFields.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Open settings to choose a number field
        </p>
      )}

      {active.numberFieldId && (
        <div className="space-y-4">
          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !stats ? null : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total', value: stats.total, large: true },
                  { label: 'Average', value: stats.average, large: true },
                  { label: 'Min', value: stats.min, large: false },
                  { label: 'Max', value: stats.max, large: false },
                ].map(({ label, value, large }) => (
                  <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`font-bold ${large ? 'text-2xl' : 'text-xl'}`}>
                      {formatValue(value)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Based on {stats.count} item{stats.count !== 1 ? 's' : ''}
              </p>

              {/* Grouped breakdown */}
              {stats.grouped && stats.grouped.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    By {active.groupBy === 'month' ? 'Month' : 'Year'}
                    {active.dateFieldId === '__createdAt__' ? ' (Date added)' : activeDateField ? ` (${activeDateField.long})` : ''}
                  </p>
                  {(() => {
                    const maxVal = Math.max(...stats.grouped!.map((d) => d.sum), 1);
                    return stats.grouped!.map((item) => {
                      const barPct = (item.sum / maxVal) * 100;
                      return (
                        <div key={item.period} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.period}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {formatValue(item.sum)}
                            </span>
                          </div>
                          <ProgressBar
                            percentage={barPct}
                            label={`${Math.round(item.sum/stats.total * 100)}%`}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </WidgetCard>
  );
}