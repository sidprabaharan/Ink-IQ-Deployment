import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Star, Paperclip, Archive, Trash2, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Email } from "@/types/email";

interface ModernEmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onEmailSelect: (emailId: string) => void;
  selectedEmails: string[];
  onEmailsSelect: (emailIds: string[]) => void;
  onStarToggle: (emailId: string) => void;
  onArchive: (emailIds: string[]) => void;
  onDelete: (emailIds: string[]) => void;
}

export function ModernEmailList({
  emails,
  selectedEmailId,
  onEmailSelect,
  selectedEmails,
  onEmailsSelect,
  onStarToggle,
  onArchive,
  onDelete,
}: ModernEmailListProps) {
  const [hoveredEmail, setHoveredEmail] = useState<string | null>(null);

  const sanitizePreview = (text: string) => {
    if (!text) return '';
    try {
      // eslint-disable-next-line deprecation/deprecation
      const decoded = decodeURIComponent(escape(text));
      const bad = /Ã|Â|â|â€¢|â¢/.test(text);
      text = bad && !/Ã|Â|â|â€¢|â¢/.test(decoded) ? decoded : text;
    } catch {}
    return text
      .replace(/Â\s?/g, ' ')
      .replace(/â/g, '—')
      .replace(/â/g, '–')
      .replace(/â/g, '’')
      .replace(/â/g, '‘')
      .replace(/â/g, '“')
      .replace(/â/g, '”')
      .replace(/â¦/g, '…')
      .replace(/â¢/g, '•')
      .replace(/â€¢/g, '•')
      .replace(/\u00A0/g, ' ');
  };

  const handleEmailSelect = (emailId: string) => {
    const isSelected = selectedEmails.includes(emailId);
    if (isSelected) {
      onEmailsSelect(selectedEmails.filter(id => id !== emailId));
    } else {
      onEmailsSelect([...selectedEmails, emailId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === emails.length) {
      onEmailsSelect([]);
    } else {
      onEmailsSelect(emails.map(email => email.id));
    }
  };

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-24 w-24 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <h3 className="text-lg font-medium mb-2">No emails found</h3>
          <p className="text-muted-foreground">
            There are no emails in this folder or account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Bulk Actions */}
      {selectedEmails.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-700">
              {selectedEmails.length} selected
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(selectedEmails)}
                className="text-blue-700 hover:bg-blue-100"
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(selectedEmails)}
                className="text-blue-700 hover:bg-blue-100"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conversations */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`group flex items-start gap-3 p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all hover:bg-white/80 ${
                selectedEmailId === email.id 
                  ? 'bg-blue-500 shadow-lg' 
                  : !email.read 
                    ? 'bg-white shadow-sm' 
                    : 'bg-gray-50/50'
              }`}
              onClick={() => onEmailSelect(email.id)}
            >
              {/* Avatar */}
              <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-white/20">
                  <AvatarImage 
                    src={`https://images.unsplash.com/photo-${Math.floor(Math.random() * 10) + 1600000000000}-${Math.floor(Math.random() * 1000000)}?w=80&h=80&fit=crop&crop=face`} 
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold">
                    {email.from.name[0]?.toUpperCase() || email.from.email[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!email.read && selectedEmailId !== email.id && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold truncate ${
                    selectedEmailId === email.id ? 'text-white' : 'text-gray-900'
                  }`}>
                    {email.from.name || email.from.email}
                  </span>
                  <span className={`text-xs ${
                    selectedEmailId === email.id ? 'text-white/80' : 'text-gray-500'
                  }`}>
                    {formatDistanceToNow(new Date(email.date), { addSuffix: true }).replace(' ago', '')}
                  </span>
                </div>
                
                <div className="mb-1">
                  <span className={`text-sm font-medium block truncate ${
                    selectedEmailId === email.id ? 'text-white/90' : 'text-gray-700'
                  }`}>
                    {email.subject}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-xs truncate flex-1 ${
                    selectedEmailId === email.id ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {sanitizePreview(email.content).substring(0, 60)}...
                  </span>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {email.attachments.length > 0 && (
                      <Paperclip className={`h-3 w-3 ${
                        selectedEmailId === email.id ? 'text-white/70' : 'text-gray-400'
                      }`} />
                    )}
                    
                    {/* Selection and Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Checkbox
                        checked={selectedEmails.includes(email.id)}
                        onCheckedChange={() => handleEmailSelect(email.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4"
                      />
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStarToggle(email.id);
                        }}
                        className={`${
                          selectedEmailId === email.id ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            email.starred ? 'fill-yellow-400 text-yellow-400' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}