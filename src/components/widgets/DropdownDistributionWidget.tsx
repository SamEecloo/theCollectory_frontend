import { useEffect, useState } from 'react';
import { PieChart, Loader2 } from 'lucide-react';
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
import ProgressBar from './ProgressBar';

type DistributionData = {
  optionId: string;
  optionLabel: string;
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
  };
  onConfigChange?: (config: any) => void;
  onRemove?: () => void;
};

export default function DropdownDistributionWidget({ 
  collectionId,
  collectionName,
  config = {},
  onConfigChange,
  onRemove 
}: Props) {
  const [dropdownFields, setDropdownFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<string>(config.fieldId || '');
  const [distribution, setDistribution] = useState<DistributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDistribution, setLoadingDistribution] = useState(false);

  // Fetch collection and extract dropdown fields
  useEffect(() => {
    if (!collectionName) return;

    const fetchCollection = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/collections/${collectionName}`);
        
        const dropdowns = response.data.config.fields.filter(
          (f: Field) => f.type === 'dropdown' && f.isActive !== false
        );
        
        setDropdownFields(dropdowns);
        
        // Auto-select field
        if (config.fieldId && dropdowns.some((f: Field) => f._id === config.fieldId)) {
          setSelectedField(config.fieldId);
        } else if (dropdowns.length === 1) {
          setSelectedField(dropdowns[0]._id);
        }
      } catch (err) {
        console.error('Failed to fetch collection:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionName, config.fieldId]);

  // Fetch distribution data
  useEffect(() => {
    if (!selectedField || !collectionId) return;

    const fetchDistribution = async () => {
      try {
        setLoadingDistribution(true);
        const response = await api.get('/stats/dropdown-distribution', {
          params: { collectionId, collectionName, fieldId: selectedField },
        });
        setDistribution(response.data);
      } catch (err) {
        console.error('Failed to fetch distribution:', err);
      } finally {
        setLoadingDistribution(false);
      }
    };

    fetchDistribution();
  }, [selectedField, collectionId, collectionName]);

  const handleSaveSettings = () => {
    onConfigChange?.({ fieldId: selectedField });
  };

  const selectedFieldData = dropdownFields.find(f => f._id === selectedField);
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  const totalCount = distribution.reduce((sum, d) => sum + d.count, 0);

  const FieldSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-2">
      <Label>Dropdown Field</Label>
      <Select value={value || "__none__"} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a field" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Select a field</SelectItem>
          {dropdownFields.map((field) => (
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
      {dropdownFields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No dropdown fields in this collection
        </p>
      ) : (
        <FieldSelector 
          value={selectedField} 
          onChange={(v) => setSelectedField(v === "__none__" ? "" : v)} 
        />
      )}
    </div>
  );

  return (
    <WidgetCard
      title={`${selectedFieldData?.long || 'Dropdown'} Distribution`}
      icon={PieChart}
      loading={loading}
      onRemove={onRemove}
      hasSettings={true}
      settingsTitle="Dropdown Distribution Settings"
      settingsDescription="Select which dropdown field to display distribution for."
      settingsContent={settingsContent}
      onSaveSettings={handleSaveSettings}
      settingsDisabled={!selectedField}
    >
      {/* No dropdown fields */}
      {!selectedField && dropdownFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No dropdown fields in this collection
        </p>
      )}

      {/* Field selector (before selection) */}
      {!selectedField && dropdownFields.length > 0 && (
        <FieldSelector value={selectedField} onChange={setSelectedField} />
      )}

      {/* Distribution data */}
      {selectedField && (
        <div className="space-y-3">
          {loadingDistribution ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : distribution.length === 0 || totalCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No data for {selectedFieldData?.long}
            </p>
          ) : (
            <>
              {distribution.map((item) => (
                <div key={item.optionId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.optionLabel}</span>
                    <span className="text-muted-foreground">
                      {item.count} item{item.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ProgressBar
                    percentage={(item.count / maxCount) * 100}
                    label={`${Math.round((item.count / totalCount) * 100)}%`}
                  />
                </div>
              ))}
              <div className="pt-2 border-t text-sm text-muted-foreground">
                Total: {totalCount} items
              </div>
            </>
          )}
        </div>
      )}
    </WidgetCard>
  );
}