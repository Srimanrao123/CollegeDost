import { useEffect, useState } from "react";
import { Loader2, Check, Bell, BellOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

const NotificationsUpdated = () => {
  const { user } = useAuth();
  const { notifications, loading, markAllAsRead, markAsRead } = useNotifications(user?.id);
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);

    // Navigate based on notification type
    if (notification.type === "Update Profile" || notification.type === "Profile Incomplete") {
      navigate('/profile');
    } else if (notification.related_post_id) {
      navigate(`/post/${notification.related_post_id}`);
    } else if (notification.related_user_id) {
      navigate(`/profile/${notification.related_user_id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <Button variant="ghost" size="sm" className="gap-2" onClick={markAllAsRead}>
            <Check className="h-4 w-4" />
            Mark all
          </Button>
        </div>

        <div className="space-y-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer ${
                  !notification.read ? "bg-secondary/30" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1">
                      {notification.type}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default NotificationsUpdated;
