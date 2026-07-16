"use client";

import { Button, Container, Section } from "@silonya/ui";
import { useState } from "react";

type Period = "daily" | "weekly" | "monthly";

const PERIODS: { value: Period; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function ReportsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  function downloadUrl(period: Period, format: "csv" | "xlsx"): string {
    return `/api/reports?period=${period}&format=${format}&date=${date}`;
  }

  return (
    <Section spacing="lg" tone="transparent" container={false}>
      <Container>
        <h1 className="font-display text-ink mb-2 text-2xl">Reports</h1>
        <p className="text-stone mb-6 font-sans text-sm">
          Revenue, orders, new customers, and top products for the selected period.
        </p>

        <div className="mb-8 flex items-center gap-3">
          <label htmlFor="report-date" className="text-ink font-sans text-sm">
            Anchor date
          </label>
          <input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
            className="border-mist h-11 border px-3 font-sans text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PERIODS.map((period) => (
            <div key={period.value} className="border-mist flex flex-col gap-3 border p-4">
              <h2 className="font-display text-ink text-lg">{period.label}</h2>
              <div className="flex gap-2">
                <Button asChild variant="secondary" size="sm">
                  <a href={downloadUrl(period.value, "csv")}>CSV</a>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <a href={downloadUrl(period.value, "xlsx")}>Excel</a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
