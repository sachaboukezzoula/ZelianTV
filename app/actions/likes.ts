'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'
import type { MediaType } from '@/lib/tmdb'

const TABLE = 'user_liked_media'

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const profileId = await getActiveProfileIdFromCookie()
  if (!profileId) return null
  return { userId: user.id, profileId }
}

export async function getLikedStatus(tmdbId: number, mediaType: MediaType): Promise<boolean> {
  const ctx = await getCtx()
  if (!ctx) return false
  const admin = createAdminClient()
  const { data } = await admin
    .from(TABLE)
    .select('id')
    .eq('profile_id', ctx.profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle()
  return !!data
}

export async function toggleLike(
  tmdbId: number,
  mediaType: MediaType,
): Promise<{ liked: boolean } | { error: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from(TABLE)
    .select('id')
    .eq('profile_id', ctx.profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle()

  if (existing) {
    const { error } = await admin.from(TABLE).delete().eq('id', existing.id)
    if (error) return { error: error.message }
    revalidatePath('/profil')
    return { liked: false }
  }

  const { error } = await admin.from(TABLE).insert({
    user_id: ctx.userId,
    profile_id: ctx.profileId,
    tmdb_id: tmdbId,
    media_type: mediaType,
  })
  if (error) return { error: error.message }
  revalidatePath('/profil')
  return { liked: true }
}

/** Ajout idempotent aux « Aimés » (utilisé par le glisser-déposer vers la pastille Aimés). */
export async function likeMedia(
  tmdbId: number,
  mediaType: MediaType,
): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from(TABLE)
    .select('id')
    .eq('profile_id', ctx.profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle()
  if (existing) return {}
  const { error } = await admin.from(TABLE).insert({
    user_id: ctx.userId,
    profile_id: ctx.profileId,
    tmdb_id: tmdbId,
    media_type: mediaType,
  })
  if (error) return { error: error.message }
  revalidatePath('/profil')
  return {}
}

export async function getLikedMedia(
  profileId: string,
): Promise<{ tmdb_id: number; media_type: MediaType }[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from(TABLE)
    .select('tmdb_id, media_type')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
  return (data ?? []) as { tmdb_id: number; media_type: MediaType }[]
}
