/**
 * Google Analytics 4 measurement identifier.
 * Update VITE_GA_MEASUREMENT_ID in your environment or adjust the default below.
 */
const DEFAULT_GA_MEASUREMENT_ID = "G-57TRBL5J9G";

const fromEnv =
  typeof import.meta !== "undefined" &&
  typeof import.meta.env !== "undefined" &&
  typeof import.meta.env.VITE_GA_MEASUREMENT_ID === "string" &&
  import.meta.env.VITE_GA_MEASUREMENT_ID.trim().length > 0
    ? import.meta.env.VITE_GA_MEASUREMENT_ID.trim()
    : undefined;

const fromWindow =
  typeof window !== "undefined" &&
  typeof window.__GA_MEASUREMENT_ID__ === "string" &&
  window.__GA_MEASUREMENT_ID__!.trim().length > 0
    ? window.__GA_MEASUREMENT_ID__!.trim()
    : undefined;

export const GA_MEASUREMENT_ID =
  fromEnv || fromWindow || DEFAULT_GA_MEASUREMENT_ID;

export const isAnalyticsConfigured =
  GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== DEFAULT_GA_MEASUREMENT_ID;


