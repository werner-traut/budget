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
    start_date: period
      ? formatDateForDisplay(period.start_date)
      : formatDateForDisplay(new Date()),
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
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
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded"
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
              <label className="block text-sm font-medium mb-1">
                Salary Amount
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full p-2 border rounded"
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
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
