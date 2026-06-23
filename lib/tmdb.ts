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
  genre_ids?: number[]
  genres?: Genre[]
  overview: string
  release_date?: string
  first_air_date?: string
  runtime?: number
  episode_run_time?: number[]
  media_type?: MediaType
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
  return data.cast.slice(0, 10)
}

export async function searchMulti(query: string): Promise<Media[]> {
  const data = await fetchTMDB<{ results: Media[] }>('/search/multi', { query })
  return data.results.filter(m => m.media_type === 'movie' || m.media_type === 'tv')
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
