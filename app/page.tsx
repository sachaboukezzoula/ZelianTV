import { Suspense } from 'react'
import { HeroBanner } from '@/components/HeroBanner'
import { MediaRow } from '@/components/MediaRow'
import { FilterBar } from '@/components/FilterBar'
import {
  getTrending,
  getTrendingMovies,
  getTrendingTv,
  getPopularMovies,
  getPopularTv,
  getMovieGenres,
  getTvGenres,
  discoverByGenre,
  filterWithContent,
} from '@/lib/tmdb'

interface PageProps {
  searchParams: Promise<{ type?: string; genre?: string }>
}

export default async function Home({ searchParams }: PageProps) {
  const { type = 'movie', genre } = await searchParams

  const mediaType = type === 'tv' ? 'tv' : 'movie'

  const [trendingAll, trendingMovies, trendingTv, movies, series, movieGenres, tvGenres] = await Promise.all([
    getTrending(),
    getTrendingMovies(),
    getTrendingTv(),
    genre ? discoverByGenre(genre, 'movie') : getPopularMovies(),
    genre ? discoverByGenre(genre, 'tv') : getPopularTv(),
    getMovieGenres(),
    getTvGenres(),
  ])

  const hero = trendingAll[0]
  const heroType = (hero?.media_type as 'movie' | 'tv') ?? 'movie'
  const genres = type === 'tv' ? tvGenres : movieGenres

  const rawTrending = type === 'tv' ? trendingTv : trendingMovies

  const [trending, filteredMovies, filteredSeries] = await Promise.all([
    filterWithContent(rawTrending, mediaType),
    filterWithContent(movies, 'movie'),
    filterWithContent(series, 'tv'),
  ])

  return (
    <div>
      {hero && <HeroBanner media={hero} mediaType={heroType} />}

      <Suspense fallback={null}>
        <FilterBar genres={genres} />
      </Suspense>

      <div className="py-2">
        <MediaRow
          title="Tendances"
          items={trending}
          mediaType={mediaType}
        />
        {type !== 'tv' && (
          <MediaRow title="Films populaires" items={filteredMovies} mediaType="movie" />
        )}
        {type !== 'movie' && (
          <MediaRow title="Séries populaires" items={filteredSeries} mediaType="tv" />
        )}
      </div>
    </div>
  )
}
