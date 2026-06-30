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
  getVideos,
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

  const heroType = mediaType
  const hero = mediaType === 'tv' ? trendingTv[0] : trendingMovies[0]
  const genres = type === 'tv' ? tvGenres : movieGenres

  const rawTrending = type === 'tv' ? trendingTv : trendingMovies

  const [trending, filteredMovies, filteredSeries, heroVideos] = await Promise.all([
    filterWithContent(rawTrending, mediaType),
    filterWithContent(movies, 'movie'),
    filterWithContent(series, 'tv'),
    hero ? getVideos(hero.id, heroType).catch(() => []) : Promise.resolve([]),
  ])

  const heroTrailerKey = heroVideos[0]?.key

  return (
    <div>
      {hero && <HeroBanner media={hero} mediaType={heroType} trailerKey={heroTrailerKey} />}

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
