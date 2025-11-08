import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus } from "lucide-react";

interface TagSelectorProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagSelector({ availableTags, selectedTags, onTagsChange }: TagSelectorProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Tags</label>
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge key={tag} variant="secondary" className="pl-3 pr-1">
            {tag}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1"
              onClick={() => removeTag(tag)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
