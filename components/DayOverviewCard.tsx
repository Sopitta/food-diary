import { DAILY_CALORIE_GOAL } from "@/lib/meals/grouping";
import type { MealTotals } from "@/lib/meals/types";
import { DrumstickIcon, WheatIcon, DropletIcon } from "./icons";

const RING_SIZE = 88;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function DayOverviewCard({ totals }: { totals: MealTotals }) {
  const consumed = Math.round(totals.calories);
  const remaining = DAILY_CALORIE_GOAL - consumed;
  const percent = Math.min(Math.max(consumed / DAILY_CALORIE_GOAL, 0), 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - percent);

  return (
    <div className="rounded-2xl border-2 border-ink bg-paper-soft">
      <div className="flex items-center gap-4 p-4">
        <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="-rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-paper-dark)"
              strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={RING_STROKE}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-extrabold leading-none">{consumed}</span>
            <span className="mt-1 text-[10px] font-semibold tracking-wide text-ink/60">KCAL</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-lg font-bold leading-tight">
            {remaining >= 0 ? `${remaining} kcal remaining` : `${Math.abs(remaining)} kcal over`}
          </p>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-dark">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${Math.round(percent * 100)}%` }}
            />
          </div>
          <p className="text-xs text-ink/60">Goal: {DAILY_CALORIE_GOAL} kcal</p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x-2 divide-ink border-t-2 border-ink">
        <MacroStat Icon={DrumstickIcon} value={Math.round(totals.protein)} label="Protein" />
        <MacroStat Icon={WheatIcon} value={Math.round(totals.carbs)} label="Carbs" />
        <MacroStat Icon={DropletIcon} value={Math.round(totals.fat)} label="Fat" />
      </div>
    </div>
  );
}

function MacroStat({
  Icon,
  value,
  label,
}: {
  Icon: (props: { className?: string }) => React.JSX.Element;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <Icon className="text-ink/70" />
      <span className="text-base font-extrabold leading-none">{value}g</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/60">{label}</span>
    </div>
  );
}
