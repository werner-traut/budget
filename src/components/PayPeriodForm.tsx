import { PayPeriod, PeriodType } from "@/types/periods";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatDateForAPI, formatDateForDisplay } from "@/lib/utils/date";

export default function PayPeriodForm({
  period,
  onSubmit,
  onClose,
  periodType,
}: {
  period?: PayPeriod | null;
  onSubmit: (period: Partial<PayPeriod>) => Promise<void>;
  onClose: () => void;
  periodType: PeriodType;
}) {
  const [formData, setFormData] = useState({
    period_type: periodType, // Use the provided periodType instead of defaulting
    start_date: formatDateForDisplay(period?.start_date ?? new Date()),
    salary_amount: period?.salary_amount || 0,
    id: period?.id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ...formData,
      start_date: formatDateForAPI(formData.start_date),
    });
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] flex items-center justify-center z-50 animate-in fade-in duration-200">
      <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
        <CardHeader>
          <CardTitle>
            {period ? "Edit Period" : `New ${periodType.replace("_", " ")}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Remove the period type select since it's now fixed */}
            <input
              type="hidden"
              name="period_type"
              value={formData.period_type}
            />

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    start_date: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                Salary Amount
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring"
                value={formData.salary_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    salary_amount: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
