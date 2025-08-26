
import React from "react";
import { Textarea } from "@/components/ui/textarea";

interface NotesSectionProps {
  title: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function NotesSection({ title, placeholder = "Write text here ...", value, onChange }: NotesSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-medium">{title}</h3>
      <Textarea 
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px]"
      />
    </div>
  );
}
