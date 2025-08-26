import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'

interface Organization {
  org_id: string
  org_name: string
  org_slug: string
  user_role: string
  org_settings: any
  member_count: number
}

interface OrganizationContextType {
  organization: Organization | null
  loading: boolean
  error: string | null
  refreshOrganization: () => Promise<void>
  updateOrganizationSettings: (partialSettings: any) => Promise<{ success: boolean; error?: string }>
  createOrganization: (companyName: string, fullName?: string) => Promise<{ success: boolean; error?: string }>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

interface OrganizationProviderProps {
  children: React.ReactNode
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const ensureOrgExists = async (fallbackCompany?: string) => {
    try {
      const fullName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || 'Owner'
      const companyName = fallbackCompany || (organization?.org_name) || (user as any)?.user_metadata?.company_name || 'My Company'
      await supabase.rpc('ensure_user_org', { p_company_name: companyName, p_full_name: fullName })
    } catch (e) {
      console.warn('[Organization] ensureOrgExists failed (non-fatal)', e)
    }
  }

  const createOrganization = async (companyName: string, fullName?: string) => {
    try {
      if (!user) return { success: false, error: 'Not signed in' }
      const fallbackName = fullName || (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || 'Owner'
      const { error } = await supabase.rpc('ensure_user_org', { p_company_name: companyName || 'My Company', p_full_name: fallbackName })
      if (error) throw error
      await fetchOrganization()
      return { success: true }
    } catch (e: any) {
      console.error('[Organization] createOrganization failed', e)
      return { success: false, error: e?.message || 'Failed to create organization' }
    }
  }

  const fetchOrganization = async () => {
    // console.debug('[Organization] fetchOrganization start', { hasUser: !!user })
    if (!user) {
      setOrganization(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.rpc('get_user_org_info')
      // console.debug('[Organization] get_user_org_info result', { error, rows: Array.isArray(data) ? data.length : null, sample: Array.isArray(data) ? data[0] : null })
      if (error) throw error

      if (data && data.length > 0) {
        setOrganization(data[0])
      } else {
        // Fallback path 1: try legacy helper to get org id, then load org row
        try {
          const orgIdRes = await supabase.rpc('get_user_org')
          // console.debug('[Organization] get_user_org result', { error: orgIdRes.error, id: orgIdRes.data })
          const orgId = (orgIdRes.data as string) || null
          if (orgId) {
            const orgRow = await supabase.from('orgs').select('id, name, slug, settings').eq('id', orgId).single()
            // console.debug('[Organization] orgs select by id', { error: orgRow.error, row: orgRow.data })
            if (!orgRow.error && orgRow.data) {
              // Synthesize minimal Organization object (role unknown → 'member', member_count unknown → 1)
              setOrganization({
                org_id: orgRow.data.id,
                org_name: orgRow.data.name,
                org_slug: orgRow.data.slug,
                org_settings: orgRow.data.settings,
                user_role: 'member',
                member_count: 1,
              } as any)
              return
            }
          }
        } catch (e) {
          console.warn('[Organization] fallback get_user_org failed', e)
        }

        // Fallback path 2: attempt to provision org automatically, then retry info
        await ensureOrgExists()
        const retry = await supabase.rpc('get_user_org_info')
        // console.debug('[Organization] get_user_org_info retry', { error: retry.error, rows: Array.isArray(retry.data) ? retry.data.length : null })
        if (!retry.error && Array.isArray(retry.data) && retry.data.length > 0) {
          setOrganization(retry.data[0])
        } else {
          setOrganization(null)
        }
      }
    } catch (err) {
      console.error('Error fetching organization:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch organization')
    } finally {
      setLoading(false)
      // console.debug('[Organization] fetchOrganization done', { hasOrg: !!organization })
    }
  }

  const refreshOrganization = async () => {
    await fetchOrganization()
  }

  const updateOrganizationSettings = async (partialSettings: any) => {
    try {
      // Resolve org id reliably even if state has not hydrated yet
      // console.debug('[Organization] updateSettings start', { partialSettings, hasOrgInState: !!organization })
      let orgId = organization?.org_id
      let currentSettings: any = organization?.org_settings || {}
      if (!orgId) {
        // console.debug('[Organization] updateSettings: no org in state, fetching via get_user_org_info')
        const { data, error } = await supabase.rpc('get_user_org_info')
        // console.debug('[Organization] updateSettings: get_user_org_info result', { error, rows: Array.isArray(data) ? data.length : null, sample: Array.isArray(data) ? data[0] : null })
        if (error) throw error
        let row = Array.isArray(data) ? data[0] : null
        if (!row) {
          // Attempt to provision an org automatically, then retry once
          const fallbackCompany = partialSettings?.companyName || 'My Company'
          try {
            // console.debug('[Organization] updateSettings: calling ensure_user_org', { fallbackCompany })
            await supabase.rpc('ensure_user_org', { p_company_name: fallbackCompany, p_full_name: (user as any)?.user_metadata?.full_name || 'Owner' })
          } catch (e) {
            console.warn('[Organization] ensure_user_org during updateSettings failed', e)
          }
          const retry = await supabase.rpc('get_user_org_info')
          // console.debug('[Organization] updateSettings: get_user_org_info retry', { error: retry.error, rows: Array.isArray(retry.data) ? retry.data.length : null, sample: Array.isArray(retry.data) ? retry.data[0] : null })
          if (retry.error) throw retry.error
          row = Array.isArray(retry.data) ? retry.data[0] : null
          if (!row) return { success: false, error: 'No organization loaded' }
        }
        orgId = row.org_id
        currentSettings = row.org_settings || {}
      }
      setLoading(true)
      const next = { ...currentSettings, ...partialSettings }
      // console.debug('[Organization] updateSettings applying', { orgId, currentSettings, partialSettings, next })
      const { error } = await supabase
        .from('orgs')
        .update({ settings: next })
        .eq('id', orgId as string)
      if (error) {
        console.error('[Organization] updateSettings supabase update error', error)
        throw error
      }
      // console.debug('[Organization] updateSettings supabase update ok')
      await fetchOrganization()
      // console.debug('[Organization] updateSettings success')
      return { success: true }
    } catch (e: any) {
      setError(e?.message || 'Failed to update organization settings')
      console.error('[Organization] updateSettings failed', e)
      return { success: false, error: e?.message || 'Failed to update organization settings' }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganization()
  }, [user])

  const value = {
    organization,
    loading,
    error,
    refreshOrganization,
    updateOrganizationSettings,
    createOrganization,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

