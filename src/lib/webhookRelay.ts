import { supabase } from '@/lib/supabase'

type RelayOptions = {
  url: string
  payload?: any
  secret?: string
  method?: string
  headers?: Record<string, string>
}

export async function triggerViaRelay({ url, payload, secret, method = 'POST', headers }: RelayOptions) {
  const { data, error } = await supabase.functions.invoke('webhook-relay', {
    body: { url, payload, secret, method, headers },
  })
  if (error) throw error
  return data
}



