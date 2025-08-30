import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

type NotificationRow = {
  id: string
  created_at: string
  read_at: string | null
  org_id: string
  user_id: string | null
  level: 'info' | 'warn' | 'error' | string
  title: string
  message: string | null
}

export function SystemNotifications() {
  const { toast } = useToast()
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setRows((data as any) || [])
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to load notifications', description: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setRows(prev => prev.map(r => (r.id === id ? { ...r, read_at: new Date().toISOString() } as any : r)))
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to mark as read', description: e?.message || 'Unknown error' })
    }
  }

  const markAllAsRead = async () => {
    try {
      const ids = rows.filter(r => !r.read_at).map(r => r.id)
      if (ids.length === 0) return
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
      setRows(prev => prev.map(r => (r.read_at ? r : { ...r, read_at: new Date().toISOString() } as any)))
      toast({ title: 'All notifications marked as read' })
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to mark all as read', description: e?.message || 'Unknown error' })
    }
  }

  const triggerTestAutomation = async () => {
    try {
      console.groupCollapsed('[Notifications] triggerTestAutomation')
      // Find a quote for the current org
      // Prefer a non-approved quote so we can transition to approved
      let q = await supabase
        .from('quotes')
        .select('id,status')
        .neq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if ((!q.data || q.error) && !q.data?.id) {
        // Fallback to latest quote if none found; the RPC may reject backward transitions
        q = await supabase
          .from('quotes')
          .select('id,status')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      }
      console.debug('latest quote result', { error: q.error, data: q.data })
      if (q.error || !q.data?.id) throw q.error || new Error('No quotes found')
      const quoteId = q.data.id
      const current = (q.data as any).status as string | null
      // Ensure an actual status change occurs. If already approved, step to 'sent' first.
      if (current && current.toLowerCase() === 'approved') {
        const step = await supabase.rpc('update_quote_status', { quote_id: quoteId, new_status: 'sent', notes: null })
        console.debug('status step → sent', { error: step.error, data: step.data })
        if (step.error) throw step.error
      }
      const final = await supabase.rpc('update_quote_status', { quote_id: quoteId, new_status: 'approved', notes: null })
      console.debug('status final → approved', { error: final.error, data: final.data })
      if (final.error) throw final.error
      toast({ title: 'Test event queued', description: 'Quote status changed to approved. Automations will process shortly.' })
      console.groupEnd?.()
    } catch (e: any) {
      console.warn('[Notifications] triggerTestAutomation failed', e)
      toast({ variant: 'destructive', title: 'Failed to trigger test', description: e?.message || 'Unknown error' })
      try { console.groupEnd?.() } catch {}
    }
  }

  const runWorkerNow = async () => {
    try {
      // Call the Edge Function via supabase-js to process queued events immediately
      console.groupCollapsed('[Notifications] runWorkerNow')
      const { data, error } = await (supabase as any).functions.invoke('automation-dispatcher')
      console.debug('edge function response', { error, data })
      if (error) throw error
      toast({ title: 'Worker ran', description: `Processed: ${(data && (data.processed || 'ok'))}` })
      await load()
      console.groupEnd?.()
    } catch (e: any) {
      console.warn('[Notifications] runWorkerNow failed', e)
      toast({ variant: 'destructive', title: 'Worker run failed', description: e?.message || 'Unknown error' })
      try { console.groupEnd?.() } catch {}
    }
  }

  const runEmailSenderNow = async () => {
    try {
      console.groupCollapsed('[Notifications] runEmailSenderNow')
      const { data, error } = await (supabase as any).functions.invoke('email-sender')
      console.debug('email-sender response', { error, data })
      if (error) throw error
      toast({ title: 'Email sender ran', description: `Sent: ${(data && (data.sent || 0))}` })
      await load()
      console.groupEnd?.()
    } catch (e: any) {
      console.warn('[Notifications] runEmailSenderNow failed', e)
      toast({ variant: 'destructive', title: 'Email sender failed', description: e?.message || 'Unknown error' })
      try { console.groupEnd?.() } catch {}
    }
  }

  useEffect(() => { load() }, [])

  const levelBadge = (lvl: string) => {
    const v = (lvl || 'info').toLowerCase()
    if (v === 'error') return <Badge variant="destructive">Error</Badge>
    if (v === 'warn' || v === 'warning') return <Badge variant="secondary">Warning</Badge>
    return <Badge variant="outline">Info</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">System Notifications</h3>
          <p className="text-sm text-muted-foreground">Events generated by automations and the system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={triggerTestAutomation} variant="secondary">Trigger test automation</Button>
          <Button onClick={runWorkerNow} variant="outline">Run worker now</Button>
          <Button onClick={runEmailSenderNow} variant="outline">Run email sender now</Button>
          <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
          <Button onClick={markAllAsRead} variant="secondary" disabled={loading || rows.every(r => r.read_at)}>Mark all as read</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Notifications</CardTitle>
          <CardDescription>Newest first (max 200)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">When</TableHead>
                <TableHead className="w-[90px]">Level</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No notifications</TableCell>
                </TableRow>
              )}
              {rows.map(n => (
                <TableRow key={n.id}>
                  <TableCell>{new Date(n.created_at).toLocaleString()}</TableCell>
                  <TableCell>{levelBadge(n.level)}</TableCell>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="truncate max-w-[480px]">{n.message}</TableCell>
                  <TableCell>{n.read_at ? <Badge variant="outline">Read</Badge> : <Badge variant="secondary">Unread</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {!n.read_at && (
                      <Button size="sm" variant="outline" onClick={() => markAsRead(n.id)}>Mark read</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


