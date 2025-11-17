import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Add CDN preconnect hints for faster image loading
// This establishes early connections to CDN domains before images are requested
function setupCDNPreconnect() {
  // R2 CDN domain
  const r2Domain = import.meta.env.VITE_R2_PUBLIC_DOMAIN || import.meta.env.R2_PUBLIC_DOMAIN;
  if (r2Domain) {
    const cleanDomain = r2Domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const r2Url = `https://${cleanDomain}`;
    
    // Add DNS prefetch and preconnect for R2 CDN
    if (!document.querySelector(`link[href="${r2Url}"]`)) {
      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = r2Url;
      document.head.appendChild(dnsPrefetch);
      
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = r2Url;
      preconnect.setAttribute('crossorigin', 'anonymous');
      document.head.appendChild(preconnect);
    }
  }
  
  // Supabase CDN domain
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    
    if (!document.querySelector(`link[href="${cleanUrl}"]`)) {
      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = cleanUrl;
      document.head.appendChild(dnsPrefetch);
      
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = cleanUrl;
      preconnect.setAttribute('crossorigin', 'anonymous');
      document.head.appendChild(preconnect);
    }
  }
}

// Setup CDN preconnect hints before rendering app
setupCDNPreconnect();

createRoot(document.getElementById("root")!).render(<App />);
