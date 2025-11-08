import { useCallback, useRef } from "react";

export function useNotificationTriggers() {
  const viewTrackingRef = useRef<Map<string, number>>(new Map());

  const startTrackingPostView = useCallback((postId: string) => {
    if (!postId) return;
    viewTrackingRef.current.set(postId, Date.now());
  }, []);

  const stopTrackingPostView = useCallback((postId: string) => {
    if (!postId) return;
    viewTrackingRef.current.delete(postId);
  }, []);

  return {
    startTrackingPostView,
    stopTrackingPostView,
  };
}
