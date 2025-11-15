import { Flame } from "lucide-react";

interface StreakCounterProps {
  streak: number;
}

export const StreakCounter = ({ streak }: StreakCounterProps) => {
  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--streak-flame)/0.2)] to-transparent px-4 py-2 rounded-full animate-bounce-in">
      <Flame className="w-5 h-5 text-[hsl(var(--streak-flame))]" />
      <div>
        <div className="text-xs text-muted-foreground">Streak</div>
        <div className="text-lg font-bold">{streak} days</div>
      </div>
    </div>
  );
};
