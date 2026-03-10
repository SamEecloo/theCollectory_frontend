type ProgressBarProps = {
  percentage: number; // 0–100, controls bar width
  label: string;      // text shown on the right
};

/**
 * A progress bar where the label colour flips between white (on the filled
 * section) and the default foreground colour (on the empty section).
 *
 * The threshold is set at 15% — below that the bar is too narrow to
 * comfortably contain even a short label, so the text stays outside (dark).
 */
export default function ProgressBar({ percentage, label }: ProgressBarProps) {
  const clampedPct = Math.min(100, Math.max(0, percentage));

  return (
    <div className="relative bg-muted rounded-full h-6 overflow-hidden">
      {/* Filled section */}
      <div
        className="bg-primary h-full rounded-full transition-all duration-300"
        style={{ width: `${clampedPct}%` }}
      />

      {/* Label — always absolutely positioned at the right edge */}
      <div className="absolute inset-0 flex items-center justify-end pr-2">
        <span
          className="text-xs font-medium transition-colors duration-300"
          style={{ mixBlendMode: 'difference'}}
        >
          {label}
        </span>
      </div>
    </div>
  );
}