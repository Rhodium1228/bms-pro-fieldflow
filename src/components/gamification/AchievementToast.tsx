import { Award } from "lucide-react";
import { useEffect, useState } from "react";

interface AchievementToastProps {
  title: string;
  description: string;
  show: boolean;
  onClose: () => void;
}

export const AchievementToast = ({ title, description, show, onClose }: AchievementToastProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show && !visible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="glass neuro-shadow p-4 rounded-lg border-2 border-[hsl(var(--achievement-gold))] animate-bounce-in">
        <div className="flex items-start gap-3">
          <Award className="w-6 h-6 text-[hsl(var(--achievement-gold))] flex-shrink-0" />
          <div>
            <h4 className="font-bold text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
