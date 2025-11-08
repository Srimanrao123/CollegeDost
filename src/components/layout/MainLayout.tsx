import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { DynamicSidebar } from "./DynamicSidebar";
import { TrendingSidebar } from "./TrendingSidebar";
import { useAuth } from "@/hooks/useAuth";

const HIDE_TRENDING_PATHS = new Set(["/notifications", "/messages"]);

export const MainLayout = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const hideTrending = HIDE_TRENDING_PATHS.has(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex relative">
        {isAuthenticated ? <DynamicSidebar /> : <Sidebar />}
        <main className="flex-1 min-w-0 w-full pb-16 lg:pb-0">
          <Outlet />
        </main>
        {!hideTrending && <TrendingSidebar />}
      </div>
    </div>
  );
};
