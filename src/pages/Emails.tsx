import { useEffect, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AccountSwitcher } from "@/components/emails/AccountSwitcher";
import { EmailSearchHeader } from "@/components/emails/EmailSearchHeader";
import { ModernEmailList } from "@/components/emails/ModernEmailList";
import { EnhancedEmailDetail } from "@/components/emails/EnhancedEmailDetail";
import { MultiAccountComposer } from "@/components/emails/MultiAccountComposer";
import { ConnectEmailDialog } from "@/components/email/ConnectEmailDialog";
import { supabase } from "@/lib/supabase";
import type { EmailAccount, Email, EmailComposition } from "@/types/email";

export default function Emails() {
  const { toast } = useToast();
  
  // State
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'date' | 'sender' | 'subject'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'unread' | 'starred' | 'attachments'>('all');

  // Computed values
  const filteredEmails = useMemo(() => {
    let filtered = emails;

    // Filter by account
    if (selectedAccountId) {
      filtered = filtered.filter(email => email.accountId === selectedAccountId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(email =>
        email.subject.toLowerCase().includes(query) ||
        email.from.name.toLowerCase().includes(query) ||
        email.from.email.toLowerCase().includes(query) ||
        email.content.toLowerCase().includes(query)
      );
    }

    // Filter by type
    switch (filterBy) {
      case 'unread':
        filtered = filtered.filter(email => !email.read);
        break;
      case 'starred':
        filtered = filtered.filter(email => email.starred);
        break;
      case 'attachments':
        filtered = filtered.filter(email => email.attachments.length > 0);
        break;
    }

    // Sort emails
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'sender':
          return (a.from.name || a.from.email).localeCompare(b.from.name || b.from.email);
        case 'subject':
          return a.subject.localeCompare(b.subject);
        default:
          return 0;
      }
    });

    return filtered;
  }, [emails, selectedAccountId, searchQuery, filterBy, sortBy]);

  const selectedEmail = selectedEmailId 
    ? emails.find(email => email.id === selectedEmailId) 
    : null;

  // Handlers
  const handleAccountSelect = (accountId: string | null) => {
    setSelectedAccountId(accountId);
    setSelectedEmailId(null);
    setSelectedEmails([]);
  };

  const handleEmailSelect = (emailId: string) => {
    setSelectedEmailId(emailId);
    setSelectedEmails([]);
    
    // Mark as read
    setEmails(prev => prev.map(email =>
      email.id === emailId ? { ...email, read: true } : email
    ));
    
    // Update unread count
    const email = emails.find(e => e.id === emailId);
    if (email && !email.read) {
      setAccounts(prev => prev.map(acc =>
        acc.id === email.accountId 
          ? { ...acc, unreadCount: Math.max(0, acc.unreadCount - 1) }
          : acc
      ));
    }
  };

  const handleStarToggle = (emailId: string) => {
    setEmails(prev => prev.map(email =>
      email.id === emailId ? { ...email, starred: !email.starred } : email
    ));
    
    const email = emails.find(e => e.id === emailId);
    toast({
      title: email?.starred ? "Removed from starred" : "Added to starred",
      description: `Email "${email?.subject}" ${email?.starred ? 'unstarred' : 'starred'}.`,
    });
  };

  const handleArchive = (emailIds: string[]) => {
    setEmails(prev => prev.map(email =>
      emailIds.includes(email.id) ? { ...email, folder: 'archive' } : email
    ));
    
    setSelectedEmails([]);
    if (selectedEmailId && emailIds.includes(selectedEmailId)) {
      setSelectedEmailId(null);
    }
    
    toast({
      title: "Emails archived",
      description: `${emailIds.length} email(s) moved to archive.`,
    });
  };

  const handleDelete = (emailIds: string[]) => {
    setEmails(prev => prev.map(email =>
      emailIds.includes(email.id) ? { ...email, folder: 'trash' } : email
    ));
    
    setSelectedEmails([]);
    if (selectedEmailId && emailIds.includes(selectedEmailId)) {
      setSelectedEmailId(null);
    }
    
    toast({
      title: "Emails deleted",
      description: `${emailIds.length} email(s) moved to trash.`,
    });
  };

  const handleSendEmail = (composition: EmailComposition) => {
    // Create new email object
    const newEmail: Email = {
      id: `email-${Date.now()}`,
      accountId: composition.from,
      from: {
        email: accounts.find(acc => acc.id === composition.from)?.email || '',
        name: accounts.find(acc => acc.id === composition.from)?.displayName || '',
      },
      to: composition.to.map(email => ({ email, name: email })),
      cc: composition.cc?.map(email => ({ email, name: email })),
      subject: composition.subject,
      content: composition.content,
      date: new Date().toISOString(),
      read: true,
      starred: false,
      folder: 'sent',
      labels: [],
      attachments: [],
      messageId: `msg-${Date.now()}`,
      importance: 'normal',
    };

    setEmails(prev => [newEmail, ...prev]);
    setShowComposer(false);
    
    toast({
      title: "Email sent",
      description: `Email sent to ${composition.to.join(', ')}.`,
    });
  };

  const handleAddAccount = () => {
    setShowConnectDialog(true);
  };

  // Load connected accounts and recent messages
  useEffect(() => {
    const load = async () => {
      // fetch accounts
      const { data: accs, error: accErr } = await supabase
        .from('email_accounts')
        .select('id,email,provider,connected_at');
      console.log('[Emails] load accounts:', { count: (accs||[]).length, error: accErr });
      const mapped: EmailAccount[] = (accs || []).map((a: any) => ({
        id: a.id,
        email: a.email,
        provider: 'gmail',
        isConnected: true,
        status: 'online',
        unreadCount: 0,
        displayName: a.email,
      }));
      setAccounts(mapped);

      if ((accs || []).length > 0) {
        // Prefer the account that already has the most recent message
        let active = (accs as any[])[0].id as string;
        try {
          const { data: recent } = await supabase
            .from('email_messages')
            .select('account_id')
            .order('date', { ascending: false })
            .limit(1);
          if (recent && recent.length > 0 && recent[0]?.account_id) {
            active = recent[0].account_id as string;
          }
        } catch {}
        setSelectedAccountId(active);
        await loadMessagesForAccount(active);
      }
    };
    load();
  }, []);

  // Helper: load messages for a given account and trigger sync if empty
  const loadMessagesForAccount = async (accountId: string) => {
    const { data: msgs, error: selErr } = await supabase
      .from('email_messages')
      .select('provider_msg_id,account_id,subject,from:from,date,body_text,body_html')
      .eq('account_id', accountId)
      .order('date', { ascending: false })
      .limit(50);
    console.log('[Emails] fetched messages:', { accountId, count: (msgs||[]).length, error: selErr, sample: (msgs||[])[0] });
    if (!msgs || msgs.length === 0) {
      try {
        await supabase.functions.invoke('email-sync', { body: { account_id: accountId, lookback: '90' } });
        // Poll for results with backoff (up to ~10s)
        const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
        const attempts = [1500, 2000, 2500, 3000];
        for (const delay of attempts) {
          await wait(delay);
          const { data: msgs2, error: selErr2 } = await supabase
            .from('email_messages')
            .select('provider_msg_id,account_id,subject,from:from,date,body_text,body_html')
            .eq('account_id', accountId)
            .order('date', { ascending: false })
            .limit(50);
          console.log('[Emails] post-sync poll:', { accountId, delay, count: (msgs2||[]).length, error: selErr2 });
          if (msgs2 && msgs2.length > 0) {
            const mapped2: Email[] = (msgs2 as any[]).map((m: any) => ({
              id: m.provider_msg_id,
              accountId: m.account_id,
              from: (() => {
                const raw = m.from;
                if (raw && typeof raw === 'object') return { email: raw.email || String(raw || ''), name: raw.name || String(raw || '') };
                const s = String(raw || '');
                const match = s.match(/<([^>]+)>/);
                return { email: match ? match[1] : s, name: s.replace(/<[^>]+>/g,'').trim() };
              })(),
              to: [],
              subject: m.subject || '(no subject)',
              content: m.body_text || '',
              htmlContent: m.body_html || undefined,
              date: m.date,
              read: true,
              starred: false,
              folder: 'inbox',
              labels: [],
              attachments: [],
              messageId: m.provider_msg_id,
            }));
            setEmails(mapped2);
            if (mapped2.length > 0) setSelectedEmailId(mapped2[0].id);
            break;
          }
        }
      } catch {}
    } else {
      const mappedEmails: Email[] = (msgs as any[]).map((m: any) => ({
        id: m.provider_msg_id,
        accountId: m.account_id,
        from: (() => {
          const raw = m.from;
          if (raw && typeof raw === 'object') return { email: raw.email || String(raw || ''), name: raw.name || String(raw || '') };
          const s = String(raw || '');
          const match = s.match(/<([^>]+)>/);
          return { email: match ? match[1] : s, name: s.replace(/<[^>]+>/g,'').trim() };
        })(),
        to: [],
        subject: m.subject || '(no subject)',
        content: m.body_text || '',
        htmlContent: m.body_html || undefined,
        date: m.date,
        read: true,
        starred: false,
        folder: 'inbox',
        labels: [],
        attachments: [],
        messageId: m.provider_msg_id,
      }));
      setEmails(mappedEmails);
      if (mappedEmails.length > 0) setSelectedEmailId(mappedEmails[0].id);
    }
  };

  // When the user switches accounts, load that account's messages and trigger sync if empty
  useEffect(() => {
    if (!selectedAccountId) return;
    loadMessagesForAccount(selectedAccountId);
  }, [selectedAccountId]);

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-gray-50">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">Messages</h1>
            <Button 
              onClick={() => setShowComposer(true)} 
              size="sm"
              className="rounded-full w-8 h-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <AccountSwitcher
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onAccountSelect={handleAccountSelect}
            onAddAccount={handleAddAccount}
          />
        </div>

        {/* Search */}
        <div className="p-3 border-b bg-white">
          <EmailSearchHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterBy={filterBy}
            onFilterChange={setFilterBy}
          />
        </div>

        {/* Conversations List */}
        <ModernEmailList
          emails={filteredEmails}
          selectedEmailId={selectedEmailId}
          onEmailSelect={handleEmailSelect}
          selectedEmails={selectedEmails}
          onEmailsSelect={setSelectedEmails}
          onStarToggle={handleStarToggle}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedEmail ? (
          <EnhancedEmailDetail
            email={selectedEmail}
            accounts={accounts}
            onBack={() => setSelectedEmailId(null)}
            onStarToggle={handleStarToggle}
            onArchive={(emailId) => handleArchive([emailId])}
            onDelete={(emailId) => handleDelete([emailId])}
            onSendEmail={handleSendEmail}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50/50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500 text-sm">
                Choose a message from the list to start reading.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <MultiAccountComposer
                accounts={accounts}
                onSend={handleSendEmail}
                onCancel={() => setShowComposer(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Connect Email Dialog */}
      <ConnectEmailDialog 
        open={showConnectDialog} 
        onOpenChange={setShowConnectDialog} 
      />
    </div>
  );
}