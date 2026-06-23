import Image from 'next/image'
import Link from 'next/link'
import { backdropUrl, getTitle, getYear, type Media } from '@/lib/tmdb'

interface Props {
  media: Media
  mediaType: 'movie' | 'tv'
}

export function HeroBanner({ media, mediaType }: Props) {
  const backdrop = backdropUrl(media.backdrop_path)
  const title = getTitle(media)
  const year = getYear(media)
  const rating = media.vote_average.toFixed(1)

  return (
    <div className="relative w-full h-[280px] sm:h-[360px] md:h-[440px] overflow-hidden">
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

      <div className="absolute bottom-0 left-0 p-4 sm:p-6 md:p-8 max-w-lg">
        <span className="inline-block bg-[#f97316] text-white text-[9px] font-semibold px-2 py-0.5 rounded mb-2 tracking-wide">
          TENDANCES #1
        </span>
        <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-semibold mb-1 leading-tight">
          {title}
        </h1>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[#f97316] text-sm">★ {rating}</span>
          {year && <span className="text-[#666] text-xs">{year}</span>}
        </div>
        <p className="text-gray-400 text-xs sm:text-sm line-clamp-2 mb-4 hidden sm:block">
          {media.overview}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/media/${mediaType}-${media.id}`}
            className="flex items-center gap-1.5 bg-[#f97316] text-white text-xs px-4 py-2 rounded hover:bg-orange-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Trailer
          </Link>
          <Link
            href={`/media/${mediaType}-${media.id}`}
            className="flex items-center gap-1.5 bg-white/10 text-white text-xs px-4 py-2 rounded border border-[#555] hover:bg-white/20 transition-colors"
          >
            Voir les détails
          </Link>
        </div>
      </div>
    </div>
  )
}
