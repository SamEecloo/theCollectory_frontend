import { useEffect, useState } from 'react';
import { Tags, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import WidgetCard from './WidgetCard';
import ProgressBar from './ProgressBar';
import { setTagFilter } from '@/lib/filterUtils';

type TagData = {
  tag: string;
  count: number;
};

type Field = {
  _id: string;
  long: string;
  type: string;
  isActive?: boolean;
};

type Props = {
  collectionId?: string;
  collectionName?: string;
  config?: {
    fieldId?: string;
    limit?: number;
  };
  onConfigChange?: (config: any) => void;
  onRemove?: () => void;
};

export default function TagsDistributionWidget({ 
  collectionId,
  collectionName,
  config = {},
  onConfigChange,
  onRemove 
}: Props) {
  const navigate = useNavigate();
  const { fieldId: configFieldId, limit: configLimit } = config;
  
  const [tagFields, setTagFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<string>(configFieldId || '');
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTags, setLoadingTags] = useState(false);
  const [limit, setLimit] = useState(configLimit || 10);

  // Fetch collection and extract tag fields
  useEffect(() => {
    if (!collectionName) return;

    const fetchCollection = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/collections/${collectionName}`);
        
        const tagFieldsList = response.data.config.fields.filter(
          (f: Field) => f.type === 'tags' && f.isActive !== false
        );
        
        setTagFields(tagFieldsList);
        
        // Auto-select field
        if (configFieldId && tagFieldsList.some((f: Field) => f._id === configFieldId)) {
          setSelectedField(configFieldId);
        } else if (tagFieldsList.length === 1) {
          setSelectedField(tagFieldsList[0]._id);
        }
      } catch (err) {
        console.error('Failed to fetch collection:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionName, configFieldId]);

  // Fetch tags distribution
  useEffect(() => {
    if (!selectedField || !collectionId) return;

    const fetchTags = async () => {
      try {
        setLoadingTags(true);
        const response = await api.get('/stats/tags-distribution', {
          params: { collectionId, fieldId: selectedField, limit },
        });
        setTags(response.data);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, [selectedField, collectionId, limit]);

  const handleTagClick = (tag: string) => {
    if (!collectionId || !selectedField) return;
    setTagFilter(collectionId, collectionName!, selectedField, tag, false, navigate);
  };

  const handleSaveSettings = () => {
    onConfigChange?.({
      fieldId: selectedField,
      limit,
    });
  };

  const selectedFieldData = tagFields.find(f => f._id === selectedField);
  const maxCount = Math.max(...tags.map(t => t.count), 1);
  const totalCount = tags.reduce((sum, t) => sum + t.count, 0);

  const FieldSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-2">
      <Label>Tag Field</Label>
      <Select 
        value={value || "__none__"} 
        onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a field" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Select a field</SelectItem>
          {tagFields.map((field) => (
            <SelectItem key={field._id} value={field._id}>
              {field.long}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const settingsContent = (
    <div className="space-y-4">
      {tagFields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tag fields in this collection
        </p>
      ) : (
        <>
          <FieldSelector value={selectedField} onChange={setSelectedField} />

          <div className="space-y-2">
            <Label>Number of tags to show</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="15">Top 15</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );

  return (
    <WidgetCard
      title={selectedFieldData ? `Top ${selectedFieldData.long}` : 'Most Used Tags'}
      icon={Tags}
      loading={loading}
      onRemove={onRemove}
      hasSettings={true}
      settingsTitle="Most Used Tags Settings"
      settingsDescription="Configure which tag field to display and how many to show."
      settingsContent={settingsContent}
      onSaveSettings={handleSaveSettings}
      settingsDisabled={!selectedField}
    >
      {/* No tag fields */}
      {!selectedField && tagFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No tag fields in this collection
        </p>
      )}

      {/* Field selector (before selection) */}
      {!selectedField && tagFields.length > 0 && (
        <FieldSelector value={selectedField} onChange={setSelectedField} />
      )}

      {/* Tags distribution */}
      {selectedField && (
        <div className="space-y-3">
          {loadingTags ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags for {selectedFieldData?.long}
            </p>
          ) : (
            <>
              <h4 className="text-sm font-semibold">
                Top {limit} {selectedFieldData?.long}
              </h4>
              {tags.map((item, index) => (
                <div key={item.tag} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <button
                      onClick={() => handleTagClick(item.tag)}
                      className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer group"
                    >
                      <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                      <span className="font-medium group-hover:underline">{item.tag}</span>
                    </button>
                    <span className="text-muted-foreground">
                      {item.count} use{item.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ProgressBar
                    percentage={(item.count / maxCount) * 100}
                    label={`${Math.round((item.count / totalCount) * 100)}%`}
                  />
                </div>
              ))}
              <div className="pt-2 border-t text-sm text-muted-foreground">
                Total uses: {totalCount}
              </div>
            </>
          )}
        </div>
      )}
    </WidgetCard>
  );
}