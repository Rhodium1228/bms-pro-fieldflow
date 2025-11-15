import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

export const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.id);
    
    if (notification.related_job_id) {
      setIsOpen(false);
      navigate(`/tasks/${notification.related_job_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "job_assigned":
        return "📋";
      case "job_reassigned":
        return "🔄";
      case "job_completed":
        return "✅";
      default:
        return "ℹ️";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "You're all caught up!"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="w-full"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3 pr-4">
              {notifications.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No notifications yet</p>
                </Card>
              ) : (
                notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                      !notification.read ? "border-primary/50 bg-primary/5" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
