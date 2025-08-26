import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  Reply,
  ReplyAll,
  Forward,
  Download,
  MoreHorizontal,
  Paperclip,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiAccountComposer } from "./MultiAccountComposer";
import type { Email, EmailAccount } from "@/types/email";

interface EnhancedEmailDetailProps {
  email: Email;
  accounts: EmailAccount[];
  onBack: () => void;
  onStarToggle: (emailId: string) => void;
  onArchive: (emailId: string) => void;
  onDelete: (emailId: string) => void;
  onSendEmail: (composition: any) => void;
}

export function EnhancedEmailDetail({
  email,
  accounts,
  onBack,
  onStarToggle,
  onArchive,
  onDelete,
  onSendEmail,
}: EnhancedEmailDetailProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState<'reply' | 'replyAll' | 'forward'>('reply');

  const senderAccount = accounts.find(acc => acc.id === email.accountId);

  // Normalize common encoding artifacts (mojibake) that can appear in stored bodies
  const decodeLatin1ToUtf8IfNeeded = (text: string) => {
    try {
      // Attempt to interpret the string as mis-decoded Latin1 and convert to UTF-8
      // eslint-disable-next-line deprecation/deprecation
      const decoded = decodeURIComponent(escape(text));
      // Heuristic: if decoded removes typical mojibake markers, prefer it
      const bad = /Ã|Â|â|â€¢|â¢/.test(text);
      const badAfter = /Ã|Â|â|â€¢|â¢/.test(decoded);
      return bad && !badAfter ? decoded : text;
    } catch {
      return text;
    }
  };

  const sanitizeText = (text: string) => {
    if (!text) return '';
    const base = decodeLatin1ToUtf8IfNeeded(text);
    return base
      // Remove stray \u00C2 (Â) often preceding NBSP
      .replace(/\u00C2/g, '')
      .replace(/Â\s?/g, ' ')
      // Fix UTF-8 mis-decoded punctuation
      .replace(/â/g, '—') // em dash
      .replace(/â/g, '–') // en dash
      .replace(/â/g, '’') // right single quote
      .replace(/â/g, '‘') // left single quote
      .replace(/â/g, '“') // left double quote
      .replace(/â/g, '”') // right double quote
      .replace(/â¦/g, '…')  // ellipsis
      // Bullets and common symbols
      .replace(/â¢/g, '•')
      .replace(/â€¢/g, '•')
      .replace(/â¢/g, '™')
      .replace(/â®/g, '®')
      .replace(/â©/g, '©')
      // Occasionally NBSPs show as \u00A0 or as A-circumflex space
      .replace(/\u00A0/g, ' ')
      .replace(/\s+$/gm, '');
  };

  const sanitizeHtml = (html: string) => {
    if (!html) return '';
    // Apply text sanitization to the HTML string as well
    return sanitizeText(html)
      // Normalize explicit NBSP sequences if they showed up as text
      .replace(/Â&nbsp;/g, '&nbsp;');
  };

  const handleReply = (mode: 'reply' | 'replyAll' | 'forward') => {
    setComposerMode(mode);
    setShowComposer(true);
  };

  const handleDownloadAttachment = (attachment: any) => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse the threaded conversation from content
  const parseConversation = (content: string) => {
    const messages = [];
    const parts = content.split('---').filter(part => part.trim());
    
    for (const part of parts) {
      const trimmedPart = part.trim();
      
      // Check if it's an AI response (contains the AI badge)
      if (trimmedPart.includes('AI-Generated Response')) {
        const lines = trimmedPart.split('\n');
        let fromLine = lines.find(line => line.startsWith('**From:'));
        let dateLine = lines.find(line => line.startsWith('**Date:'));
        
        if (fromLine && dateLine) {
          const fromMatch = fromLine.match(/\*\*From:\s*(.+?)\s*<(.+?)>\*\*/);
          const dateMatch = dateLine.match(/\*\*Date:\s*(.+?)\*\*/);
          
          if (fromMatch && dateMatch) {
            const messageContent = lines.slice(
              lines.findIndex(line => line.startsWith('**Date:')) + 1
            ).join('\n').trim();
            
            messages.push({
              id: `msg-${messages.length + 1}`,
              from: { name: fromMatch[1], email: fromMatch[2] },
              content: messageContent,
              date: dateMatch[1],
              isAI: true,
              aiType: trimmedPart.includes('Auto-sent') ? 'auto-reply' : 
                     trimmedPart.includes('Auto-curated') ? 'product-options' : 'quote'
            });
          }
        }
      } 
      // Check if it's a regular message (contains From: pattern)
      else if (trimmedPart.includes('**From:')) {
        const lines = trimmedPart.split('\n');
        let fromLine = lines.find(line => line.startsWith('**From:'));
        let dateLine = lines.find(line => line.startsWith('**Date:'));
        
        if (fromLine && dateLine) {
          const fromMatch = fromLine.match(/\*\*From:\s*(.+?)\s*<(.+?)>\*\*/);
          const dateMatch = dateLine.match(/\*\*Date:\s*(.+?)\*\*/);
          
          if (fromMatch && dateMatch) {
            const messageContent = lines.slice(
              lines.findIndex(line => line.startsWith('**Date:')) + 1
            ).join('\n').trim();
            
            messages.push({
              id: `msg-${messages.length + 1}`,
              from: { name: fromMatch[1], email: fromMatch[2] },
              content: messageContent,
              date: dateMatch[1],
              isAI: false
            });
          }
        }
      }
      // Initial message (first part without From: pattern)
      else if (messages.length === 0) {
        messages.push({
          id: 'msg-initial',
          from: email.from,
          content: trimmedPart,
          date: format(new Date(email.date), 'MMMM do, yyyy \'at\' h:mm a'),
          isAI: false
        });
      }
    }
    
    return messages;
  };

  const conversationMessages = parseConversation(sanitizeText(email.content || ''));
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set([conversationMessages[conversationMessages.length - 1]?.id])
  );

  const toggleMessage = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-white">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-xl font-medium">{email.subject}</h1>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStarToggle(email.id)}
            >
              <Star
                className={`h-4 w-4 ${
                  email.starred ? 'fill-yellow-500 text-yellow-500' : ''
                }`}
              />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={() => onArchive(email.id)}>
              <Archive className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={() => onDelete(email.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Labels */}
        {email.labels.length > 0 && (
          <div className="flex gap-2">
            {email.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Gmail-style Thread Messages */}
      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto">
          {conversationMessages.map((message, index) => {
            const isExpanded = expandedMessages.has(message.id);
            const isLast = index === conversationMessages.length - 1;
            
            return (
              <div key={message.id} className="border-b border-gray-100 last:border-b-0">
                {/* Message Header - Always Visible */}
                <div 
                  className="flex items-center px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleMessage(message.id)}
                >
                  <Avatar className="h-10 w-10 mr-4">
                    <AvatarImage src={message.from.avatar} />
                    <AvatarFallback>
                      {message.from.name?.[0]?.toUpperCase() || message.from.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{message.from.name}</span>
                      <span className="text-gray-500 text-sm">&lt;{message.from.email}&gt;</span>
                      {message.isAI && (
                        <div className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          AI
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">to me</span>
                      <span className="text-xs text-gray-500">{message.date}</span>
                      {message.isAI && message.aiType === 'auto-reply' && (
                        <span className="text-xs text-blue-600 font-medium">Auto-sent in 8 seconds</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!isExpanded && (
                      <div className="text-xs text-gray-500 mr-4 max-w-xs truncate">
                        {message.content.substring(0, 100)}...
                      </div>
                    )}
                    <Button variant="ghost" size="sm">
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Message Content - Expandable */}
                {isExpanded && (
                  <div className="px-6 pb-6">
                    {/* AI Badge for expanded messages */}
                    {message.isAI && (
                      <div className="mb-4">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium">
                          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                          {message.aiType === 'auto-reply' ? 'AI Auto-Reply' :
                           message.aiType === 'product-options' ? 'AI Product Recommendations' :
                           'AI-Generated Quote'}
                          <span className="text-blue-600">• 95% confidence</span>
                        </div>
                      </div>
                    )}
                    
                    {index === conversationMessages.length - 1 && email.htmlContent ? (
                      <div
                        className="prose max-w-none text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.htmlContent) }}
                      />
                    ) : (
                      <div className="prose max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                        {sanitizeText(message.content)}
                      </div>
                    )}
                    
                    {/* Message Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                      <Button variant="outline" size="sm" onClick={() => handleReply('reply')}>
                        <Reply className="h-4 w-4 mr-1" />
                        Reply
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleReply('forward')}>
                        <Forward className="h-4 w-4 mr-1" />
                        Forward
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Fallback: if no parsed messages, render the raw body (HTML preferred) */}
          {conversationMessages.length === 0 && (
            <div className="px-6 py-6">
              {email.htmlContent ? (
                <div
                  className="prose max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.htmlContent) }}
                />
              ) : (
                <div className="prose max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                  {sanitizeText(email.content || '')}
                </div>
              )}
            </div>
          )}

          {/* Attachments Section */}
          {email.attachments.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {email.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{attachment.name}</div>
                      <div className="text-xs text-gray-500">
                        {(attachment.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadAttachment(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="px-6 py-4 border-t bg-white">
            <div className="flex gap-2">
              <Button onClick={() => handleReply('reply')} className="gap-2">
                <Reply className="h-4 w-4" />
                Reply
              </Button>
              <Button variant="outline" onClick={() => handleReply('replyAll')} className="gap-2">
                <ReplyAll className="h-4 w-4" />
                Reply All
              </Button>
              <Button variant="outline" onClick={() => handleReply('forward')} className="gap-2">
                <Forward className="h-4 w-4" />
                Forward
              </Button>
            </div>

            {/* Composer */}
            {showComposer && (
              <div className="border rounded-lg p-4 bg-gray-50 mt-4">
                <MultiAccountComposer
                  accounts={accounts}
                  mode={composerMode}
                  originalEmail={email}
                  onSend={onSendEmail}
                  onCancel={() => setShowComposer(false)}
                />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}