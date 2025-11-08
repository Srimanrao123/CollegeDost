import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import examsData from "@/utils/exams.json";
import { Search, GraduationCap, BookOpen, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface AddExamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExamsUpdated: () => void;
  currentExams: string[];
  userState: string;
}

export function AddExamsModal({ 
  open, 
  onOpenChange, 
  onExamsUpdated, 
  currentExams, 
  userState 
}: AddExamsModalProps) {
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Load ALL exams from local JSON (ignore userState)
  const availableExams = useMemo(() => {
    const all = [
      ...((examsData.board_exams?.CBSE || [])),
      ...((examsData.board_exams?.StateBoard || [])),
      ...((examsData.entrance_exams || []))
    ];
    return Array.from(new Set(all));
  }, []);

  const availableExamsToAdd = useMemo(() => {
    return availableExams.filter(exam => !currentExams.includes(exam));
  }, [availableExams, currentExams]);

  // Category-wise lists using JSON sources
  const { cbseBoardExams, stateBoardExams, entranceExams } = useMemo(() => {
    const currentSet = new Set(currentExams);
    const cbse = (examsData.board_exams?.CBSE || []).filter(e => !currentSet.has(e));
    const state = (examsData.board_exams?.StateBoard || []).filter(e => !currentSet.has(e));
    const entrance = (examsData.entrance_exams || []).filter(e => !currentSet.has(e));
    return { cbseBoardExams: cbse, stateBoardExams: state, entranceExams: entrance };
  }, [currentExams]);

  // Filter exams based on search query
  const filteredCbse = useMemo(() => {
    if (!searchQuery.trim()) return cbseBoardExams;
    return cbseBoardExams.filter(exam => exam.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [cbseBoardExams, searchQuery]);

  const filteredState = useMemo(() => {
    if (!searchQuery.trim()) return stateBoardExams;
    return stateBoardExams.filter(exam => exam.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stateBoardExams, searchQuery]);

  const filteredEntrance = useMemo(() => {
    if (!searchQuery.trim()) return entranceExams;
    return entranceExams.filter(exam => exam.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [entranceExams, searchQuery]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedExams([]);
      setSearchQuery("");
    }
  }, [open]);

  const handleExamToggle = (exam: string) => {
    setSelectedExams(prev => {
      if (prev.includes(exam)) {
        return prev.filter(examName => examName !== exam);
      }
      return [...prev, exam];
    });
  };

  const handleDeselectAll = () => {
    setSelectedExams([]);
  };

  const handleSave = async () => {
    if (!user || selectedExams.length === 0) return;

    setIsLoading(true);
    try {
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('entrance_exam, interested_exams')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const currentEntranceExams = currentProfile?.entrance_exam || [];
      const currentInterestedExams = currentProfile?.interested_exams || [];
      
      // Merge and deduplicate
      const updatedEntranceExams = [...new Set([...currentEntranceExams, ...selectedExams])];
      const updatedInterestedExams = [...new Set([...currentInterestedExams, ...selectedExams])];

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          entrance_exam: updatedEntranceExams,
          interested_exams: updatedInterestedExams,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "Success! 🎉",
        description: `${selectedExams.length} exam${selectedExams.length > 1 ? 's' : ''} added successfully!`,
      });

      onExamsUpdated();
      onOpenChange(false);
      setSelectedExams([]);
      setSearchQuery("");
    } catch (error: any) {
      console.error("Error adding exams:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add exams. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedExams([]);
    setSearchQuery("");
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add More Entrance Exams</DialogTitle>
          <DialogDescription>
            Select additional exams from the full list that you're interested in.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {availableExamsToAdd.length > 0 ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-base font-semibold">
                    Available Exams for {userState}
                  </Label>
                  <div className="flex items-center gap-2">
                    {selectedExams.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeselectAll}
                        className="h-8 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search exams..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    {selectedExams.length} of {availableExamsToAdd.length} selected
                  </span>
                  {searchQuery && (
                    <span>
                      Showing {filteredCbse.length + filteredState.length + filteredEntrance.length} result{(filteredCbse.length + filteredState.length + filteredEntrance.length) !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-md p-3 overflow-auto" style={{ maxHeight: '55vh' }}>
                <div className="space-y-5">
                  {(filteredCbse.length > 0) && (
                    <div className="space-y-2">
                      <div className="sticky top-0 bg-background z-10 -mx-3 px-3 py-1 border-b">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-semibold">
                            CBSE Board Exams ({filteredCbse.length})
                          </Label>
                        </div>
                      </div>
                      {filteredCbse.map((exam, index) => (
                        <div 
                          key={`cbse-${exam}-${index}`}
                          className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border"
                        >
                          <Checkbox
                            id={`exam-cbse-${index}`}
                            checked={selectedExams.includes(exam)}
                            onCheckedChange={() => handleExamToggle(exam)}
                            disabled={isLoading}
                          />
                          <Label
                            htmlFor={`exam-cbse-${index}`}
                            className="cursor-pointer text-sm font-normal flex-1"
                          >
                            {exam}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {(filteredState.length > 0) && (
                    <div className="space-y-2">
                      <div className="sticky top-0 bg-background z-10 -mx-3 px-3 py-1 border-b">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-semibold">
                            State Board Exams ({filteredState.length})
                          </Label>
                        </div>
                      </div>
                      {filteredState.map((exam, index) => (
                        <div 
                          key={`state-${exam}-${index}`}
                          className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border"
                        >
                          <Checkbox
                            id={`exam-state-${index}`}
                            checked={selectedExams.includes(exam)}
                            onCheckedChange={() => handleExamToggle(exam)}
                            disabled={isLoading}
                          />
                          <Label
                            htmlFor={`exam-state-${index}`}
                            className="cursor-pointer text-sm font-normal flex-1"
                          >
                            {exam}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {(filteredEntrance.length > 0) && (
                    <div className="space-y-2">
                      <div className="sticky top-0 bg-background z-10 -mx-3 px-3 py-1 border-b">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-semibold">
                            Entrance Exams ({filteredEntrance.length})
                          </Label>
                        </div>
                      </div>
                      {filteredEntrance.map((exam, index) => (
                        <div 
                          key={`entrance-${exam}-${index}`}
                          className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border"
                        >
                          <Checkbox
                            id={`exam-entrance-${index}`}
                            checked={selectedExams.includes(exam)}
                            onCheckedChange={() => handleExamToggle(exam)}
                            disabled={isLoading}
                          />
                          <Label
                            htmlFor={`exam-entrance-${index}`}
                            className="cursor-pointer text-sm font-normal flex-1"
                          >
                            {exam}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {(filteredCbse.length + filteredState.length + filteredEntrance.length) === 0 && searchQuery && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No exams found matching "{searchQuery}"
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        className="mt-2"
                      >
                        Clear search
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="text-center py-8 flex-1 flex items-center justify-center">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {availableExams.length === 0 
                    ? "No exams available. Please check your exam mappings or contact support."
                    : "All available exams are already selected! 🎉"}
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="mt-4"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || selectedExams.length === 0 || availableExamsToAdd.length === 0}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Adding...
              </>
            ) : (
              `Add ${selectedExams.length > 0 ? `(${selectedExams.length})` : ''} Exam${selectedExams.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
