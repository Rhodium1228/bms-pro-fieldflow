import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const NotificationPermissionBanner = () => {
  const [show, setShow] = useState(false);
  const pushNotifications = usePushNotifications();

  useEffect(() => {
    // Show banner if notifications are enabled but permission not granted
    const dismissed = localStorage.getItem('notificationBannerDismissed');
    if (
      !dismissed &&
      'Notification' in window &&
      pushNotifications.permission === 'default' &&
      pushNotifications.enabled
    ) {
      setShow(true);
    }
  }, [pushNotifications.permission, pushNotifications.enabled]);

  const handleEnable = async () => {
    const granted = await pushNotifications.requestPermission();
    if (granted) {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notificationBannerDismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <Card className="glass neuro-shadow p-4 mb-4 animate-slide-in border-primary/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-1">Enable Notifications</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Get notified about achievements, level ups, and daily streak reminders to stay motivated!
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleEnable}
              size="sm"
              className="hover:scale-105 transition-transform"
            >
              Enable Notifications
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="hover:scale-105 transition-transform"
            >
              Maybe Later
            </Button>
          </div>
        </div>
        <Button
          onClick={handleDismiss}
          size="icon"
          variant="ghost"
          className="flex-shrink-0 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
