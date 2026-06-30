'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'
import type { MediaType } from '@/lib/tmdb'

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const profileId = await getActiveProfileIdFromCookie()
  if (!profileId) return null
  return { userId: user.id, profileId }
}

/** Note Zelectron de l'utilisateur pour un titre (null si non noté). */
export async function getRating(tmdbId: number, mediaType: MediaType): Promise<{ canRate: boolean; rating: number | null }> {
  const ctx = await getCtx()
  if (!ctx) return { canRate: false, rating: null }
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_media_lists')
    .select('rating')
    .eq('profile_id', ctx.profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle()
  return { canRate: true, rating: (data?.rating ?? null) as number | null }
}

/** Définit la note Zelectron (1..10). rating <= 0 efface la note. Noter un titre le marque « déjà vu » s'il ne l'était pas. */
export async function setRating(
  tmdbId: number,
  mediaType: MediaType,
  rating: number,
): Promise<{ rating: number | null } | { error: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Non connecté' }
  const value = rating > 0 ? Math.min(10, Math.max(1, Math.round(rating))) : null

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('user_media_lists')
    .select('id')
    .eq('profile_id', ctx.profileId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle()

  if (existing) {
    const { error } = await admin.from('user_media_lists').update({ rating: value }).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    // Noter un titre = le marquer « déjà vu »
    const { error } = await admin.from('user_media_lists').insert({
      user_id: ctx.userId,
      profile_id: ctx.profileId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      list_type: 'watched',
      rating: value,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/profil')
  revalidatePath(`/media/${mediaType}-${tmdbId}`)
  return { rating: value }
}
