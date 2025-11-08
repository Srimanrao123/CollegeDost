import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, Link as LinkIcon } from "lucide-react";
import { useState, useRef } from "react";
import { EmojiPicker } from "@/components/ui/emoji-picker";

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextEditor({ value, onChange }: TextEditorProps) {
  const [selectedText, setSelectedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + emoji + value.substring(end);
    onChange(newValue);
    
    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleFormat = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let formattedText = "";
    
    switch (format) {
      case "bold":
        formattedText = `**${selectedText}**`;
        break;
      case "italic":
        formattedText = `*${selectedText}*`;
        break;
      case "list":
        formattedText = `\n- ${selectedText}`;
        break;
      case "link":
        formattedText = `[${selectedText}](url)`;
        break;
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2 border rounded-t-lg bg-secondary/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleFormat("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleFormat("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleFormat("list")}
          title="List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleFormat("link")}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="ml-auto">
          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        placeholder="Text (optional)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="rounded-t-none resize-none"
      />
    </div>
  );
}
