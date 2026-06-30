'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'
import { getMediaDetail, getTitleCredits, getTitle, getYear } from '@/lib/tmdb'
import type { MediaType } from '@/lib/tmdb'

export interface GenreSlice { name: string; count: number }
export interface PersonStat { id: number; name: string; count: number; profile_path: string | null }
export interface DecadeSlice { decade: string; count: number }
export interface Superlative { title: string; value: string; tmdb_id: number; media_type: string; poster_path: string | null }
export interface Badge { id: string; label: string; description: string; unlocked: boolean; progress: number; target: number }

export interface Compatibility { score: number; otherName: string; otherInitials: string; sharedGenres: string[] }

export interface ProfileStatistics {
  hasData: boolean
  year: number
  watchedCount: number
  watchlistCount: number
  totalRuntimeMinutes: number
  genresExploredCount: number
  genres: GenreSlice[]
  decades: DecadeSlice[]
  topDirectors: PersonStat[]
  topActors: PersonStat[]
  activityDates: string[]
  ratings: { userAvg: number | null; publicAvg: number | null; ratedCount: number }
  superlatives: { longest: Superlative | null; bestRated: Superlative | null; oldest: Superlative | null }
  badges: Badge[]
  compatibility: Compatibility | null
}

function emptyStats(watchlistCount = 0): ProfileStatistics {
  return {
    hasData: false, year: new Date().getFullYear(), watchedCount: 0, watchlistCount, totalRuntimeMinutes: 0, genresExploredCount: 0,
    genres: [], decades: [], topDirectors: [], topActors: [], activityDates: [],
    ratings: { userAvg: null, publicAvg: null, ratedCount: 0 },
    superlatives: { longest: null, bestRated: null, oldest: null }, badges: [],
    compatibility: null,
  }
}

function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Vecteur de genres (nb de films vus par genre) pour un profil — utilisé pour la compatibilité.
async function genreVector(admin: ReturnType<typeof createAdminClient>, profileId: string): Promise<Map<string, number>> {
  const { data } = await admin
    .from('user_media_lists')
    .select('tmdb_id, media_type')
    .eq('profile_id', profileId)
    .eq('list_type', 'watched')
  const rows = (data ?? []).slice(0, 60) as { tmdb_id: number; media_type: string }[]
  const map = new Map<string, number>()
  await Promise.all(rows.map(async (r) => {
    try {
      const d = await getMediaDetail(r.tmdb_id, r.media_type as MediaType)
      for (const g of d.genres ?? []) map.set(g.name, (map.get(g.name) ?? 0) + 1)
    } catch { /* ignore */ }
  }))
  return map
}

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const profileId = await getActiveProfileIdFromCookie()
  return { userId: user.id, profileId }
}

type Row = { tmdb_id: number; media_type: string; list_type: string; rating: number | null; created_at: string; poster_path: string | null; title: string | null }

export async function getProfileStatistics(profileId?: string): Promise<ProfileStatistics> {
  const ctx = await getCtx()
  if (!ctx) return emptyStats()

  const admin = createAdminClient()

  // Profil cible : param explicite (profil actif côté serveur) prioritaire, sinon cookie.
  // Vérifie systématiquement l'appartenance à l'utilisateur connecté.
  const target = profileId ?? ctx.profileId
  if (!target) return emptyStats()
  const { data: owned } = await admin
    .from('profiles')
    .select('id')
    .eq('id', target)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (!owned) return emptyStats()

  const { data } = await admin
    .from('user_media_lists')
    .select('*')
    .eq('profile_id', target)

  const all = (data ?? []) as Row[]
  const watched = all.filter(r => r.list_type === 'watched')
  const watchlistCount = all.filter(r => r.list_type === 'watchlist').length
  if (watched.length === 0) return emptyStats(watchlistCount)

  // Enrichissement TMDB (détails + crédits) — borné pour limiter le coût.
  const TARGETS = watched.slice(0, 120)
  const enriched = await Promise.all(
    TARGETS.map(async (r) => {
      try {
        const [d, credits] = await Promise.all([
          getMediaDetail(r.tmdb_id, r.media_type as MediaType),
          getTitleCredits(r.tmdb_id, r.media_type as MediaType).catch(() => ({ directors: [], cast: [] })),
        ])
        const runtime = d.runtime ?? d.episode_run_time?.[0] ?? 0
        const yearStr = getYear(d)
        return {
          row: r,
          title: getTitle(d),
          runtime,
          year: yearStr ? parseInt(yearStr, 10) : null,
          genres: (d.genres ?? []).map(g => g.name),
          voteAverage: d.vote_average ?? null,
          poster_path: d.poster_path ?? r.poster_path ?? null,
          directors: credits.directors,
          cast: credits.cast,
        }
      } catch {
        return null
      }
    }),
  )
  const items = enriched.filter((x): x is NonNullable<typeof x> => x !== null)
  if (items.length === 0) return emptyStats(watchlistCount)

  // Temps cumulé
  const totalRuntimeMinutes = items.reduce((s, it) => s + (it.runtime || 0), 0)

  // Genres
  const genreCount = new Map<string, number>()
  for (const it of items) for (const g of it.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1)
  const genres = [...genreCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  // Décennies
  const decadeCount = new Map<number, number>()
  for (const it of items) if (it.year) { const dec = Math.floor(it.year / 10) * 10; decadeCount.set(dec, (decadeCount.get(dec) ?? 0) + 1) }
  const decades = [...decadeCount.entries()].sort((a, b) => a[0] - b[0]).map(([d, count]) => ({ decade: `${d}s`, count }))

  // Réalisateurs & acteurs
  const tally = (people: { id: number; name: string; profile_path: string | null }[][]) => {
    const map = new Map<number, PersonStat>()
    for (const arr of people) for (const p of arr) {
      const cur = map.get(p.id)
      if (cur) cur.count++
      else map.set(p.id, { id: p.id, name: p.name, count: 1, profile_path: p.profile_path })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }
  const topDirectors = tally(items.map(it => it.directors)).filter(p => p.count >= 1).slice(0, 6)
  const topActors = tally(items.map(it => it.cast)).filter(p => p.count >= 1).slice(0, 6)

  // Dates de visionnage (tous les « déjà vu ») — agrégées côté client par an/mois/semaine/jour
  const activityDates = watched.map(r => (r.created_at ?? '').slice(0, 10)).filter(Boolean)

  // Notes : sévère ou généreux ? (sur les films notés par l'utilisateur)
  const rated = items.filter(it => it.row.rating != null)
  const ratings = rated.length > 0
    ? {
        userAvg: rated.reduce((s, it) => s + (it.row.rating as number), 0) / rated.length,
        publicAvg: rated.reduce((s, it) => s + (it.voteAverage ?? 0), 0) / rated.length,
        ratedCount: rated.length,
      }
    : { userAvg: null, publicAvg: null, ratedCount: 0 }

  // Superlatifs
  const toSup = (it: typeof items[number], value: string): Superlative => ({ title: it.title, value, tmdb_id: it.row.tmdb_id, media_type: it.row.media_type, poster_path: it.poster_path })
  const longestItem = items.filter(it => it.runtime > 0).sort((a, b) => b.runtime - a.runtime)[0]
  const bestItem = items.filter(it => it.voteAverage != null).sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0))[0]
  const oldestItem = items.filter(it => it.year).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))[0]
  const fmtRuntime = (m: number) => { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h${String(mm).padStart(2, '0')}` : `${mm}min` }
  const superlatives = {
    longest: longestItem ? toSup(longestItem, fmtRuntime(longestItem.runtime)) : null,
    bestRated: bestItem ? toSup(bestItem, `${(bestItem.voteAverage ?? 0).toFixed(1)}/10`) : null,
    oldest: oldestItem ? toSup(oldestItem, oldestItem.year ? String(oldestItem.year) : '—') : null,
  }

  // Compatibilité avec un autre profil du même utilisateur (similarité de genres)
  let compatibility: Compatibility | null = null
  const { data: others } = await admin
    .from('profiles')
    .select('id, name')
    .eq('user_id', ctx.userId)
    .neq('id', target)
    .limit(1)
  if (others && others.length > 0) {
    const other = others[0] as { id: string; name: string }
    const otherVec = await genreVector(admin, other.id)
    if (otherVec.size > 0 && genreCount.size > 0) {
      const allG = new Set([...genreCount.keys(), ...otherVec.keys()])
      let dot = 0, na = 0, nb = 0
      for (const g of allG) { const a = genreCount.get(g) ?? 0, b = otherVec.get(g) ?? 0; dot += a * b; na += a * a; nb += b * b }
      const score = na && nb ? Math.round((dot / (Math.sqrt(na) * Math.sqrt(nb))) * 100) : 0
      const sharedGenres = [...allG]
        .filter(g => (genreCount.get(g) ?? 0) > 0 && (otherVec.get(g) ?? 0) > 0)
        .sort((x, y) => ((genreCount.get(y) ?? 0) + (otherVec.get(y) ?? 0)) - ((genreCount.get(x) ?? 0) + (otherVec.get(x) ?? 0)))
        .slice(0, 2)
      compatibility = { score, otherName: other.name, otherInitials: initialsOf(other.name), sharedGenres }
    }
  }

  // Badges
  const genresExploredCount = genreCount.size
  const hours = totalRuntimeMinutes / 60
  const distinctDecades = decadeCount.size
  const mk = (id: string, label: string, description: string, progress: number, target: number): Badge => ({ id, label, description, progress: Math.min(progress, target), target, unlocked: progress >= target })
  const badges: Badge[] = [
    mk('first', 'Premier pas', 'Marquer un premier film comme vu', items.length, 1),
    mk('cinephile', 'Cinéphile', '50 titres vus', items.length, 50),
    mk('explorer', 'Explorateur', '10 genres différents', genresExploredCount, 10),
    mk('marathon', 'Marathonien', '100 heures cumulées', Math.floor(hours), 100),
    mk('timetraveler', 'Voyageur du temps', 'Des films de 5 décennies', distinctDecades, 5),
    mk('century', 'Centurion', '100 titres vus', items.length, 100),
  ]

  return {
    hasData: true,
    year: new Date().getFullYear(),
    watchedCount: items.length,
    watchlistCount,
    totalRuntimeMinutes,
    genresExploredCount,
    genres,
    decades,
    topDirectors,
    topActors,
    activityDates,
    ratings,
    superlatives,
    badges,
    compatibility,
  }
}
