import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth"; // ADD THIS IMPORT
import { Loader2 } from "lucide-react";
import Home from "./pages/Home";
import PostDetailPage from "@/pages/PostDetailPage";
import Profile from "./pages/ProfileUpdated";
import Notifications from "./pages/NotificationsUpdated";
import Trending from "./pages/Trending";
import Explore from "./pages/ExploreUpdated";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import UsernamePhoneVerification from "./pages/UsernamePhoneVerification";
import CreateProfile from "./pages/CreateProfile";
import VerifyPhone from "./pages/VerifyPhone";
import NotFound from "./pages/NotFound";
import CreatePostPage from "@/pages/CreatePostPage";
import CommentThreadPage from "./pages/CommentThreadPage";
import All from "@/pages/All";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProfileCompletionGuard } from "@/components/auth/ProfileCompletionGuard";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";

// Optimized QueryClient configuration for maximum performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Stop re-fetching on tab focus
      refetchOnMount: false, // Don't refetch on every mount if data is fresh
      staleTime: 1000 * 60 * 5, // Data is considered fresh for 5 minutes
      retry: 1, // Only retry failed requests once
      gcTime: 1000 * 60 * 10, // Cache data for 10 minutes (formerly cacheTime)
    },
  },
});

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check for phone auth users
  const phoneAuthData = typeof window !== 'undefined' ? localStorage.getItem("phoneAuth") : null;
  const isAuthenticated = user || phoneAuthData;

  return (
    <Routes>
      {/* Auth flow routes (no layout) */}
      <Route path="/auth" element={!isAuthenticated ? <Auth /> : <Navigate to="/" replace />} />
      <Route path="/onboarding" element={isAuthenticated ? <OnboardingGuard><Onboarding /></OnboardingGuard> : <Navigate to="/auth" replace />} />
      <Route path="/username-phone-verification" element={isAuthenticated ? <UsernamePhoneVerification /> : <Navigate to="/auth" replace />} />
      <Route path="/create-profile" element={isAuthenticated ? <CreateProfile /> : <Navigate to="/auth" replace />} />
      <Route path="/verify-phone" element={isAuthenticated ? <VerifyPhone /> : <Navigate to="/auth" replace />} />

      {/* Main layout routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<ProfileCompletionGuard><Home /></ProfileCompletionGuard>} />
        <Route path="/post/:id" element={<PostDetailPage />} />
        <Route path="/post/:postId/comment/:commentId" element={<CommentThreadPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/auth" replace />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/all" element={<All />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/create-post" element={user ? <CreatePostPage /> : <Navigate to="/auth" replace />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnalyticsTracker />
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
