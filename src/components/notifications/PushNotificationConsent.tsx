import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const PushNotificationConsent = () => {
  const { showConsent, requestPermission, setShowConsent } = usePushNotifications();

  if (!showConsent) return null;

  const handleAllow = async () => {
    await requestPermission();
  };

  const handleDismiss = () => {
    setShowConsent(false);
    localStorage.setItem('pushNotificationConsent', 'dismissed');
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      <Alert className="bg-card border-primary/20 shadow-lg">
        <Bell className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold mb-1">Enable Notifications</p>
            <p className="text-sm text-muted-foreground mb-3">
              Get notified when someone replies to your posts or when there are updates to questions you've viewed.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAllow}>
                Allow Notifications
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleDismiss}
              >
                Not Now
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};

