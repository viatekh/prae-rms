import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'staff'
  created_at: string
}

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined) // undefined = loading
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session?.user?.id])

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const updateProfile = async (updates: Partial<Pick<Profile, 'full_name'>>) => {
    if (!session?.user) return
    const { data } = await supabase.from('profiles').update(updates).eq('id', session.user.id).select().single()
    if (data) setProfile(data)
  }

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading: session === undefined,
    isAdmin: profile?.role === 'admin',
    signIn,
    signOut,
    updateProfile,
  }
}
