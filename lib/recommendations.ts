import { discoverByGenre, getMediaDetail, type Media, type MediaType } from '@/lib/tmdb'

interface GenreSource {
  genres: number[]
}

export function aggregateTopGenres(items: GenreSource[], topN = 3): number[] {
  const freq = new Map<number, number>()
  for (const item of items) {
    for (const g of item.genres) {
      freq.set(g, (freq.get(g) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id]) => id)
}

export function filterOutWatched<T extends { id: number }>(
  items: T[],
  watchedIds: Set<number>
): T[] {
  return items.filter(item => !watchedIds.has(item.id))
}

interface WatchedItem {
  tmdb_id: number
  media_type: string
}

export async function getRecommendations(
  watched: WatchedItem[],
  limit = 12
): Promise<Media[]> {
  if (watched.length === 0) return []

  const details = await Promise.allSettled(
    watched.map(w => getMediaDetail(w.tmdb_id, w.media_type as MediaType))
  )

  const genreSources: GenreSource[] = details
    .filter((r): r is PromiseFulfilledResult<Media> => r.status === 'fulfilled')
    .map(r => ({ genres: (r.value.genres ?? []).map(g => g.id) }))

  const topGenres = aggregateTopGenres(genreSources)
  if (topGenres.length === 0) return []

  const watchedSet = new Set(watched.map(w => w.tmdb_id))

  const [moviesResult, seriesResult] = await Promise.allSettled([
    discoverByGenre(topGenres.join(','), 'movie'),
    discoverByGenre(topGenres.join(','), 'tv'),
  ])

  const movies = moviesResult.status === 'fulfilled' ? moviesResult.value : []
  const series = seriesResult.status === 'fulfilled' ? seriesResult.value : []

  return filterOutWatched([...movies, ...series], watchedSet).slice(0, limit)
}
