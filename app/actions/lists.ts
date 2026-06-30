'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'

const RESERVED = ['à voir', 'déjà vu', 'watchlist', 'watched']

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const profileId = await getActiveProfileIdFromCookie()
  if (!profileId) return null
  return { userId: user.id, profileId }
}

export interface ListEntity {
  name: string
  cover_url: string | null
}

export async function getLists(profileId: string): Promise<ListEntity[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_lists')
    .select('name, cover_url')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ListEntity[]
}

export async function createList(name: string): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Nom requis.' }
  if (RESERVED.includes(trimmed.toLowerCase())) return { error: 'Ce nom est réservé.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_lists')
    .upsert(
      { user_id: ctx.userId, profile_id: ctx.profileId, name: trimmed },
      { onConflict: 'profile_id,name', ignoreDuplicates: true },
    )
  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}

export async function renameList(oldName: string, newName: string): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Nom requis.' }
  if (RESERVED.includes(trimmed.toLowerCase())) return { error: 'Ce nom est réservé.' }
  if (trimmed === oldName) return {}

  const admin = createAdminClient()

  // S'assurer que l'entité existe (cas d'une liste « tag » héritée)
  await admin
    .from('user_lists')
    .upsert({ user_id: ctx.userId, profile_id: ctx.profileId, name: oldName }, { onConflict: 'profile_id,name', ignoreDuplicates: true })

  const { error: e1 } = await admin
    .from('user_lists')
    .update({ name: trimmed })
    .eq('profile_id', ctx.profileId)
    .eq('name', oldName)
  if (e1) return { error: e1.message }

  const { error: e2 } = await admin
    .from('user_media_lists')
    .update({ list_type: trimmed })
    .eq('profile_id', ctx.profileId)
    .eq('list_type', oldName)
  if (e2) return { error: e2.message }

  revalidatePath('/profil')
  return {}
}

export async function setListCover(name: string, coverUrl: string | null): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_lists')
    .upsert(
      { user_id: ctx.userId, profile_id: ctx.profileId, name, cover_url: coverUrl },
      { onConflict: 'profile_id,name' },
    )
  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}

export async function deleteCustomList(name: string): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const admin = createAdminClient()

  await admin.from('user_lists').delete().eq('profile_id', ctx.profileId).eq('name', name)
  const { error } = await admin
    .from('user_media_lists')
    .delete()
    .eq('profile_id', ctx.profileId)
    .eq('list_type', name)
  if (error) return { error: error.message }

  revalidatePath('/profil')
  return {}
}

export async function uploadListCoverAction(
  formData: FormData,
  listName: string,
): Promise<{ url: string } | { error: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Fichier manquant' }

  const admin = createAdminClient()
  await admin.storage.createBucket('list-covers', { public: true }).catch(() => {})

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const slug = listName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'liste'
  const fileName = `${ctx.profileId}-${slug}-${Date.now()}.jpg`

  const { error: uploadError } = await admin.storage
    .from('list-covers')
    .upload(fileName, buffer, { upsert: true, contentType: 'image/jpeg' })
  if (uploadError) return { error: `Upload échoué : ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('list-covers').getPublicUrl(fileName)
  const url = `${publicUrl}?t=${Date.now()}`

  const res = await setListCover(listName, url)
  if ('error' in res) return { error: res.error }
  return { url }
}
