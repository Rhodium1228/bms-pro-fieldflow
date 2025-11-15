import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GamificationData {
  xp: number;
  level: number;
  streak: number;
  lastClockIn: string | null;
  achievements: string[];
}

interface AchievementInfo {
  id: string;
  name: string;
  description: string;
  requirement: string;
}

const ACHIEVEMENTS: Record<string, AchievementInfo> = {
  task_master: {
    id: 'task_master',
    name: 'Task Master',
    description: 'Complete your first job successfully',
    requirement: 'Complete 1 job',
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Clock in on time 5 times',
    requirement: 'Clock in on time 5 times',
  },
  perfect_week: {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: 'Maintain a 5-day streak',
    requirement: '5-day streak',
  },
  five_star: {
    id: 'five_star',
    name: '5-Star Technician',
    description: 'Complete 20 jobs successfully',
    requirement: 'Complete 20 jobs',
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete 5 jobs ahead of schedule',
    requirement: 'Complete 5 jobs early',
  },
};

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
      return { leveledUp: true, newLevel, newXP: newXP - xpToNextLevel };
    } else {
      saveData({ ...data, xp: newXP });
      return { leveledUp: false, newXP };
    }
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    let newStreak = data.streak;
    
    if (data.lastClockIn === yesterday) {
      newStreak = data.streak + 1;
      saveData({ ...data, streak: newStreak, lastClockIn: today });
      
      // Check for Perfect Week achievement
      if (newStreak >= 5 && !data.achievements.includes('perfect_week')) {
        addAchievement('perfect_week');
      }
    } else if (data.lastClockIn !== today) {
      newStreak = 1;
      saveData({ ...data, streak: newStreak, lastClockIn: today });
    }
    
    return newStreak;
  };

  const addAchievement = (achievementId: string) => {
    if (!data.achievements.includes(achievementId)) {
      saveData({ ...data, achievements: [...data.achievements, achievementId] });
      return { isNew: true, achievement: ACHIEVEMENTS[achievementId] };
    }
    return { isNew: false };
  };

  const getAchievementInfo = (achievementId: string): AchievementInfo | undefined => {
    return ACHIEVEMENTS[achievementId];
  };

  const xpToNextLevel = data.level * 100;

  return {
    ...data,
    xpToNextLevel,
    addXP,
    updateStreak,
    addAchievement,
    getAchievementInfo,
    allAchievements: ACHIEVEMENTS,
  };
};
