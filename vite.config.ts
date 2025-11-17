import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // PERFORMANCE: Production build optimizations
    minify: "esbuild", // Use esbuild for faster builds (terser is slower)
    esbuildOptions: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
    // PERFORMANCE: Enable tree-shaking and optimize chunk size
    target: "es2015", // Modern browsers for smaller bundles
    cssCodeSplit: true, // Split CSS for better caching
    rollupOptions: {
      output: {
        // PERFORMANCE: Manual chunk splitting for better caching and parallel loading
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            // CRITICAL: React core must be in the same chunk
            // Match React packages more reliably
            const isReact = /[\\/]react($|[\\/])/.test(id) || /[\\/]react-dom($|[\\/])/.test(id);
            const isReactRouter = /[\\/]react-router/.test(id);
            
            if (isReact || isReactRouter) {
              return "react-vendor";
            }
            
            // Heavy libraries that are NOT needed on home page - separate chunks
            if (id.includes("date-fns")) {
              return "date-fns-vendor";
            }
            if (id.includes("framer-motion")) {
              return "framer-motion-vendor";
            }
            if (id.includes("recharts")) {
              return "recharts-vendor";
            }
            if (id.includes("react-day-picker")) {
              return "date-picker-vendor";
            }
            if (id.includes("embla-carousel")) {
              return "carousel-vendor";
            }
            if (id.includes("react-hook-form") || id.includes("@hookform")) {
              return "form-vendor";
            }
            
            // UI libraries - can be split but loaded after React
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }
            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }
            if (id.includes("@supabase/supabase-js")) {
              return "supabase-vendor";
            }
            if (id.includes("lucide-react")) {
              return "icons-vendor";
            }
            // Other node_modules
            return "vendor";
          }
        },
        // PERFORMANCE: Use content hash for long-term caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split(".") || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || "")) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext || "")) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
      },
    },
    // PERFORMANCE: Increase chunk size warning limit (we're using manual chunks)
    chunkSizeWarningLimit: 1000,
    // PERFORMANCE: Source maps only in development
    sourcemap: mode === "development",
  },
}));
