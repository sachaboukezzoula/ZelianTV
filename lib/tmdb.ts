const BASE_URL = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

export type MediaType = 'movie' | 'tv'

export interface Media {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  vote_count?: number
  genre_ids?: number[]
  genres?: Genre[]
  overview: string
  tagline?: string
  status?: string
  release_date?: string
  first_air_date?: string
  runtime?: number
  episode_run_time?: number[]
  media_type?: MediaType
  popularity?: number
  character?: string
}

export interface Person {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  profile_path: string | null
  known_for_department: string | null
}

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
  type: 'Abonnement' | 'Location' | 'Achat'
}

export interface Genre {
  id: number
  name: string
}

export interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
}

export interface Video {
  id: string
  key: string
  site: string
  type: string
}

function buildUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY!)
  url.searchParams.set('language', 'fr-FR')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

async function fetchTMDB<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(buildUrl(path, params), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`)
  return res.json()
}

export function posterUrl(path: string | null, size = 'w500'): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null
}

export function backdropUrl(path: string | null, size = 'w1280'): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null
}

export function getTitle(m: Pick<Media, 'title' | 'name'>): string {
  return m.title ?? m.name ?? 'Titre inconnu'
}

export function getYear(m: Pick<Media, 'release_date' | 'first_air_date'>): string | null {
  const d = m.release_date ?? m.first_air_date
  return d ? d.slice(0, 4) : null
}

export async function getTrending(): Promise<Media[]> {
  const data = await fetchTMDB<{ results: Media[] }>('/trending/all/week')
  return data.results
}

function dedup(items: Media[]): Media[] {
  const seen = new Set<number>()
  return items.filter(m => seen.has(m.id) ? false : (seen.add(m.id), true))
}

export async function getTrendingMovies(): Promise<Media[]> {
  const [p1, p2] = await Promise.all([
    fetchTMDB<{ results: Media[] }>('/trending/movie/week', { page: '1' }),
    fetchTMDB<{ results: Media[] }>('/trending/movie/week', { page: '2' }),
  ])
  return dedup([...p1.results, ...p2.results]).map(m => ({ ...m, media_type: 'movie' as MediaType }))
}

export async function getTrendingTv(): Promise<Media[]> {
  const [p1, p2] = await Promise.all([
    fetchTMDB<{ results: Media[] }>('/trending/tv/week', { page: '1' }),
    fetchTMDB<{ results: Media[] }>('/trending/tv/week', { page: '2' }),
  ])
  return dedup([...p1.results, ...p2.results]).map(m => ({ ...m, media_type: 'tv' as MediaType }))
}

export async function getPopularMovies(): Promise<Media[]> {
  const [p1, p2] = await Promise.all([
    fetchTMDB<{ results: Media[] }>('/movie/popular', { page: '1' }),
    fetchTMDB<{ results: Media[] }>('/movie/popular', { page: '2' }),
  ])
  return dedup([...p1.results, ...p2.results])
}

export async function getPopularTv(): Promise<Media[]> {
  const [p1, p2] = await Promise.all([
    fetchTMDB<{ results: Media[] }>('/tv/popular', { page: '1' }),
    fetchTMDB<{ results: Media[] }>('/tv/popular', { page: '2' }),
  ])
  return dedup([...p1.results, ...p2.results])
}

export async function getMovieGenres(): Promise<Genre[]> {
  const data = await fetchTMDB<{ genres: Genre[] }>('/genre/movie/list')
  return data.genres
}

export async function getTvGenres(): Promise<Genre[]> {
  const data = await fetchTMDB<{ genres: Genre[] }>('/genre/tv/list')
  return data.genres
}

export async function getMediaDetail(id: number, type: MediaType): Promise<Media> {
  return fetchTMDB<Media>(`/${type}/${id}`)
}

export async function getVideos(id: number, type: MediaType): Promise<Video[]> {
  const data = await fetchTMDB<{ results: Video[] }>(`/${type}/${id}/videos`)
  return data.results.filter(v => v.site === 'YouTube' && v.type === 'Trailer')
}

export async function filterWithContent(items: Media[], type: MediaType): Promise<Media[]> {
  const withOverview = items.filter(m => m.overview?.trim())
  const results = await Promise.all(
    withOverview.map(async m => {
      const videos = await getVideos(m.id, type)
      return videos.length > 0 ? m : null
    })
  )
  return results.filter((m): m is Media => m !== null)
}

export async function getCredits(id: number, type: MediaType): Promise<CastMember[]> {
  const data = await fetchTMDB<{ cast: CastMember[] }>(`/${type}/${id}/credits`)
  return data.cast.slice(0, 24)
}

export interface PersonLite {
  id: number
  name: string
  profile_path: string | null
}

interface CrewMemberRaw {
  id: number
  name: string
  job: string
  profile_path: string | null
}

/** Réalisateur(s) + têtes d'affiche d'un titre, en un seul appel credits (pour les statistiques). */
export async function getTitleCredits(
  id: number,
  type: MediaType,
): Promise<{ directors: PersonLite[]; cast: PersonLite[] }> {
  const data = await fetchTMDB<{ cast: CastMember[]; crew: CrewMemberRaw[] }>(`/${type}/${id}/credits`)
  const directors = (data.crew ?? [])
    .filter(c => c.job === 'Director')
    .map(c => ({ id: c.id, name: c.name, profile_path: c.profile_path }))
  const cast = (data.cast ?? []).slice(0, 8).map(c => ({ id: c.id, name: c.name, profile_path: c.profile_path }))
  return { directors, cast }
}

export async function searchMulti(query: string): Promise<Media[]> {
  const data = await fetchTMDB<{ results: Media[] }>('/search/multi', { query })
  return data.results.filter(m => m.media_type === 'movie' || m.media_type === 'tv')
}

export function providerLogoUrl(path: string | null, size = 'w92'): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null
}

interface RawProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
}

// Sites officiels des principales plateformes (pour rediriger l'utilisateur).
const PROVIDER_SITES: { match: RegExp; url: string }[] = [
  { match: /netflix/i, url: 'https://www.netflix.com' },
  { match: /disney/i, url: 'https://www.disneyplus.com' },
  { match: /amazon|prime video/i, url: 'https://www.primevideo.com' },
  { match: /canal/i, url: 'https://www.canalplus.com' },
  { match: /apple/i, url: 'https://tv.apple.com' },
  { match: /paramount/i, url: 'https://www.paramountplus.com' },
  { match: /\bmax\b|hbo/i, url: 'https://www.max.com' },
  { match: /ocs/i, url: 'https://www.ocs.fr' },
  { match: /crunchyroll/i, url: 'https://www.crunchyroll.com' },
  { match: /\badn\b|animation digital/i, url: 'https://animationdigitalnetwork.com' },
  { match: /youtube/i, url: 'https://www.youtube.com' },
  { match: /google play/i, url: 'https://play.google.com/store/movies' },
  { match: /microsoft/i, url: 'https://www.microsoft.com/films-et-tv' },
  { match: /rakuten/i, url: 'https://www.rakuten.tv' },
  { match: /universcine/i, url: 'https://www.universcine.com' },
  { match: /arte/i, url: 'https://www.arte.tv' },
]

export function providerOfficialUrl(name: string): string | null {
  return PROVIDER_SITES.find(p => p.match.test(name))?.url ?? null
}

export async function getWatchProviders(
  id: number,
  type: MediaType,
  region = 'FR',
): Promise<{ providers: WatchProvider[]; link: string | null }> {
  try {
    const data = await fetchTMDB<{
      results?: Record<string, { link?: string; flatrate?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[] }>
    }>(`/${type}/${id}/watch/providers`)
    const r = data.results?.[region]
    if (!r) return { providers: [], link: null }
    const seen = new Set<number>()
    const out: WatchProvider[] = []
    const add = (arr: RawProvider[] | undefined, label: WatchProvider['type']) => {
      for (const p of arr ?? []) {
        if (seen.has(p.provider_id)) continue
        seen.add(p.provider_id)
        out.push({ provider_id: p.provider_id, provider_name: p.provider_name, logo_path: p.logo_path, type: label })
      }
    }
    add(r.flatrate, 'Abonnement')
    add(r.rent, 'Location')
    add(r.buy, 'Achat')
    return { providers: out, link: r.link ?? null }
  } catch {
    return { providers: [], link: null }
  }
}

export async function getSimilarTitles(id: number, type: MediaType): Promise<Media[]> {
  try {
    const data = await fetchTMDB<{ results: Media[] }>(`/${type}/${id}/recommendations`)
    let results = data.results ?? []
    if (results.length === 0) {
      const sim = await fetchTMDB<{ results: Media[] }>(`/${type}/${id}/similar`)
      results = sim.results ?? []
    }
    return results.filter(m => m.poster_path).slice(0, 8).map(m => ({ ...m, media_type: type }))
  } catch {
    return []
  }
}

export async function getPerson(id: number): Promise<Person | null> {
  try {
    const p = await fetchTMDB<Person>(`/person/${id}`)
    if (!p.biography || !p.biography.trim()) {
      try {
        const en = await fetchTMDB<Person>(`/person/${id}`, { language: 'en-US' })
        if (en.biography?.trim()) p.biography = en.biography
      } catch { /* pas de bio EN non plus */ }
    }
    return p
  } catch {
    return null
  }
}

export async function getPersonCredits(id: number): Promise<Media[]> {
  try {
    const data = await fetchTMDB<{ cast: Media[] }>(`/person/${id}/combined_credits`)
    const seen = new Set<number>()
    return (data.cast ?? [])
      .filter(m => m.poster_path && (m.media_type === 'movie' || m.media_type === 'tv'))
      .filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 18)
  } catch {
    return []
  }
}

export async function getCertification(id: number, type: MediaType, region = 'FR'): Promise<string | null> {
  try {
    if (type === 'movie') {
      const data = await fetchTMDB<{ results: { iso_3166_1: string; release_dates: { certification: string }[] }[] }>(`/movie/${id}/release_dates`)
      const fr = data.results?.find(r => r.iso_3166_1 === region)
      const cert = fr?.release_dates?.map(d => d.certification).find(c => c && c.trim())
      return cert ? cert.trim() : null
    }
    const data = await fetchTMDB<{ results: { iso_3166_1: string; rating: string }[] }>(`/tv/${id}/content_ratings`)
    const fr = data.results?.find(r => r.iso_3166_1 === region)
    return fr?.rating?.trim() || null
  } catch {
    return null
  }
}

export async function discoverByGenre(genreId: string, type: MediaType): Promise<Media[]> {
  const pages = await Promise.all(
    [1, 2, 3, 4].map(page =>
      fetchTMDB<{ results: Media[] }>(`/discover/${type}`, {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page: String(page),
      })
    )
  )
  return dedup(pages.flatMap(p => p.results))
}
