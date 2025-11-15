import { useEffect, useState } from 'react';

export type NotificationType = 'achievement' | 'levelUp' | 'streakReminder' | 'general';

interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem('pushNotificationsEnabled');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pushNotificationsEnabled', enabled.toString());
  }, [enabled]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }

    return false;
  };

  const sendNotification = (type: NotificationType, config: NotificationConfig) => {
    if (!enabled || permission !== 'granted' || !('Notification' in window)) {
      return;
    }

    const notification = new Notification(config.title, {
      body: config.body,
      icon: config.icon || '/placeholder.svg',
      badge: config.badge || '/placeholder.svg',
      tag: config.tag || `bms-${type}-${Date.now()}`,
      requireInteraction: config.requireInteraction || false,
      data: { type, timestamp: Date.now() },
    });

    // Trigger vibration separately
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds if not requiring interaction
    if (!config.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }
  };

  const notifyAchievement = (achievementName: string, description: string) => {
    sendNotification('achievement', {
      title: '🏆 Achievement Unlocked!',
      body: `${achievementName}: ${description}`,
      tag: 'achievement',
      requireInteraction: true,
    });
  };

  const notifyLevelUp = (newLevel: number, xp: number) => {
    sendNotification('levelUp', {
      title: '⬆️ Level Up!',
      body: `Congratulations! You've reached Level ${newLevel} with ${xp} XP!`,
      tag: 'levelup',
      requireInteraction: true,
    });
  };

  const notifyStreakReminder = (currentStreak: number) => {
    sendNotification('streakReminder', {
      title: '🔥 Keep Your Streak Going!',
      body: currentStreak > 0 
        ? `You're on a ${currentStreak} day streak! Don't forget to clock in today.`
        : `Start a new streak by clocking in today!`,
      tag: 'streak-reminder',
    });
  };

  const scheduleStreakReminder = () => {
    // Schedule notification for next day at 8 AM
    const now = new Date();
    const tomorrow8AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      8,
      0,
      0
    );
    
    const timeUntilReminder = tomorrow8AM.getTime() - now.getTime();
    
    // Store reminder in localStorage
    const reminderId = setTimeout(() => {
      const gamificationData = localStorage.getItem('gamification_');
      if (gamificationData) {
        const data = JSON.parse(gamificationData);
        notifyStreakReminder(data.streak || 0);
      }
    }, timeUntilReminder);

    // Store the timeout ID so we can clear it if needed
    localStorage.setItem('streakReminderTimeout', reminderId.toString());
  };

  const toggleNotifications = () => {
    setEnabled(!enabled);
  };

  return {
    permission,
    enabled,
    requestPermission,
    sendNotification,
    notifyAchievement,
    notifyLevelUp,
    notifyStreakReminder,
    scheduleStreakReminder,
    toggleNotifications,
  };
};
