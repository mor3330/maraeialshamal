"use client";

interface Props {
  branchName: string;
  cashierName?: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
}

const STEPS = [
  "الوارد",
  "المبيعات",
  "تفاصيل المبيعات",
  "الصادر",
  "المتبقي",
  "الأموال",
  "المراجعة",
];

export default function CashierHeader({ branchName, cashierName, step, totalSteps, stepLabel }: Props) {
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-card border-b border-line px-4 pt-4 pb-0">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-muted text-xs">مراعي الشمال · الإقفال اليومي</span>
        </div>
        {cashierName && (
          <span className="text-green text-xs font-medium">الكاشير: {cashierName} ✓</span>
        )}
      </div>

      {/* Branch & date */}
      <div className="mb-3">
        <h1 className="text-cream text-2xl font-bold">{branchName}</h1>
        <p className="text-muted text-xs">{today}</p>
      </div>

      {/* Step indicator */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted text-xs">الخطوة {step} من {totalSteps} · {stepLabel}</span>
          <span className="text-muted text-xs">{Math.round((step / totalSteps) * 100)}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-green rounded-full transition-all duration-500"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex justify-between mt-2 px-1" dir="ltr">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i + 1 < step
                  ? "bg-green"
                  : i + 1 === step
                  ? "bg-green ring-2 ring-green/30 scale-125"
                  : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
