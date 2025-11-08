import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { INDIAN_STATES } from "@/utils/examMappings";
import { Search, X, GraduationCap, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import examsData from '@/utils/exams.json'
import { ProfileService } from "@/services/profileService";

type BoardType = "CBSE" | "StateBoard";

export default function Onboarding() {
  const [state, setState] = useState("");
  const [boardType, setBoardType] = useState<BoardType | "">("");
  const [selectedBoardExams, setSelectedBoardExams] = useState<string[]>([]);
  const [selectedEntranceExams, setSelectedEntranceExams] = useState<string[]>([]);
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const [entranceSearchQuery, setEntranceSearchQuery] = useState("");
  const [debouncedBoardQuery, setDebouncedBoardQuery] = useState("");
  const [debouncedEntranceQuery, setDebouncedEntranceQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get board exams based on selection
  const availableBoardExams = useMemo(() => {
    if (!boardType) return [];
    return examsData.board_exams[boardType] || [];
  }, [boardType]);

  // Filter board exams based on search
  const filteredBoardExams = useMemo(() => {
    if (!debouncedBoardQuery.trim()) return availableBoardExams;
    return availableBoardExams.filter(exam =>
      exam.toLowerCase().includes(debouncedBoardQuery.toLowerCase())
    );
  }, [availableBoardExams, debouncedBoardQuery]);

  // Filter entrance exams based on search
  const filteredEntranceExams = useMemo(() => {
    if (!debouncedEntranceQuery.trim()) return examsData.entrance_exams;
    return examsData.entrance_exams.filter(exam =>
      exam.toLowerCase().includes(debouncedEntranceQuery.toLowerCase())
    );
  }, [debouncedEntranceQuery]);

  // Debounce search inputs for better UX
  useEffect(() => {
    const id = setTimeout(() => setDebouncedBoardQuery(boardSearchQuery), 250);
    return () => clearTimeout(id);
  }, [boardSearchQuery]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedEntranceQuery(entranceSearchQuery), 250);
    return () => clearTimeout(id);
  }, [entranceSearchQuery]);

  const handleBoardExamToggle = (exam: string) => {
    setSelectedBoardExams(prev =>
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  const handleEntranceExamToggle = (exam: string) => {
    setSelectedEntranceExams(prev =>
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  const removeBoardExam = (exam: string) => {
    setSelectedBoardExams(prev => prev.filter(e => e !== exam));
  };

  const removeEntranceExam = (exam: string) => {
    setSelectedEntranceExams(prev => prev.filter(e => e !== exam));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.trim()) {
      toast({
        title: "State Required",
        description: "Please select your state",
        variant: "destructive",
      });
      return;
    }

    if (!boardType) {
      toast({
        title: "Board Type Required",
        description: "Please select CBSE or StateBoard",
        variant: "destructive",
      });
      return;
    }

    if (selectedBoardExams.length === 0) {
      toast({
        title: "Board Exam Required",
        description: "Please select at least one board exam",
        variant: "destructive",
      });
      return;
    }

    if (selectedEntranceExams.length === 0) {
      toast({
        title: "Entrance Exam Required",
        description: "Please select at least one entrance exam",
        variant: "destructive",
      });
      return;
    }

    // Get user ID using ProfileService
    const userId = await ProfileService.getUserId();

    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsLoading(true);
    try {
      const allSelectedExams = [...selectedBoardExams, ...selectedEntranceExams];

      // Ensure profile exists, if not create it
      const existingProfile = await ProfileService.getProfile(userId);
      
      if (!existingProfile) {
        // Get username from user metadata or generate one
        const username = user 
          ? ((user as any)?.user_metadata?.name || user.email?.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_') || `user_${userId.slice(0,8)}`
          : `user_${userId.slice(0,8)}`;
        const avatarUrl = user ? ((user as any)?.user_metadata?.picture || null) : null;

        // Create profile with basic info
        await ProfileService.upsertProfile(userId, {
          username,
          avatar_url: avatarUrl,
        });
      }

      // Update onboarding data using ProfileService
      await ProfileService.updateOnboarding(userId, {
        state,
        entrance_exam: selectedEntranceExams,
        interested_exams: allSelectedExams,
        onboarding_completed: true,
      });

      toast({
        title: "Welcome! 🎉",
        description: "Your profile has been set up successfully.",
      });

      // Notify rest of app immediately (Header/Sidebar)
      ProfileService.notifyProfileUpdate();

      // Navigate to home page with personalized data
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Complete Your Profile</CardTitle>
          <CardDescription className="text-center">
            Select your state, board type, and exams you're interested in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* State Selection */}
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Select value={state || undefined} onValueChange={setState} disabled={isLoading}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {INDIAN_STATES.map((stateName) => (
                    <SelectItem key={stateName} value={stateName}>
                      {stateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Board Type Selection */}
            {state && (
              <div className="space-y-2">
                <Label htmlFor="boardType">Board Type *</Label>
                <Select value={boardType || undefined} onValueChange={(val) => setBoardType(val as BoardType)} disabled={isLoading}>
                  <SelectTrigger id="boardType">
                    <SelectValue placeholder="Select board type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CBSE">CBSE</SelectItem>
                    <SelectItem value="StateBoard">State Board</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Board Exams Section */}
            {boardType && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <Label className="text-base font-semibold">Board Exams *</Label>
                  </div>
                  <Badge variant="secondary">
                    {selectedBoardExams.length} selected
                  </Badge>
                </div>

                {/* Search for StateBoard only */}
                {boardType === "StateBoard" && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search board exams..."
                      className="pl-9"
                      value={boardSearchQuery}
                      onChange={(e) => setBoardSearchQuery(e.target.value)}
                    />
                  </div>
                )}

                {/* Selected Board Exams */}
                {selectedBoardExams.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border">
                    {selectedBoardExams.map((exam) => (
                      <Badge key={exam} variant="default" className="gap-1">
                        {exam}
                        <button
                          type="button"
                          onClick={() => removeBoardExam(exam)}
                          className="ml-1"
                        >
                          <X className="h-3 w-3 hover:text-destructive" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Board Exams List */}
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="space-y-2">
                    {filteredBoardExams.map((exam) => (
                      <div
                        key={exam}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50"
                      >
                        <Checkbox
                          id={`board-${exam}`}
                          checked={selectedBoardExams.includes(exam)}
                          onCheckedChange={() => handleBoardExamToggle(exam)}
                          disabled={isLoading}
                        />
                        <Label htmlFor={`board-${exam}`} className="cursor-pointer text-sm flex-1">
                          {exam}
                        </Label>
                      </div>
                    ))}
                    {filteredBoardExams.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No board exams found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Entrance Exams Section - Show for both CBSE and StateBoard */}
            {boardType && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <Label className="text-base font-semibold">Entrance Exams *</Label>
                    </div>
                    <Badge variant="secondary">
                      {selectedEntranceExams.length} selected
                    </Badge>
                  </div>

                  {/* Search for Entrance Exams */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search entrance exams..."
                      className="pl-9"
                      value={entranceSearchQuery}
                      onChange={(e) => setEntranceSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Selected Entrance Exams */}
                  {selectedEntranceExams.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border">
                      {selectedEntranceExams.map((exam) => (
                        <Badge key={exam} variant="default" className="gap-1">
                          {exam}
                          <button
                            type="button"
                            onClick={() => removeEntranceExam(exam)}
                            className="ml-1"
                          >
                            <X className="h-3 w-3 hover:text-destructive" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Entrance Exams List */}
                  <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredEntranceExams.map((exam) => (
                      <div
                        key={exam}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50"
                      >
                          <Checkbox
                            id={`entrance-${exam}`}
                            checked={selectedEntranceExams.includes(exam)}
                          onCheckedChange={() => handleEntranceExamToggle(exam)}
                            disabled={isLoading}
                          />
                          <Label htmlFor={`entrance-${exam}`} className="cursor-pointer text-sm flex-1">
                            {exam}
                          </Label>
                        </div>
                      ))}
                      {filteredEntranceExams.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4 col-span-2">
                          No entrance exams found
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !state || !boardType || selectedBoardExams.length === 0 || selectedEntranceExams.length === 0}
              className="w-full"
              size="lg"
            >
              {isLoading ? "Setting up..." : "Complete Setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
