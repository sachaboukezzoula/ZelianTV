// app/profil/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from '@/app/profil/ProfileClient'
import { getRecommendations } from '@/lib/recommendations'
import { getMediaDetail, getTitle, getYear, backdropUrl } from '@/lib/tmdb'
import type { MediaType } from '@/lib/tmdb'
import type { FeaturedFilm, LikedItem } from '@/app/profil/ProfileClient'
import { getLikedMedia } from '@/app/actions/likes'
import { getLists } from '@/app/actions/lists'
import type { ListEntity } from '@/app/actions/lists'
import { getActiveProfileId } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/app/actions/profiles'

function formatRuntime(min: number | undefined): string | null {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profileId = await getActiveProfileId()
  if (!profileId) redirect('/login')

  const admin = createAdminClient()

  const [{ data: lists }, { data: prefs }, { data: profileData }] = await Promise.all([
    admin
      .from('user_media_lists')
      .select('*')
      .eq('profile_id', profileId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    admin.from('user_preferences').select('*').eq('profile_id', profileId).maybeSingle(),
    admin.from('profiles').select('*').eq('id', profileId).eq('user_id', user.id).single(),
  ])

  const activeProfile = profileData as Profile | null
  const rawLists = lists ?? []

  const enriched = await Promise.all(
    rawLists.map(async (item: { tmdb_id: number; media_type: string; poster_path: string | null; title: string | null; [key: string]: unknown }) => {
      try {
        const media = await getMediaDetail(item.tmdb_id, item.media_type as MediaType)
        return {
          ...item,
          poster_path: item.poster_path ?? media.poster_path ?? null,
          title: item.title ?? media.title ?? media.name ?? null,
          overview: media.overview ?? null,
          vote_average: media.vote_average ?? null,
          year: getYear(media),
        }
      } catch {
        return { ...item, overview: null, vote_average: null, year: null }
      }
    })
  )

  const preferredGenres = (prefs?.preferred_genres ?? []) as number[]

  const watchedItems = enriched.filter((i) => (i as unknown as { list_type: string }).list_type === 'watched')
  const watchlistItems = enriched.filter((i) => (i as unknown as { list_type: string }).list_type === 'watchlist')
  const recommendations = watchedItems.length > 0
    ? await getRecommendations(watchedItems as { tmdb_id: number; media_type: string }[]).catch(() => [])
    : []

  // Note moyenne des films « déjà vu » notés
  const ratedWatched = watchedItems.filter((i) => (i as unknown as { rating: number | null }).rating != null)
  const avgRating = ratedWatched.length > 0
    ? (ratedWatched.reduce((s, i) => s + ((i as unknown as { rating: number }).rating), 0) / ratedWatched.length).toFixed(1)
    : null

  // Film mis en avant dans le héro : premier « à voir », sinon premier « déjà vu »
  const featuredSource = (watchlistItems[0] ?? watchedItems[0]) as
    | { tmdb_id: number; media_type: string }
    | undefined
  let featured: FeaturedFilm | null = null
  if (featuredSource) {
    try {
      const d = await getMediaDetail(featuredSource.tmdb_id, featuredSource.media_type as MediaType)
      featured = {
        tmdb_id: featuredSource.tmdb_id,
        media_type: featuredSource.media_type,
        title: getTitle(d),
        backdropUrl: backdropUrl(d.backdrop_path, 'w1280'),
        rating: d.vote_average ? d.vote_average.toFixed(1) : null,
        year: getYear(d),
        genre: d.genres?.[0]?.name ?? null,
        runtime: formatRuntime(d.runtime),
        overview: d.overview ?? '',
      }
    } catch {
      featured = null
    }
  }

  // Films « aimés » (❤) — table indépendante des listes
  const likedRaw = await getLikedMedia(profileId)
  const likedItems = (
    await Promise.all(
      likedRaw.map(async (l): Promise<LikedItem | null> => {
        try {
          const m = await getMediaDetail(l.tmdb_id, l.media_type)
          return {
            tmdb_id: l.tmdb_id,
            media_type: l.media_type,
            poster_path: m.poster_path ?? null,
            title: getTitle(m),
            overview: m.overview ?? null,
            vote_average: m.vote_average ?? null,
            year: getYear(m),
          }
        } catch {
          return null
        }
      })
    )
  ).filter((x): x is LikedItem => x !== null)

  // Listes personnalisées (entités : nom + cover). [] si la table n'existe pas encore.
  const customLists: ListEntity[] = await getLists(profileId)

  return (
    <ProfileClient
      user={user}
      lists={enriched as unknown as Parameters<typeof ProfileClient>[0]['lists']}
      preferredGenres={preferredGenres}
      recommendations={recommendations}
      activeProfile={activeProfile}
      featured={featured}
      avgRating={avgRating}
      likedItems={likedItems}
      customLists={customLists}
    />
  )
}
