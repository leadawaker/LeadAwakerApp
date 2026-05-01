import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface CadenceDailyProgressProps {
  queue: any[];
  todayContactCount: number;
}

const DAILY_GOAL = 20;

function getStepCounts(queue: any[]) {
  return queue.reduce(
    (acc, item) => {
      const step = item.sequence_step ?? 1;
      if (step === 1) acc[1]++;
      else if (step === 2) acc[2]++;
      else if (step === 3) acc[3]++;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0 } as Record<number, number>,
  );
}

function hasOverdue(queue: any[]): boolean {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return queue.some((item) => {
    const due = item.next_follow_up_date ? new Date(item.next_follow_up_date) : null;
    return due && due < todayStart;
  });
}

export function CadenceDailyProgress({ queue, todayContactCount }: CadenceDailyProgressProps) {
  const steps = getStepCounts(queue);
  const overdue = hasOverdue(queue);
  const pct = Math.min(100, Math.round((todayContactCount / DAILY_GOAL) * 100));

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-card rounded-full border border-border/30">
      {/* Progress bar + count */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {todayContactCount}
          <span className="text-muted-foreground font-normal"> / {DAILY_GOAL} today</span>
        </span>
        <Progress value={pct} className="h-1.5 w-24 shrink-0" />
      </div>

      {/* Step breakdown chips */}
      <div className="flex items-center gap-1.5">
        {([1, 2, 3] as const).map((s) => (
          <span
            key={s}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-muted text-muted-foreground",
            )}
          >
            Step {s}: {steps[s]}
          </span>
        ))}
      </div>

      {/* Overdue badge */}
      {overdue && (
        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          Overdue
        </span>
      )}
    </div>
  );
}
