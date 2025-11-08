import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showConsent, setShowConsent] = useState(false);
  const consentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;

    // Check if we should show consent (after 2 minutes)
    const checkConsentTimer = () => {
      const timeElapsed = Date.now() - sessionStartTimeRef.current;
      const twoMinutes = 2 * 60 * 1000;

      // Check if user has already given consent
      const hasConsent = localStorage.getItem('pushNotificationConsent') === 'granted';
      
      if (timeElapsed >= twoMinutes && !hasConsent && permission === 'default') {
        setShowConsent(true);
      }
    };

    // Check permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Start timer to check after 2 minutes
    consentTimerRef.current = setInterval(checkConsentTimer, 1000);

    return () => {
      if (consentTimerRef.current) {
        clearInterval(consentTimerRef.current);
      }
    };
  }, [user, permission]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast({
        title: 'Not supported',
        description: 'Your browser does not support notifications',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        localStorage.setItem('pushNotificationConsent', 'granted');
        setShowConsent(false);
        
        // Save subscription to database
        if (user) {
          await saveSubscription();
        }
        
        toast({
          title: 'Notifications enabled',
          description: 'You will receive notifications for replies and updates',
        });
        return true;
      } else {
        localStorage.setItem('pushNotificationConsent', 'denied');
        setShowConsent(false);
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const saveSubscription = async () => {
    if (!user) return;

    try {
      // Check if service workers and push are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID key (optional - only if configured)
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidKey) {
        console.log('VAPID key not configured - using basic notifications');
        return;
      }

      // Get push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      // Save to database (if table exists)
      try {
        await (supabase as any)
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            subscription: JSON.stringify(subscription),
            updated_at: new Date().toISOString(),
          });
      } catch (dbError) {
        // Table might not exist, that's okay
        console.log('Could not save subscription to database:', dbError);
      }
    } catch (error) {
      console.error('Error saving push subscription:', error);
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        ...options,
      });
    }
  };

  return {
    permission,
    showConsent,
    requestPermission,
    sendNotification,
    setShowConsent,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

