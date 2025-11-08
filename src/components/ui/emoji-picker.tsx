import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Common emoji categories
const EMOJI_CATEGORIES = {
  smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙"],
  gestures: ["👋", "🤚", "🖐", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "❣️"],
  objects: ["⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️"],
  symbols: ["❤️", "💯", "✅", "⭐", "🌟", "✨", "🔥", "💪", "👍", "👎", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "⚡", "💡"],
};

const ALL_EMOJIS = [
  ...EMOJI_CATEGORIES.smileys,
  ...EMOJI_CATEGORIES.gestures,
  ...EMOJI_CATEGORIES.hearts,
  ...EMOJI_CATEGORIES.objects,
  ...EMOJI_CATEGORIES.symbols,
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
}

export function EmojiPicker({ onEmojiSelect, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent 
        ref={popoverRef}
        className="w-80 p-2 bg-popover border border-border shadow-lg"
        align="start"
        side="top"
      >
        <div className="max-h-64 overflow-y-auto">
          <div className="grid grid-cols-8 gap-1">
            {ALL_EMOJIS.map((emoji, index) => (
              <button
                key={index}
                type="button"
                className="text-2xl hover:bg-accent rounded-md p-2 transition-colors cursor-pointer"
                onClick={() => handleEmojiClick(emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

