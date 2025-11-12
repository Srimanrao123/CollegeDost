import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

const DISMISSAL_KEY = 'pushNotificationConsentDismissed';
const NOTIFICATION_DELAY_DAYS = 3; // Show after 3 days
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowConsent(false);
      return;
    }

    // Check if already dismissed or granted
    const consentStatus = localStorage.getItem('pushNotificationConsent');
    if (consentStatus === 'dismissed' || consentStatus === 'granted' || consentStatus === 'denied') {
      setShowConsent(false);
      return;
    }

    // Check permission status
    if ('Notification' in window) {
      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      
      // If already granted or denied, don't show
      if (currentPermission !== 'default') {
        setShowConsent(false);
        return;
      }
    }

    const checkShouldShow = async () => {
      try {
        // Get user's account creation time
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .maybeSingle();

        const accountCreatedAt = new Date(
          profile?.created_at || user.created_at || Date.now()
        ).getTime();
        
        const timeElapsed = Date.now() - accountCreatedAt;
        const requiredTime = NOTIFICATION_DELAY_DAYS * ONE_DAY_MS;

        // Only show if 3 days have passed since account creation
        if (timeElapsed >= requiredTime && permission === 'default') {
          setShowConsent(true);
        } else {
          setShowConsent(false);
        }
      } catch (error) {
        console.error('Error checking push notification consent:', error);
        setShowConsent(false);
      }
    };

    checkShouldShow();
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

