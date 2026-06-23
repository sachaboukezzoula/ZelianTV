'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MediaType } from '@/lib/tmdb'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  console.log('[auth] user:', user?.id ?? 'null', 'error:', error?.message ?? 'none')
  return user
}

export async function getWatchlistData(tmdbId: number, mediaType: MediaType) {
  const user = await getAuthUser()
  if (!user) return { user: null, listType: null, allLists: [] as string[] }

  const admin = createAdminClient()

  const [itemResult, listsResult] = await Promise.all([
    admin
      .from('user_media_lists')
      .select('list_type')
      .eq('user_id', user.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .maybeSingle(),
    admin
      .from('user_media_lists')
      .select('list_type')
      .eq('user_id', user.id),
  ])

  const allLists = [...new Set((listsResult.data ?? []).map((d: { list_type: string }) => d.list_type))]

  return {
    user: user.id,
    listType: (itemResult.data?.list_type ?? null) as string | null,
    allLists,
  }
}

export async function toggleWatchlist(
  tmdbId: number,
  mediaType: MediaType,
  target: string,
  currentListType: string | null
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Non connecté' }

  const admin = createAdminClient()

  if (currentListType === target) {
    const { error } = await admin
      .from('user_media_lists')
      .delete()
      .eq('user_id', user.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
    console.log('[toggleWatchlist] delete error:', error?.message ?? 'none')
    if (error) return { error: error.message }
    return { listType: null as string | null }
  } else {
    const { data, error } = await admin
      .from('user_media_lists')
      .upsert(
        { user_id: user.id, tmdb_id: tmdbId, media_type: mediaType, list_type: target },
        { onConflict: 'user_id,tmdb_id,media_type' }
      )
      .select()
    console.log('[toggleWatchlist] upsert data:', JSON.stringify(data), 'error:', error?.message ?? 'none')
    if (error) return { error: error.message }
    return { listType: target as string | null }
  }
}

export async function getUserLists(): Promise<string[]> {
  const user = await getAuthUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_media_lists')
    .select('list_type')
    .eq('user_id', user.id)

  return [...new Set((data ?? []).map((d: { list_type: string }) => d.list_type))]
}

export async function getWatchlistStatus(tmdbId: number, mediaType: MediaType) {
  const data = await getWatchlistData(tmdbId, mediaType)
  return { user: data.user, listType: data.listType }
}
