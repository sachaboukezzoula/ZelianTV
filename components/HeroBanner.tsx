import Image from 'next/image'
import Link from 'next/link'
import { backdropUrl, getTitle, getYear, type Media } from '@/lib/tmdb'
import { HeroTrailerButton } from '@/components/HeroTrailerButton'

interface Props {
  media: Media
  mediaType: 'movie' | 'tv'
  trailerKey?: string
}

export function HeroBanner({ media, mediaType, trailerKey }: Props) {
  const backdrop = backdropUrl(media.backdrop_path)
  const title = getTitle(media)
  const year = getYear(media)
  const rating = media.vote_average.toFixed(1)

  return (
    <div className="relative w-full h-[280px] sm:h-[400px] md:h-[520px] lg:h-[600px] overflow-hidden -mt-14">
      {backdrop ? (
        <Image
          src={backdrop}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[#1c1c1c]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 p-4 sm:p-8 md:p-12 lg:p-16 max-w-lg md:max-w-xl lg:max-w-2xl">
        <span className="inline-block bg-accent text-white text-[9px] md:text-[11px] font-semibold px-2 py-0.5 rounded mb-2 tracking-wide">
          TENDANCES #1
        </span>
        <h1 className="text-white text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-2 leading-tight">
          {title}
        </h1>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-accent text-sm md:text-base">★ {rating}</span>
          {year && <span className="text-[#666] text-xs md:text-sm">{year}</span>}
        </div>
        <p className="text-gray-400 text-xs sm:text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-4 md:mb-6 hidden sm:block">
          {media.overview}
        </p>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {trailerKey ? (
            <HeroTrailerButton videoKey={trailerKey} title={title} />
          ) : (
            <Link href={`/media/${mediaType}-${media.id}`} className="hero-btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Trailer
            </Link>
          )}
          <Link href={`/media/${mediaType}-${media.id}`} className="hero-btn-secondary">
            Voir les détails
          </Link>
        </div>
      </div>
    </div>
  )
}
