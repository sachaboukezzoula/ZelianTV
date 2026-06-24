// app/profil/page.tsx
import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from '@/app/profil/ProfileClient'
import { AuthTabs } from '@/components/auth/AuthTabs'
import { getRecommendations } from '@/lib/recommendations'
import { getMediaDetail } from '@/lib/tmdb'
import type { MediaType } from '@/lib/tmdb'
import { getActiveProfileId } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/app/actions/profiles'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <AuthTabs />

  const profileId = await getActiveProfileId()
  if (!profileId) return <AuthTabs />

  const admin = createAdminClient()

  const [{ data: lists }, { data: prefs }, { data: profileData }] = await Promise.all([
    admin.from('user_media_lists').select('*').eq('profile_id', profileId),
    admin.from('user_preferences').select('*').eq('profile_id', profileId).maybeSingle(),
    admin.from('profiles').select('*').eq('id', profileId).eq('user_id', user.id).single(),
  ])

  const activeProfile = profileData as Profile | null
  const rawLists = lists ?? []

  const enriched = await Promise.all(
    rawLists.map(async (item: { tmdb_id: number; media_type: string; poster_path: string | null; title: string | null; [key: string]: unknown }) => {
      if (item.poster_path && item.title) return item
      try {
        const media = await getMediaDetail(item.tmdb_id, item.media_type as MediaType)
        return { ...item, poster_path: media.poster_path ?? null, title: media.title ?? media.name ?? null }
      } catch { return item }
    })
  )

  const preferredGenres = (prefs?.preferred_genres ?? []) as number[]

  const watchedItems = enriched.filter((i) => (i as unknown as { list_type: string }).list_type === 'watched')
  const recommendations = watchedItems.length > 0
    ? await getRecommendations(watchedItems as { tmdb_id: number; media_type: string }[])
    : []

  return (
    <ProfileClient
      user={user}
      lists={enriched as unknown as Parameters<typeof ProfileClient>[0]['lists']}
      preferredGenres={preferredGenres}
      recommendations={recommendations}
      activeProfile={activeProfile}
    />
  )
}
