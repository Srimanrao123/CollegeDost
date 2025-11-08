import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  TrendingUp,
  Compass,
  Grid,
  GraduationCap,
  Search,
  Plus,
  BookOpen,
  CheckSquare,
  Square,
  X,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createRealtimeChannel } from "@/lib/realtime";
import { deriveProfileDisplayName } from "@/lib/profileDisplay";
import { AddExamsModal } from "@/components/profile/AddExamsModal";
import examsData from "@/utils/exams.json";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MockTestPromo } from "@/components/common/MockTestPromo";

const NAV_ITEMS = [
  { icon: Home, label: "Home Page", path: "/" },
  { icon: TrendingUp, label: "Trending", path: "/trending" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Grid, label: "All", path: "/all" },
];

const ALL_AVAILABLE_EXAMS = Array.from(
  new Set([
    ...((examsData.board_exams?.CBSE || [])),
    ...((examsData.board_exams?.StateBoard || [])),
    ...((examsData.entrance_exams || [])),
  ])
);

interface Profile {
  id?: string;
  username: string;
  full_name?: string | null;
  state: string | null;
  entrance_exam: string[] | null;
  interested_exams: string[] | null;
}

interface PhoneAuthState {
  profileId?: string;
  userPhone?: string;
  verified?: boolean;
}

const DynamicSidebarComponent = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [interestedExams, setInterestedExams] = useState<string[]>([]);
  const [availableExams, setAvailableExams] = useState<string[]>(ALL_AVAILABLE_EXAMS);
  const [isAddExamsOpen, setIsAddExamsOpen] = useState(false);

  const [tags, setTags] = useState<Array<{ name: string; count: number }>>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'any' | 'all'>('any');

  const [phoneAuth, setPhoneAuth] = useState<PhoneAuthState | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("phoneAuth");
      setPhoneAuth(stored ? JSON.parse(stored) : null);
    } catch {
      setPhoneAuth(null);
    }
  }, [user?.id]);

  const profileId = user?.id ?? phoneAuth?.profileId ?? null;
  const phoneNumber = phoneAuth?.userPhone ?? (typeof window !== "undefined" ? localStorage.getItem("userPhone") ?? null : null);

  const fetchProfile = useCallback(async () => {
    if (!profileId && !phoneNumber) {
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    try {
      let data: Profile | null = null;

      if (profileId) {
        const { data: profileData, error } = await (supabase as any)
          .from('profiles')
          .select('id, username, state, entrance_exam, interested_exams, full_name')
          .eq('id', profileId)
          .maybeSingle();
        if (error) throw error;
        data = profileData;
      } else if (phoneNumber) {
        const { data: profileData, error } = await (supabase as any)
          .from('profiles')
          .select('id, username, state, entrance_exam, interested_exams, phone_no, full_name')
          .eq('phone_no', phoneNumber)
          .maybeSingle();
        if (error) throw error;
        if (profileData) {
          data = profileData;
          if (typeof window !== "undefined") {
            const current = phoneAuth ? { ...phoneAuth } : {};
            const next = { ...current, profileId: profileData.id } as PhoneAuthState;
            localStorage.setItem("phoneAuth", JSON.stringify(next));
            setPhoneAuth(next);
          }
        }
      }

      if (data) {
        setProfile(data);
        setInterestedExams(data.interested_exams || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [profileId, phoneNumber, phoneAuth]);

  useEffect(() => {
    setAvailableExams(ALL_AVAILABLE_EXAMS);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    let active = true;
    setLoadingTags(true);

    const loadTags = async () => {
      try {
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_tag_popularity');
        if (!active) return;

        if (!rpcError && rpcData) {
          setTags(rpcData);
        } else {
          const { data: tagsData } = await (supabase as any)
            .from('tags')
            .select('name, id')
            .order('created_at', { ascending: false });

          if (!active) return;

          if (tagsData) {
            const tagsWithCount = await Promise.all(
              tagsData.map(async (tag: any) => {
                const { count } = await (supabase as any)
                  .from('post_tags')
                  .select('*', { count: 'exact', head: true })
                  .eq('tag_id', tag.id);
                return { name: tag.name, count: count || 0 };
              })
            );
            setTags(tagsWithCount.sort((a, b) => b.count - a.count));
          }
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      } finally {
        if (active) setLoadingTags(false);
      }
    };

    loadTags();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!profileId) return;

    const channel = createRealtimeChannel(`realtime:profile:${profileId}`);
    channel.onPostgresChange(
      { table: 'profiles', event: 'UPDATE', filter: `id=eq.${profileId}` },
      (payload) => {
        const next = payload.new as Profile;
        setProfile((prev) => ({ ...(prev || {}), ...next } as Profile));
        if (next.interested_exams) {
          setInterestedExams(next.interested_exams);
        }
      }
    );

    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [profileId]);

  useEffect(() => {
    const refresh = () => {
      fetchProfile();
    };

    window.addEventListener('profileUpdated', refresh);
    window.addEventListener('examsUpdated', refresh);
    return () => {
      window.removeEventListener('profileUpdated', refresh);
      window.removeEventListener('examsUpdated', refresh);
    };
  }, [fetchProfile]);

  const boardExams = useMemo(() => (
    interestedExams.filter((exam) =>
      exam.includes("12th") ||
      exam.includes("HSC") ||
      exam.includes("Intermediate") ||
      exam.includes("PUC") ||
      exam.includes("Board") ||
      exam.includes("HSE") ||
      exam.includes("HS")
    )
  ), [interestedExams]);

  const competitiveExams = useMemo(
    () => interestedExams.filter((exam) => !boardExams.includes(exam)),
    [interestedExams, boardExams]
  );

  const unselectedExams = useMemo(
    () => availableExams.filter((exam) => !interestedExams.includes(exam)),
    [availableExams, interestedExams]
  );

  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()));
  }, [tags, tagSearchQuery]);

  const displayedTags = useMemo(
    () => (showAllTags ? filteredTags : filteredTags.slice(0, 6)),
    [filteredTags, showAllTags]
  );

  const handleTagClick = useCallback((tagName: string, event?: MouseEvent<HTMLButtonElement>) => {
    const isMultiSelect = event?.metaKey || event?.ctrlKey || event?.shiftKey;

    setSelectedTags((prev) => {
      let next: string[];

      if (isMultiSelect) {
        next = prev.includes(tagName)
          ? prev.filter((tag) => tag !== tagName)
          : [...prev, tagName];
      } else {
        if (prev.length === 1 && prev[0] === tagName) {
          next = [];
        } else {
          next = prev.includes(tagName) ? prev.filter((tag) => tag !== tagName) : [tagName];
        }
      }

      window.dispatchEvent(new CustomEvent('tagsSelected', {
        detail: { tags: next, mode: tagFilterMode },
      }));

      return next;
    });
  }, [tagFilterMode]);

  const removeTag = useCallback((tagName: string) => {
    setSelectedTags((prev) => {
      const next = prev.filter((tag) => tag !== tagName);
      window.dispatchEvent(new CustomEvent('tagsSelected', {
        detail: { tags: next, mode: tagFilterMode },
      }));
      return next;
    });
  }, [tagFilterMode]);

  const clearSelectedTags = useCallback(() => {
    setSelectedTags([]);
    window.dispatchEvent(new CustomEvent('tagsSelected', {
      detail: { tags: [], mode: tagFilterMode },
    }));
  }, [tagFilterMode]);

  const toggleTagFilterMode = useCallback((mode: 'any' | 'all') => {
    setTagFilterMode(mode);
    window.dispatchEvent(new CustomEvent('tagsSelected', {
      detail: { tags: selectedTags, mode },
    }));
  }, [selectedTags]);

  const MobileBottomNav = useMemo(() => (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border shadow-lg">
      <div className="grid grid-cols-4 h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  ), [pathname]);

  const SidebarNav = useMemo(() => (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary/10 text-primary border-l-4 border-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:translate-x-1"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  ), []);

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      (user?.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      ""
    );
  }, [profile?.full_name, user?.user_metadata]);

  return (
    <>
      <aside className="hidden lg:block w-72 border-r bg-card h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
        <div className="p-4 space-y-6">
          {loadingProfile ? (
            <Skeleton className="h-20 w-full" />
          ) : profile ? (
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border">
              <p className="text-sm font-medium">Hi, {displayName}! 👋</p>
              <p className="text-xs text-muted-foreground mt-1">
                Here are updates for your selected exams
              </p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              Welcome! Pick some exams to personalize your feed.
            </div>
          )}

          {SidebarNav}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Interested Exams</h3>
              {interestedExams.length > 0 && (
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  {interestedExams.length}
                </span>
              )}
            </div>

            {loadingProfile ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : interestedExams.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No exams selected yet. Add exams to see updates here.
              </div>
            ) : (
              <>
                {boardExams.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Board Exams
                    </p>
                    {boardExams.map((exam) => (
                      <div
                        key={exam}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-secondary/30 border"
                      >
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{exam}</span>
                      </div>
                    ))}
                  </div>
                )}

                {competitiveExams.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Competitive Exams
                    </p>
                    {competitiveExams.map((exam) => (
                      <div
                        key={exam}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-secondary/30 border"
                      >
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{exam}</span>
                      </div>
                    ))}
                  </div>
                )}

                {interestedExams.length > 0 && unselectedExams.length > 0 && (
                  <Button
                    variant="link"
                    className="px-0 text-sm text-primary w-full justify-start hover:underline mt-2"
                    onClick={() => setIsAddExamsOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add More Entrance Exams ({unselectedExams.length})
                  </Button>
                )}

                {interestedExams.length > 0 && unselectedExams.length === 0 && availableExams.length > 0 && (
                  <div className="text-xs text-muted-foreground py-2 px-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 mt-2">
                    ✓ All available exams are selected
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Trending Tags</h3>
              <div className="flex items-center gap-1">
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedTags}
                    className="h-auto p-0 text-xs text-destructive hover:underline"
                  >
                    Clear ({selectedTags.length})
                  </Button>
                )}
                {tags.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTags((prev) => !prev)}
                    className="h-auto p-0 text-xs text-primary hover:underline ml-2"
                  >
                    {showAllTags ? 'Show Less' : 'View All'}
                  </Button>
                )}
              </div>
            </div>

            {selectedTags.length > 1 && (
              <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg border">
                <span className="text-xs text-muted-foreground">Match:</span>
                <Button
                  variant={tagFilterMode === 'any' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleTagFilterMode('any')}
                  className="h-6 text-xs"
                >
                  Any
                </Button>
                <Button
                  variant={tagFilterMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleTagFilterMode('all')}
                  className="h-6 text-xs"
                >
                  All
                </Button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                ref={searchInputRef}
                placeholder="Search tags..."
                className="pl-9 h-9 text-sm"
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="text-xs text-muted-foreground bg-primary/5 p-2 rounded border">
              💡 <strong>Click</strong> to add/remove tags. <strong>Ctrl+Click</strong> to toggle.
            </div>

            {loadingTags ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : displayedTags.length > 0 ? (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {displayedTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={(event) => handleTagClick(tag.name, event)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                        isSelected ? "bg-primary/20 border-2 border-primary shadow-sm" : "hover:bg-secondary/50 border-2 border-transparent"
                      )}
                    >
                      <span className="flex items-center gap-2 flex-1">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={cn(
                          "transition-colors truncate",
                          isSelected ? "text-primary font-semibold" : undefined
                        )}>
                          #{tag.name}
                        </span>
                      </span>
                      <Badge
                        variant={isSelected ? "default" : "secondary"}
                        className="text-xs flex-shrink-0"
                      >
                        {tag.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {tagSearchQuery ? `No tags found matching "${tagSearchQuery}"` : 'No tags available yet'}
              </div>
            )}

            {selectedTags.length > 0 && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="text-xs font-medium mb-2">
                  Filtering by {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''}:
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="default" className="text-xs">
                      #{tag}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTag(tag);
                        }}
                        className="ml-1 hover:text-destructive transition-colors"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <MockTestPromo />
        </div>
      </aside>

      {MobileBottomNav}

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] sm:w-[400px] overflow-y-auto p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>
              Navigate to sections and filter posts
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-6">
            {loadingProfile ? (
              <Skeleton className="h-16 w-full" />
            ) : profile ? (
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border">
                <p className="text-sm font-medium">Hi, {deriveProfileDisplayName(profile)}! 👋</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Here are updates for your selected exams
                </p>
              </div>
            ) : null}

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Interested Exams</h3>
                {interestedExams.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                    {interestedExams.length}
                  </span>
                )}
              </div>

              {loadingProfile ? (
                <Skeleton className="h-24 w-full" />
              ) : interestedExams.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No exams selected yet. Add exams to see updates here.
                </div>
              ) : (
                <div className="space-y-2">
                  {interestedExams.map((exam) => (
                    <div
                      key={exam}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-secondary/30 border"
                    >
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{exam}</span>
                    </div>
                  ))}
                  {unselectedExams.length > 0 && (
                    <Button
                      variant="link"
                      className="px-0 text-sm text-primary w-full justify-start hover:underline"
                      onClick={() => setIsAddExamsOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add More Entrance Exams
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Trending Tags</h3>
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedTags}
                    className="h-auto p-0 text-xs text-destructive hover:underline"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {loadingTags ? (
                <Skeleton className="h-24 w-full" />
              ) : displayedTags.length > 0 ? (
                <div className="space-y-1">
                  {displayedTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={(event) => handleTagClick(tag.name, event)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                          isSelected ? "bg-primary/20 border-2 border-primary" : "hover:bg-secondary/50 border-2 border-transparent"
                        )}
                      >
                        <span className="flex items-center gap-2 flex-1">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={cn(
                            "transition-colors truncate",
                            isSelected ? "text-primary font-semibold" : undefined
                          )}>
                            #{tag.name}
                          </span>
                        </span>
                        <Badge
                          variant={isSelected ? "default" : "secondary"}
                          className="text-xs flex-shrink-0"
                        >
                          {tag.count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {tagSearchQuery ? `No tags found matching "${tagSearchQuery}"` : 'No tags yet'}
                </div>
              )}
            </div>

            <MockTestPromo />
          </div>
        </SheetContent>
      </Sheet>

      <AddExamsModal
        open={isAddExamsOpen}
        onOpenChange={setIsAddExamsOpen}
        onExamsUpdated={fetchProfile}
        currentExams={interestedExams}
        userState={profile?.state || ""}
      />
    </>
  );
};

export const DynamicSidebar = memo(DynamicSidebarComponent);
