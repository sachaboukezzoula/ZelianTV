// app/actions/watchlist.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'
import type { MediaType } from '@/lib/tmdb'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileId = await getActiveProfileIdFromCookie()
  if (!profileId) return null

  return { userId: user.id, profileId }
}

export async function getWatchlistData(tmdbId: number, mediaType: MediaType) {
  const ctx = await getAuthContext()
  if (!ctx) return { user: null, listType: null, allLists: [] as string[] }

  const admin = createAdminClient()

  const [itemResult, listsResult] = await Promise.all([
    admin
      .from('user_media_lists')
      .select('list_type')
      .eq('profile_id', ctx.profileId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .maybeSingle(),
    admin
      .from('user_media_lists')
      .select('list_type')
      .eq('profile_id', ctx.profileId),
  ])

  const allLists = [...new Set((listsResult.data ?? []).map((d: { list_type: string }) => d.list_type))]

  return {
    user: ctx.userId,
    listType: (itemResult.data?.list_type ?? null) as string | null,
    allLists,
  }
}

export async function toggleWatchlist(
  tmdbId: number,
  mediaType: MediaType,
  target: string,
  currentListType: string | null,
  posterPath?: string | null,
  title?: string | null,
) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()

  if (currentListType === target) {
    const { error } = await admin
      .from('user_media_lists')
      .delete()
      .eq('profile_id', ctx.profileId)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
    if (error) return { error: error.message }
    revalidatePath('/profil')
    return { listType: null as string | null }
  } else {
    const { error } = await admin
      .from('user_media_lists')
      .upsert(
        {
          user_id: ctx.userId,
          profile_id: ctx.profileId,
          tmdb_id: tmdbId,
          media_type: mediaType,
          list_type: target,
        },
        { onConflict: 'profile_id,tmdb_id,media_type' }
      )
      .select()
    if (error) return { error: error.message }
    revalidatePath('/profil')
    return { listType: target as string | null }
  }
}

export async function getUserLists(): Promise<string[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  const admin = createAdminClient()
  // Fusionne les listes « tag » (films présents) ET les listes-entités vides (user_lists)
  const [{ data: mediaRows }, { data: listRows }] = await Promise.all([
    admin.from('user_media_lists').select('list_type').eq('profile_id', ctx.profileId),
    admin.from('user_lists').select('name').eq('profile_id', ctx.profileId),
  ])

  const fromMedia = (mediaRows ?? []).map((d: { list_type: string }) => d.list_type)
  const fromEntities = (listRows ?? []).map((d: { name: string }) => d.name)
  return [...new Set([...fromMedia, ...fromEntities])]
}

export async function getWatchlistStatus(tmdbId: number, mediaType: MediaType) {
  const data = await getWatchlistData(tmdbId, mediaType)
  return { user: data.user, listType: data.listType }
}

export async function removeFromList(id: string) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_media_lists')
    .delete()
    .eq('id', id)
    .eq('profile_id', ctx.profileId)

  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}

export async function deleteList(listType: string) {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_media_lists')
    .delete()
    .eq('profile_id', ctx.profileId)
    .eq('list_type', listType)

  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}

export async function reorderItems(
  listType: string,
  orderedIds: string[],
): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }
  if (!orderedIds.length) return {}

  const admin = createAdminClient()

  const updates = orderedIds.map((id, index) =>
    admin
      .from('user_media_lists')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('profile_id', ctx.profileId)
  )

  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/profil')
  return {}
}

export async function moveToList(
  id: string,
  newListType: string,
): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()

  const { data: maxData } = await admin
    .from('user_media_lists')
    .select('sort_order')
    .eq('profile_id', ctx.profileId)
    .eq('list_type', newListType)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxData?.sort_order ?? -1) + 1

  const { error } = await admin
    .from('user_media_lists')
    .update({ list_type: newListType, sort_order: nextOrder })
    .eq('id', id)
    .eq('profile_id', ctx.profileId)

  if (error) return { error: error.message }

  revalidatePath('/profil')
  return {}
}

export async function getProfileStats(profileId: string): Promise<{ mediaCount: number; listCount: number }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_media_lists')
    .select('list_type')
    .eq('profile_id', profileId)

  if (!data) return { mediaCount: 0, listCount: 0 }
  return {
    mediaCount: data.length,
    listCount: new Set(data.map((d: { list_type: string }) => d.list_type)).size,
  }
}
