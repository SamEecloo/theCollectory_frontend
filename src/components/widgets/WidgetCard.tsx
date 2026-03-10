// widgetcard.tsx
import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, X, Loader2, type LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type WidgetCardProps = {
  title: string;
  icon?: LucideIcon;
  loading?: boolean;
  loadingContent?: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
  hasSettings?: boolean;
  settingsTitle?: string;
  settingsDescription?: string;
  settingsContent?: ReactNode;
  onSaveSettings?: () => void;
  settingsDisabled?: boolean;
};

export default function WidgetCard({
  title,
  icon: Icon,
  loading = false,
  children,
  onRemove,
  hasSettings = false,
  settingsTitle = 'Widget Settings',
  settingsDescription,
  settingsContent,
  onSaveSettings,
  settingsDisabled = false,
}: WidgetCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const handleSaveSettings = () => {
    if (onSaveSettings) {
      onSaveSettings();
    }
    setSettingsOpen(false);
  };
  return (
    <>
      <Card 
        className="border rounded-2xl"
      >
        <CardContent className="p-0">
          <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
            <div className="flex items-center justify-between px-4 py-3">
          
              {/* Title with collapse trigger */}
              <CollapsibleTrigger asChild className="cursor-pointer flex-1">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left ml-2"
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  <strong className="text-sm">{title}</strong>
                </button>
              </CollapsibleTrigger>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {hasSettings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <CollapsibleContent>
              <div className="px-4 pb-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  children
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      {hasSettings && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{settingsTitle}</DialogTitle>
              {settingsDescription && (
                <DialogDescription>{settingsDescription}</DialogDescription>
              )}
            </DialogHeader>

            {settingsContent}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={settingsDisabled}>
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}