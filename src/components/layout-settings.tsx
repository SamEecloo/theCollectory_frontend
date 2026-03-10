import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Smartphone, Image } from 'lucide-react';

type LayoutConfig = {
  desktop: {
    columns: number;
    gap: number;
  };
  mobile: {
    columns: number;
    gap: number;
  };
  itemImageOrientation: 'landscape' | 'portrait' | 'square';
};

type Props = {
  value: LayoutConfig;
  onChange: (config: LayoutConfig) => void;
};

export default function LayoutSettings({ value, onChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Layout Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="desktop">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="desktop">
              <Monitor className="h-4 w-4 mr-2" />
              Desktop
            </TabsTrigger>
            <TabsTrigger value="mobile">
              <Smartphone className="h-4 w-4 mr-2" />
              Mobile
            </TabsTrigger>
          </TabsList>

          {/* Desktop Settings */}
          <TabsContent value="desktop" className="space-y-4">
            <div className="space-y-2">
              <Label>Grid Columns</Label>
              <Select
                value={String(value.desktop.columns)}
                onValueChange={(v) => onChange({
                  ...value,
                  desktop: { ...value.desktop, columns: Number(v) }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 columns</SelectItem>
                  <SelectItem value="3">3 columns</SelectItem>
                  <SelectItem value="4">4 columns</SelectItem>
                  <SelectItem value="5">5 columns</SelectItem>
                  <SelectItem value="6">6 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gap Size</Label>
              <Select
                value={String(value.desktop.gap)}
                onValueChange={(v) => onChange({
                  ...value,
                  desktop: { ...value.desktop, gap: Number(v) }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Small (0.5rem)</SelectItem>
                  <SelectItem value="4">Medium (1rem)</SelectItem>
                  <SelectItem value="6">Large (1.5rem)</SelectItem>
                  <SelectItem value="8">Extra Large (2rem)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview Grid */}
            <div className="mt-4 p-4 border rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-2">Preview:</p>
              <div 
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${value.desktop.columns}, 1fr)`,
                  gap: `${value.desktop.gap * 0.25}rem`
                }}
              >
                {Array.from({ length: value.desktop.columns * 2 }).map((_, i) => (
                  <div 
                    key={i}
                    className="aspect-square bg-primary/20 rounded"
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Mobile Settings */}
          <TabsContent value="mobile" className="space-y-4">
            <div className="space-y-2">
              <Label>Grid Columns</Label>
              <Select
                value={String(value.mobile.columns)}
                onValueChange={(v) => onChange({
                  ...value,
                  mobile: { ...value.mobile, columns: Number(v) }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 column</SelectItem>
                  <SelectItem value="2">2 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gap Size</Label>
              <Select
                value={String(value.mobile.gap)}
                onValueChange={(v) => onChange({
                  ...value,
                  mobile: { ...value.mobile, gap: Number(v) }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Small (0.5rem)</SelectItem>
                  <SelectItem value="4">Medium (1rem)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview Grid */}
            <div className="mt-4 p-4 border rounded-lg bg-muted max-w-xs mx-auto">
              <p className="text-xs text-muted-foreground mb-2">Preview:</p>
              <div 
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${value.mobile.columns}, 1fr)`,
                  gap: `${value.mobile.gap * 0.25}rem`
                }}
              >
                {Array.from({ length: value.mobile.columns * 3 }).map((_, i) => (
                  <div 
                    key={i}
                    className="aspect-square bg-primary/20 rounded"
                  />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Item Image Orientation */}
        <div className="space-y-2 pt-4 border-t">
          <Label className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Item Image Orientation
          </Label>
          <Select
            value={value.itemImageOrientation}
            onValueChange={(v: 'landscape' | 'portrait' | 'square') => onChange({
              ...value,
              itemImageOrientation: v
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="landscape">Landscape (16:9)</SelectItem>
              <SelectItem value="portrait">Portrait (3:4)</SelectItem>
              <SelectItem value="square">Square (1:1)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls how images appear in item view/edit pages
          </p>
        </div>
      </CardContent>
    </Card>
  );
}