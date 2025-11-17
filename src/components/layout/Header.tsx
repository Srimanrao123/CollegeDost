import { Search, Bell, Plus, User, Moon, Sun, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { CreatePostDialog } from "@/components/posts/CreatePostDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { deriveProfileInitial, getAvatarUrl } from "@/lib/profileDisplay";

export const Header = () => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
    
    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchProfile();
    };
    
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, [user?.id]);

  const fetchProfile = async () => {
    // Check if user is authenticated via phone auth
    const phoneAuthData = localStorage.getItem("phoneAuth");
    const userPhone = localStorage.getItem("userPhone");
    
    try {
      let data;
      
      if (phoneAuthData && userPhone) {
        // Phone auth user - look up profile by phone number
        const phoneAuth = JSON.parse(phoneAuthData);
        const profileId = phoneAuth.profileId;
        
        if (profileId) {
          // Try to get profile by stored profileId first
          const { data: profileById } = await (supabase as any)
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .maybeSingle();
          
          if (profileById) {
            data = profileById;
          } else {
            // Fallback: look up by phone number
            const { data: profileByPhone } = await (supabase as any)
              .from('profiles')
              .select('*')
              .eq('phone_no', userPhone)
              .maybeSingle();
            
            if (profileByPhone) {
              data = profileByPhone;
              // Update stored profileId
              const updatedAuth = { ...phoneAuth, profileId: profileByPhone.id };
              localStorage.setItem("phoneAuth", JSON.stringify(updatedAuth));
            }
          }
        } else {
          // No profileId stored, look up by phone number
          const { data: profileByPhone } = await (supabase as any)
            .from('profiles')
            .select('*')
            .eq('phone_no', userPhone)
            .maybeSingle();
          
          if (profileByPhone) {
            data = profileByPhone;
            // Store profileId for future use
            const updatedAuth = { ...phoneAuth, profileId: profileByPhone.id };
            localStorage.setItem("phoneAuth", JSON.stringify(updatedAuth));
          }
        }
      } else if (user?.id) {
        // Regular auth user - look up by user.id
        const { data: profileData } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          data = profileData;
        }
      }
      
      if (data) setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          {/* Left: Logo */}
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src={'/logo.png'} alt="College Dost" className="h-10 w-10 md:h-12 md:w-14" />
          </Link>

          {/* Center: Search */}
          <div className="flex-1 max-w-2xl mx-4 md:mx-8 hidden md:block">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 z-10" />
              <Input
                placeholder="Search posts, topics, users..."
                className="pl-12 h-11 rounded-full bg-background/85 border-2 border-primary/40 backdrop-blur-md shadow-md focus-visible:ring-4 focus-visible:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/70 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const query = (e.target as HTMLInputElement).value.trim();
                    if (query) {
                      navigate(`/all?q=${encodeURIComponent(query)}`);
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-[#008de4] transition-colors relative" 
                  asChild
                >
                  <Link to="/notifications">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-accent rounded-full"></span>
                  </Link>
                </Button>

                <Button
                  onClick={() => navigate("/create-post")}
                  className="bg-primary hover:bg-primary/90"
                >
                  Create Post
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="hover:bg-secondary rounded-full" 
                    >
                      {(() => {
                        const avatarUrl = getAvatarUrl(profile, 32);
                        return avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                          {deriveProfileInitial(profile)}
                        </div>
                      );
                      })()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        View Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleDarkMode}>
                      {isDarkMode ? (
                        <>
                          <Sun className="mr-2 h-4 w-4" />
                          Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="mr-2 h-4 w-4" />
                          Dark Mode
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button 
                onClick={() => navigate('/auth')}
                className="bg-primary hover:bg-primary-hover text-primary-foreground"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
        
        {/* Mobile Search */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 z-10" />
            <Input
              placeholder="Search..."
              className="pl-11 h-11 rounded-full bg-background/85 border-2 border-primary/40 backdrop-blur-md shadow-md focus-visible:ring-4 focus-visible:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/70 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = (e.target as HTMLInputElement).value.trim();
                  if (query) {
                    navigate(`/all?q=${encodeURIComponent(query)}`);
                  }
                }
              }}
            />
          </div>
        </div>
      </header>

      <CreatePostDialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen} />
    </>
  );
};
