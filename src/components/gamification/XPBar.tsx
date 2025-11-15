import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";

interface XPBarProps {
  currentXP: number;
  level: number;
  xpToNextLevel: number;
}

export const XPBar = ({ currentXP, level, xpToNextLevel }: XPBarProps) => {
  const progress = (currentXP / xpToNextLevel) * 100;

  return (
    <div className="space-y-2 animate-slide-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(var(--level-badge))]" />
          <span className="text-sm font-semibold">Level {level}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {currentXP} / {xpToNextLevel} XP
        </span>
      </div>
      <Progress 
        value={progress} 
        className="h-3 bg-secondary"
      />
    </div>
  );
};
