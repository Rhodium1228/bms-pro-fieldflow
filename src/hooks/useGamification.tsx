import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GamificationData {
  xp: number;
  level: number;
  streak: number;
  lastClockIn: string | null;
  achievements: string[];
}

export const useGamification = () => {
  const [data, setData] = useState<GamificationData>({
    xp: 0,
    level: 1,
    streak: 0,
    lastClockIn: null,
    achievements: [],
  });

  useEffect(() => {
    loadGamificationData();
  }, []);

  const loadGamificationData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const stored = localStorage.getItem(`gamification_${user.id}`);
    if (stored) {
      setData(JSON.parse(stored));
    }
  };

  const saveData = (newData: GamificationData) => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        localStorage.setItem(`gamification_${user.id}`, JSON.stringify(newData));
        setData(newData);
      }
    });
  };

  const addXP = (amount: number) => {
    const xpToNextLevel = data.level * 100;
    const newXP = data.xp + amount;
    
    if (newXP >= xpToNextLevel) {
      const newLevel = data.level + 1;
      saveData({ ...data, xp: newXP - xpToNextLevel, level: newLevel });
      return { leveledUp: true, newLevel };
    } else {
      saveData({ ...data, xp: newXP });
      return { leveledUp: false };
    }
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (data.lastClockIn === yesterday) {
      saveData({ ...data, streak: data.streak + 1, lastClockIn: today });
    } else if (data.lastClockIn !== today) {
      saveData({ ...data, streak: 1, lastClockIn: today });
    }
  };

  const addAchievement = (achievement: string) => {
    if (!data.achievements.includes(achievement)) {
      saveData({ ...data, achievements: [...data.achievements, achievement] });
      return true;
    }
    return false;
  };

  const xpToNextLevel = data.level * 100;

  return {
    ...data,
    xpToNextLevel,
    addXP,
    updateStreak,
    addAchievement,
  };
};
