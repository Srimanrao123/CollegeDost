import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { GA_MEASUREMENT_ID, isAnalyticsConfigured } from "@/config/analytics";

/**
 * Bridges React Router navigation events to GA4 page view tracking.
 */
export const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.gtag !== "function") return;
    if (!isAnalyticsConfigured) return;

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: `${location.pathname}${location.search}`,
    });
  }, [location.pathname, location.search]);

  return null;
};


