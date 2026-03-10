import { Table2, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'table' | 'grid';

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  options?: ViewMode[];
};

const ICONS: Record<ViewMode, React.ReactNode> = {
  table:  <Table2  className="h-4 w-4" />,
  grid:   <Grid3x3 className="h-4 w-4" />,
};

const LABELS: Record<ViewMode, string> = {
  table:  'Table view',
  grid:   'Grid view',
};

export default function ViewToggle({
  value,
  onChange,
  options = ['table', 'grid'],
}: Props) {
  return (
    <div className="inline-flex items-center rounded-md border bg-background p-1">
      {options.map((mode) => (
        <button
          key={mode}
          type="button"
          aria-label={LABELS[mode]}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
            value === mode
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {ICONS[mode]}
        </button>
      ))}
    </div>
  );
}