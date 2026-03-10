import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import WidgetCard from './WidgetCard';

type RecentItem = {
  _id: string;
  collectionId: string;
  collectionName: string;
  collectionConfig?: any;
  properties: Record<string, any>;
  createdAt: string;
};

type Field = {
  _id: string;
  long: string;
  type: string;
  isActive?: boolean;
  options?: Array<{ _id: string; long: string; short: string }>;
};

type Props = {
  collectionId?: string;
  collectionName?: string;
  config?: {
    fieldId?: string;
    secondaryFieldId?: string;
    limit?: number;
  };
  onConfigChange?: (config: any) => void;
  onRemove?: () => void;
};

export default function RecentItemsWidget({ 
  collectionId,
  collectionName,
  config = {}, 
  onConfigChange, 
  onRemove 
}: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { fieldId: configFieldId, secondaryFieldId: configSecondaryFieldId, limit: configLimit } = config;
  
  // Settings state
  const [collection, setCollection] = useState<any>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState(configFieldId || '');
  const [selectedSecondaryField, setSelectedSecondaryField] = useState(configSecondaryFieldId || '');
  const [limit, setLimit] = useState(configLimit || 10);

  useEffect(() => {
    if (collectionName && !collection) {
      fetchCollection();
    }
  }, [collectionName]);
  // Fetch recent items when config or collectionId changes
  useEffect(() => {
    const fetchRecentItems = async () => {
      console.log(collectionId);
      if (!collection && !collectionId) return;
      try {
        setLoading(true);
        const response = await api.get('/stats/recent-items', { 
          params: { 
            limit: configLimit || 10,
            collectionId 
          } 
        });
        setItems(response.data);
      } catch (err) {
        console.error('Failed to fetch recent items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentItems();
  }, [configFieldId, configSecondaryFieldId, configLimit, collectionId]);

  // Fetch collection data for settings
  const fetchCollection = async () => {
    if (!collectionName) return;
    
    try {
      const response = await api.get(`/collections/${collectionName}`);
      setCollection(response.data);
      setFields(response.data.config.fields.filter((f: Field) => f.isActive !== false));
    } catch (err) {
      console.error('Failed to fetch collection:', err);
    }
  };

  const handleSaveSettings = () => {
    onConfigChange?.({
      fieldId: selectedField || undefined,
      secondaryFieldId: selectedSecondaryField || undefined,
      limit,
    });
  };

  const getDisplayValue = (item: RecentItem) => {
    const props = item.properties;
    let fieldIdToUse = configFieldId;
    
    // Use default sort field if no field specified
    if (!fieldIdToUse && item.collectionConfig?.defaultSort?.fieldId) {
      fieldIdToUse = item.collectionConfig.defaultSort.fieldId;
    }
    
    if (fieldIdToUse && props[fieldIdToUse]) {
      const value = props[fieldIdToUse];
      
      // Handle dropdown fields
      if (item.collectionConfig) {
        const field = item.collectionConfig.fields?.find(
          (f: Field) => f._id === fieldIdToUse
        );
        
        if (field?.type === 'dropdown') {
          const option = field.options?.find((opt: { _id: string; long: string; short: string }) => String(opt._id) === String(value));
          return option?.long || option?.short || value;
        }
      }
      
      return value;
    }
    
    // Fallback to first property
    return Object.values(props)[0] || 'Untitled';
  };

  const getSecondaryDisplayValue = (item: RecentItem) => {
    if (!configSecondaryFieldId) return null;
    
    const props = item.properties;
    const value = props[configSecondaryFieldId];
    
    if (!value) return null;

    // Handle dropdown fields
    if (collection) {
      const field = collection.config.fields.find(
        (f: Field) => f._id === configSecondaryFieldId
      );
      
      if (field?.type === 'dropdown') {
        const option = field.options?.find((opt: { _id: string; long: string; short: string }) => String(opt._id) === String(value));
        return option?.long || option?.short || value;
      }
    }
    
    return value;
  };

  const settingsContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Primary Display Field</Label>
        <Select 
          value={selectedField || "__default__"}
          onValueChange={(v) => setSelectedField(v === "__default__" ? "" : v)}
          onOpenChange={(open) => {
            if (open && !collection) fetchCollection();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Default sort field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Default sort field</SelectItem>
            {fields
              .filter((field) => ['text', 'dropdown'].includes(field.type))
              .map((field) => (
                <SelectItem key={field._id} value={field._id}>
                  {field.long}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Leave empty to use the collection's default sort field
        </p>
      </div>

      <div className="space-y-2">
        <Label>Secondary Display Field (optional)</Label>
        <Select 
          value={selectedSecondaryField || "__none__"}
          onValueChange={(v) => setSelectedSecondaryField(v === "__none__" ? "" : v)}
          onOpenChange={(open) => {
            if (open && !collection) fetchCollection();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {fields
              .filter((field) => ['text', 'dropdown'].includes(field.type))
              .map((field) => (
                <SelectItem key={field._id} value={field._id}>
                  {field.long}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Shows below the primary field
        </p>
      </div>

      <div className="space-y-2">
        <Label>Number of items</Label>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="15">15</SelectItem>
            <SelectItem value="20">20</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <WidgetCard
      title="Recent Items"
      icon={Timer}
      loading={loading}
      onRemove={onRemove}
      hasSettings={true}
      settingsTitle="Recent Items Settings"
      settingsDescription="Configure how recent items are displayed in this widget."
      settingsContent={settingsContent}
      onSaveSettings={handleSaveSettings}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const secondaryValue = getSecondaryDisplayValue(item);
            
            return (
              <div
                key={item._id}
                className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer transition-colors"
                onClick={() => navigate(`/collections/${collectionName}/items/${item._id}/edit`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getDisplayValue(item)}
                  </p>
                  {secondaryValue && (
                    <p className="text-xs text-muted-foreground truncate">
                      {secondaryValue}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}