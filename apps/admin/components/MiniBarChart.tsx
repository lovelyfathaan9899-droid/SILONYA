"use client";

/** Dependency-free bar chart — deliberately not a charting library (ADMIN_PANEL.md §4.1's "not a full BI tool"; deep analytics live in PostHog). Height is proportional to the max value in the series. */
export function MiniBarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((point, i) => (
        <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
          <div
            className="bg-ink w-full min-w-[2px] transition-opacity group-hover:opacity-70"
            style={{ height: `${String(Math.max(2, (point.value / max) * 100))}%` }}
            title={`${point.label}: ${formatValue ? formatValue(point.value) : String(point.value)}`}
          />
        </div>
      ))}
    </div>
  );
}
