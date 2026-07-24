import { Card, CardContent } from "@silonya/ui";

/** Shared KPI-tile pattern used on both the dashboard overview and the analytics page. */
export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-stone font-sans text-xs uppercase tracking-wide">{label}</p>
        <p className="text-ink font-display mt-1 text-2xl">{value}</p>
        {sub ? <p className="text-stone mt-1 font-sans text-xs">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
