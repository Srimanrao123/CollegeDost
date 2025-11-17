import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Loader2, Calendar, GraduationCap, X, Search } from "lucide-react";
import { PostCard } from "@/components/posts/PostCard";
import { PostCardSkeleton } from "@/components/posts/PostCardSkeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import examsData from "@/utils/exams.json";
import { usePosts } from "@/hooks/usePosts";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useAuth } from "@/hooks/useAuth";
import { deriveProfileHandle, getAvatarUrl, type ProfileHandleSource } from "@/lib/profileDisplay";

export default function All() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const searchQuery = searchParams.get("q") || "";
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'any' | 'all'>('any');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Use tag filter in usePosts hook
  const tagFilter = useMemo(() => {
    if (selectedTags.length > 0) {
      return { tags: selectedTags, mode: tagFilterMode };
    }
    return undefined;
  }, [selectedTags, tagFilterMode]);

  // Enable infinite scroll for All page - no limit
  const paginate = !!isAuthenticated;
  const limit = paginate ? undefined : 10;
  const { posts: allPosts, loading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts(
    tagFilter,
    limit,
    { paginate, pageSize: 10 }
  );

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Notification triggers
  useNotificationTriggers();

  // Listen to tagsSelected from DynamicSidebar and PostCard
  useEffect(() => {
    const handler = (event: any) => {
      const tags = event.detail?.tags || [];
      const mode = event.detail?.mode || 'any';
      setSelectedTags(tags);
      setTagFilterMode(mode);
    };
    window.addEventListener('tagsSelected', handler);
    return () => window.removeEventListener('tagsSelected', handler);
  }, []);

  // Clear tag selection when navigating away from /all
  useEffect(() => {
    if (location.pathname !== '/all') {
      setSelectedTags([]);
    }
  }, [location.pathname]);

  // Build full exam list (entrance + board exams)
  const allExamOptions = useMemo(() => {
    const options: { label: string; type: string }[] = [];

    (examsData.entrance_exams || []).forEach((exam: string) => {
      options.push({ label: exam, type: "Entrance" });
    });

    Object.entries(examsData.board_exams || {}).forEach(([board, exams]) => {
      (exams as string[]).forEach((exam) => {
        options.push({ label: exam, type: board });
      });
    });

    const seen = new Set<string>();
    return options.filter((option) => {
      const key = option.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const quickAccessExams = useMemo(() => allExamOptions.slice(0, 8), [allExamOptions]);

  // Filter by search query first (case-insensitive)
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return allPosts;
    
    const searchTerm = searchQuery.toLowerCase().trim();
    return allPosts.filter((post: any) => {
      const title = (post.title || "").toLowerCase();
      const content = (post.content || "").toLowerCase();
      const tags = (post.tags || []).map((t: string) => t.toLowerCase()).join(" ");
      const author = deriveProfileHandle(post.profiles as ProfileHandleSource | null, "").toLowerCase();
      const examType = (post.exam_type || "").toLowerCase();
      
      return (
        title.includes(searchTerm) ||
        content.includes(searchTerm) ||
        tags.includes(searchTerm) ||
        author.includes(searchTerm) ||
        examType.includes(searchTerm)
      );
    });
    }, [allPosts, searchQuery]);

  // Get related posts when search has no results
  const relatedPosts = useMemo(() => {
    if (searchFiltered.length > 0 || !searchQuery.trim()) return [];
    
    const searchTerm = searchQuery.toLowerCase().trim();
    const related: any[] = [];
    
    // Find posts with tags that contain any word from search
    const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 2);
    allPosts.forEach((post: any) => {
      const postTags = (post.tags || []).join(" ").toLowerCase();
      const hasMatch = searchWords.some(word => postTags.includes(word));
      
      if (hasMatch && related.length < 10) {
        related.push(post);
      }
    });
    
    // Find posts with similar exam types
    if (related.length < 10) {
      allPosts.forEach((post: any) => {
        const examType = (post.exam_type || "").toLowerCase();
        if (examType.includes(searchTerm) && !related.find(p => p.id === post.id)) {
          if (related.length < 10) {
            related.push(post);
          }
        }
      });
    }
    
    return related.slice(0, 10);
  }, [allPosts, searchQuery, searchFiltered]);

  const filtered = useMemo(() => {
    // Use search results if search query exists, otherwise use all posts
    let result = searchQuery.trim() ? searchFiltered : allPosts;

    // Filter by tags (case-insensitive)
    if (selectedTags.length > 0) {
      result = result.filter((post: any) => {
        const postTags: string[] = (post.tags || []).map((t: string) => String(t).toLowerCase().trim());
        const normalizedSelectedTags = selectedTags.map(t => String(t).toLowerCase().trim());
        
        if (tagFilterMode === 'all') {
          return normalizedSelectedTags.every(tag => postTags.includes(tag));
        }
        return normalizedSelectedTags.some(tag => postTags.includes(tag));
      });
    }

    // Filter by entrance exams (case-insensitive) - multi-select
    if (selectedExams.length > 0) {
      result = result.filter((post: any) => {
        const postExamType = (post.exam_type || "").toLowerCase().trim();
        return selectedExams.some(exam => exam.toLowerCase().trim() === postExamType);
      });
    }

    // Filter by created date
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          result = result.filter((post: any) => {
            const postDate = new Date(post.created_at);
            return postDate >= filterDate;
          });
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          result = result.filter((post: any) => {
            const postDate = new Date(post.created_at);
            return postDate >= filterDate;
          });
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          result = result.filter((post: any) => {
            const postDate = new Date(post.created_at);
            return postDate >= filterDate;
          });
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          result = result.filter((post: any) => {
            const postDate = new Date(post.created_at);
            return postDate >= filterDate;
          });
          break;
      }
    }

    return result;
  }, [allPosts, selectedTags, tagFilterMode, selectedExams, dateFilter, searchQuery, searchFiltered]);

  // Posts are already limited in usePosts hook for non-authenticated users
  const displayedPosts = filtered;

  useEffect(() => {
    if (!paginate) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, displayedPosts.length, paginate]);

  const clearSearch = () => {
    setSearchParams({});
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-6">All Posts</h1>
        
        {/* Search Query Display */}
        {searchQuery && (
          <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Searching for: </span>
                <span className="text-sm font-semibold text-primary">"{searchQuery}"</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </Card>
        )}
        
        {/* Filters Section */}
        <Card className="p-4 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Created Date Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created Date
              </label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Exam Filter - Multi-select */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Exams ({selectedExams.length > 0 ? `${selectedExams.length} selected` : 'All'})
              </label>
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-2">
                  {allExamOptions.map((option) => {
                    const isSelected = selectedExams.includes(option.label);
                    const checkboxId = `exam-${option.label.replace(/\s+/g, "-").toLowerCase()}`;
                    return (
                    <div
                      key={`${option.label}-${option.type}`}
                      className="flex items-center space-x-2 p-1.5 rounded hover:bg-secondary/50"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedExams((prev) => [...prev, option.label]);
                          } else {
                            setSelectedExams((prev) => prev.filter((exam) => exam !== option.label));
                          }
                        }}
                      />
                      <Label
                        htmlFor={checkboxId}
                        className="cursor-pointer text-sm flex-1 font-normal"
                      >
                        {option.label}
                        <span className="ml-2 text-xs text-muted-foreground">({option.type})</span>
                      </Label>
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {selectedExams.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedExams([])}
                  className="mt-2 h-7 text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Quick Access Exam Tabs */}
          {allExamOptions.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Quick Access</label>
              <div className="flex flex-wrap gap-2">
                {quickAccessExams.map((option) => (
                  <Button
                    key={`${option.label}-${option.type}-quick`}
                    variant={selectedExams.includes(option.label) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (selectedExams.includes(option.label)) {
                        setSelectedExams(selectedExams.filter((exam) => exam !== option.label));
                      } else {
                        setSelectedExams([...selectedExams, option.label]);
                      }
                    }}
                    className="text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {(selectedExams.length > 0 || dateFilter !== 'all' || searchQuery || selectedTags.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Tags: {selectedTags.join(", ")}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setSelectedTags([])}
                  />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: {searchQuery}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={clearSearch}
                  />
                </Badge>
              )}
              {selectedExams.map((exam) => (
                <Badge key={exam} variant="secondary" className="flex items-center gap-1">
                  {exam}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setSelectedExams(selectedExams.filter(e => e !== exam))}
                  />
                </Badge>
              ))}
              {dateFilter !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {dateFilter === 'today' ? 'Today' : 
                   dateFilter === 'week' ? 'Last 7 Days' :
                   dateFilter === 'month' ? 'Last Month' :
                   dateFilter === 'year' ? 'Last Year' : dateFilter}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setDateFilter("all")}
                  />
                </Badge>
              )}
            </div>
          )}
        </Card>

        {/* Posts List */}
        {loading && filtered.length === 0 ? (
          <>
            {[...Array(3)].map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <>
            {searchQuery && relatedPosts.length > 0 ? (
              <>
                <Card className="p-8 text-center mb-6">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2">No exact results found</h2>
                  <p className="text-muted-foreground mb-4">
                    We couldn't find anything matching "{searchQuery}"
                  </p>
                  <Button variant="outline" onClick={clearSearch}>
                    Clear Search
                  </Button>
                </Card>
                <div>
                  <h2 className="text-xl font-semibold mb-4">Related Content</h2>
                  <div className="space-y-4">
                    {relatedPosts.map((post: any) => (
                      <PostCard
                        key={post.id}
                        id={post.id}
                        authorId={post.user_id}
                        author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                        timeAgo={new Date(post.created_at).toLocaleString()}
                        title={post.title || post.content?.substring(0, 100) || 'Untitled'}
                        content={post.content || ''}
                        imageR2Key={post.image_r2_key || null}
                        category={post.category}
                        examType={post.exam_type || ''}
                        comments={post.comments_count || 0}
                        views={post.views_count || 0}
                        tags={post.tags || []}
                        avatarUrl={getAvatarUrl(post.profiles, 40) || undefined}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {selectedTags.length > 0 || selectedExams.length > 0 || dateFilter !== 'all' || searchQuery
                  ? 'No posts found matching your filters. Try adjusting your filters.'
                  : 'No posts yet. Be the first to create one!'}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((post: any, index: number) => (
              <PostCard
                key={post.id}
                id={post.id}
                slug={post.slug}
                authorId={post.user_id}
                author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                timeAgo={new Date(post.created_at).toLocaleString()}
                title={post.title || post.content?.substring(0, 100) || 'Untitled'}
                content={post.content || ''}
                imageR2Key={post.image_r2_key || null}
                category={post.category}
                examType={post.exam_type || ''}
                comments={post.comments_count || 0}
                views={post.views_count || 0}
                tags={post.tags || []}
                avatarUrl={getAvatarUrl(post.profiles, 40) || undefined}
                isFirstPost={index === 0} // Optimize first post for LCP
              />
            ))}

            {isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}

        <div ref={loadMoreRef} className="h-1" aria-hidden />
    </div>
  );
}


