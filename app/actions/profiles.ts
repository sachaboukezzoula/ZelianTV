'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { MAX_PROFILES, PROFILE_COOKIE } from '@/lib/profile'

export interface Profile {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  color: string
  created_at: string
}

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfiles(): Promise<Profile[]> {
  const user = await getAuthUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (data ?? []) as Profile[]
}

export async function createProfile(
  name: string,
  avatarUrl: string | null,
  color: string,
): Promise<{ error: string } | { profile: Profile }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Le nom est requis.' }

  const admin = createAdminClient()

  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= MAX_PROFILES) {
    return { error: `Maximum ${MAX_PROFILES} profils par compte.` }
  }

  const { data, error } = await admin
    .from('profiles')
    .insert({ user_id: user.id, name: trimmed, avatar_url: avatarUrl, color })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/profils')
  return { profile: data as Profile }
}

export async function updateProfile(
  id: string,
  name: string,
  avatarUrl: string | null,
  color: string,
): Promise<{ error: string } | Record<string, never>> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Le nom est requis.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ name: trimmed, avatar_url: avatarUrl, color })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profils')
  revalidatePath('/profil')
  return {}
}

export async function deleteProfile(id: string): Promise<{ error: string } | Record<string, never>> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const admin = createAdminClient()

  const { count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) <= 1) {
    return { error: 'Impossible de supprimer le dernier profil.' }
  }

  const { error } = await admin
    .from('profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  const c = await cookies()
  if (c.get(PROFILE_COOKIE)?.value === id) {
    c.delete(PROFILE_COOKIE)
  }

  revalidatePath('/profils')
  return {}
}

export async function setActiveProfile(profileId: string): Promise<{ error: string } | Record<string, never>> {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single()

  if (!data) return { error: 'Profil introuvable.' }

  const c = await cookies()
  c.set(PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return {}
}
