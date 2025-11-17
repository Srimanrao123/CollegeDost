import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";
import Home from "./pages/Home";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProfileCompletionGuard } from "@/components/auth/ProfileCompletionGuard";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";

// PERFORMANCE: Code splitting - lazy load non-critical routes
// This reduces initial bundle size and improves FCP/LCP
const PostDetailPage = lazy(() => import("@/pages/PostDetailPage"));
const Profile = lazy(() => import("./pages/ProfileUpdated"));
const Notifications = lazy(() => import("./pages/NotificationsUpdated"));
const Trending = lazy(() => import("./pages/Trending"));
const Explore = lazy(() => import("./pages/ExploreUpdated"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const UsernamePhoneVerification = lazy(() => import("./pages/UsernamePhoneVerification"));
const CreateProfile = lazy(() => import("./pages/CreateProfile"));
const VerifyPhone = lazy(() => import("./pages/VerifyPhone"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CreatePostPage = lazy(() => import("@/pages/CreatePostPage"));
const CommentThreadPage = lazy(() => import("./pages/CommentThreadPage"));
const All = lazy(() => import("@/pages/All"));

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

  // PERFORMANCE: Loading fallback for code-split routes
  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      {/* Auth flow routes (no layout) - Lazy loaded */}
      <Route 
        path="/auth" 
        element={
          !isAuthenticated ? (
            <Suspense fallback={<LoadingFallback />}>
              <Auth />
            </Suspense>
          ) : (
            <Navigate to="/" replace />
          )
        } 
      />
      <Route 
        path="/onboarding" 
        element={
          isAuthenticated ? (
            <OnboardingGuard>
              <Suspense fallback={<LoadingFallback />}>
                <Onboarding />
              </Suspense>
            </OnboardingGuard>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/username-phone-verification" 
        element={
          isAuthenticated ? (
            <Suspense fallback={<LoadingFallback />}>
              <UsernamePhoneVerification />
            </Suspense>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/create-profile" 
        element={
          isAuthenticated ? (
            <Suspense fallback={<LoadingFallback />}>
              <CreateProfile />
            </Suspense>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />
      <Route 
        path="/verify-phone" 
        element={
          isAuthenticated ? (
            <Suspense fallback={<LoadingFallback />}>
              <VerifyPhone />
            </Suspense>
          ) : (
            <Navigate to="/auth" replace />
          )
        } 
      />

      {/* Main layout routes - Home is not lazy loaded (critical above-the-fold) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<ProfileCompletionGuard><Home /></ProfileCompletionGuard>} />
        <Route 
          path="/post/:slug" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <PostDetailPage />
            </Suspense>
          } 
        />
        <Route 
          path="/post/:postSlug/comment/:commentId" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <CommentThreadPage />
            </Suspense>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Profile />
            </Suspense>
          } 
        />
        <Route 
          path="/profile/:userId" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Profile />
            </Suspense>
          } 
        />
        <Route 
          path="/notifications" 
          element={
            user ? (
              <Suspense fallback={<LoadingFallback />}>
                <Notifications />
              </Suspense>
            ) : (
              <Navigate to="/auth" replace />
            )
          } 
        />
        <Route 
          path="/trending" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Trending />
            </Suspense>
          } 
        />
        <Route 
          path="/all" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <All />
            </Suspense>
          } 
        />
        <Route 
          path="/explore" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Explore />
            </Suspense>
          } 
        />
        <Route 
          path="/create-post" 
          element={
            user ? (
              <Suspense fallback={<LoadingFallback />}>
                <CreatePostPage />
              </Suspense>
            ) : (
              <Navigate to="/auth" replace />
            )
          } 
        />
      </Route>

      {/* Catch-all */}
      <Route 
        path="*" 
        element={
          <Suspense fallback={<LoadingFallback />}>
            <NotFound />
          </Suspense>
        } 
      />
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
            {/* PERFORMANCE: Analytics runs after initial render to avoid blocking */}
            <AnalyticsTracker />
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
