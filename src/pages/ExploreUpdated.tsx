import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/posts/PostCard";
import { usePosts } from "@/hooks/usePosts";
import { Loader2, X, Tag, Filter, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deriveProfileHandle, type ProfileHandleSource } from "@/lib/profileDisplay";

interface Topic {
  id: string;
  name: string;
  description?: string;
}

const ExploreUpdated = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get("topic");
  const tagParam = searchParams.get("tag");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const { posts, loading: postsLoading } = usePosts();
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    tagParam ? [tagParam.toLowerCase()] : []
  );
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(topicParam);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setLoading(true);
        const { data, error } = await (supabase as any)
          .from("topics")
          .select("id, name, description")
          .order("name", { ascending: true });

        if (error) throw error;
        setTopics((data || []) as Topic[]);
      } catch (error: any) {
        console.error("Error fetching topics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

  useEffect(() => {
    setSelectedTopicId(topicParam);
  }, [topicParam]);

  useEffect(() => {
    if (selectedTopicId) {
      setSelectedTags(tagParam ? [tagParam.toLowerCase()] : []);
      setSelectedExams([]);
    } else {
      setSelectedTags([]);
      setSelectedExams([]);
    }
  }, [selectedTopicId, tagParam]);

  const getCategoryColor = (index: number) => {
    const colors = [
      "bg-gradient-to-br from-blue-500 to-blue-600",
      "bg-gradient-to-br from-red-500 to-red-600",
      "bg-gradient-to-br from-green-500 to-green-600",
      "bg-gradient-to-br from-yellow-500 to-yellow-600",
      "bg-gradient-to-br from-purple-500 to-purple-600",
      "bg-gradient-to-br from-pink-500 to-pink-600",
    ];
    return colors[index % colors.length];
  };

  useEffect(() => {
    if (posts.length > 0 && topics.length > 0) {
      const counts: Record<string, number> = {};
      topics.forEach((topic) => {
        counts[topic.id] = posts.filter((post: any) => post.topic_id === topic.id).length;
      });
      setPostCounts(counts);
    }
  }, [posts, topics]);

  const handleTopicClick = (topicId: string) => {
    navigate(`/explore?topic=${topicId}`);
  };

  const topicColors = useMemo(
    () => [
      "#2dd4bf",
      "#c026d3",
      "#10b981",
      "#818cf8",
      "#eab308",
      "#fb7185",
      "#38bdf8",
      "#f472b6",
      "#f59e42",
      "#60a5fa",
    ],
    []
  );

  const getColour = useMemo(() => {
    return (id: string | number) => {
      const str = id.toString();
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % topicColors.length;
      return topicColors[idx];
    };
  }, [topicColors]);

  const topicFilteredPosts = useMemo(() => {
    if (!selectedTopicId) return [];
    return posts.filter((post: any) => post.topic_id === selectedTopicId);
  }, [posts, selectedTopicId]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    topicFilteredPosts.forEach((post: any) => {
      (post.tags || []).forEach((tag: string) => set.add(tag));
    });
    return Array.from(set);
  }, [topicFilteredPosts]);

  const availableExams = useMemo(() => {
    const set = new Set<string>();
    topicFilteredPosts.forEach((post: any) => {
      if (post.exam_type) {
        set.add(String(post.exam_type));
      }
    });
    return Array.from(set);
  }, [topicFilteredPosts]);

  const filteredPosts = useMemo(() => {
    if (!selectedTopicId) return [];

    let result = [...topicFilteredPosts];

    if (selectedTags.length > 0) {
      result = result.filter((post: any) => {
        const postTags: string[] = (post.tags || []).map((tag: string) => tag.toLowerCase());
        return selectedTags.every((tag) => postTags.includes(tag));
      });
    }

    if (selectedExams.length > 0) {
      result = result.filter((post: any) =>
        selectedExams.includes(String(post.exam_type || "").toLowerCase())
      );
    }

    return result;
  }, [selectedTopicId, topicFilteredPosts, selectedTags, selectedExams]);

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const seconds = Math.floor((now.getTime() - created.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Compass className="h-5 w-5" />
            Explore
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a topic to discover tailored posts, then refine the results with tags and exam filters.
          </p>
        </div>

      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4" /> Topics
          </h2>
          {selectedTopicId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/explore")}
              className="h-8"
            >
              Clear selection
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => {
            const isActive = topic.id === selectedTopicId;
            const count = postCounts[topic.id] ?? 0;
            return (
              <Card
                key={topic.id}
                role="button"
                tabIndex={0}
                onClick={() => handleTopicClick(topic.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    handleTopicClick(topic.id);
                  }
                }}
                className={`p-4 border transition-all cursor-pointer pl-4 ${
                  isActive
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "hover:border-primary/30"
                }`}
                style={{
                  borderLeft: `6px solid ${getColour(topic.id)}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">{topic.name}</h3>
                    {topic.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {topic.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={isActive ? "default" : "secondary"}>{count} posts</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {!selectedTopicId ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-lg">
            Select a topic above to start exploring related posts.
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-4 space-y-4">
            {selectedTopic && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{selectedTopic.name}</h3>
                  {selectedTopic.description && (
                    <p className="text-sm text-muted-foreground max-w-2xl">
                      {selectedTopic.description}
                    </p>
                  )}
                </div>
                <Badge variant="outline">{filteredPosts.length} posts</Badge>
              </div>
            )}

            {(availableTags.length > 0 || availableExams.length > 0) ? (
              <div className="space-y-4">
                {availableTags.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Tags</span>
                      {selectedTags.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedTags([])}
                        >
                          Clear tags
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => {
                        const normalizedTag = tag.toLowerCase();
                        const isSelected = selectedTags.includes(normalizedTag);
                        return (
                          <Badge
                            key={tag}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedTags((prev) =>
                                isSelected
                                  ? prev.filter((t) => t !== normalizedTag)
                                  : [...prev, normalizedTag]
                              );
                            }}
                          >
                            #{tag}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableExams.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Exams</span>
                      {selectedExams.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedExams([])}
                        >
                          Clear exams
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableExams.map((exam) => {
                        const normalizedExam = exam.toLowerCase();
                        const isSelected = selectedExams.includes(normalizedExam);
                        return (
                          <Button
                            key={exam}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setSelectedExams((prev) =>
                                isSelected
                                  ? prev.filter((e) => e !== normalizedExam)
                                  : [...prev, normalizedExam]
                              );
                            }}
                          >
                            {exam}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(selectedTags.length > 0 || selectedExams.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Active filters:</span>
                    {selectedTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        #{tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                        />
                      </Badge>
                    ))}
                    {selectedExams.map((exam) => (
                      <Badge
                        key={exam}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {exam}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSelectedExams((prev) => prev.filter((e) => e !== exam))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No additional filters available for this topic yet.
              </p>
            )}
          </Card>

          {postsLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="space-y-4">
              {filteredPosts.map((post: any) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  slug={post.slug}
                  authorId={post.user_id}
                  author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, "anonymous")}
                  timeAgo={getTimeAgo(post.created_at)}
                  title={post.title || post.content?.substring(0, 100) || "Untitled"}
                  content={post.content || ""}
                  image={post.image_url || ""}
                  category={post.category}
                  examType={post.exam_type || ""}
                  comments={post.comments_count || 0}
                  views={post.views_count || 0}
                  tags={post.tags || []}
                  avatarUrl={post.profiles?.avatar_url}
                />
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <p className="text-muted-foreground text-sm">
                No posts match the selected filters. Try adjusting your tag or exam selections.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ExploreUpdated;
