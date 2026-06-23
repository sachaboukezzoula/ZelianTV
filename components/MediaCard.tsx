import Image from 'next/image'
import Link from 'next/link'
import { posterUrl, getTitle, getYear, type Media } from '@/lib/tmdb'

interface Props {
  media: Media
  mediaType: 'movie' | 'tv'
}

export function MediaCard({ media, mediaType }: Props) {
  const poster = posterUrl(media.poster_path)
  const title = getTitle(media)
  const year = getYear(media)

  return (
    <Link
      href={`/media/${mediaType}-${media.id}`}
      className="flex-shrink-0 w-[120px] sm:w-[140px] md:w-[160px] group/card"
    >
      <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden bg-[#1c1c1c] border border-[#2a2a2a] group-hover/card:border-[#f97316] transition-colors">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 120px, (max-width: 768px) 140px, 160px"
            className="object-cover group-hover/card:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[#333]">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-300 mt-1.5 truncate">{title}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-[#f97316] text-xs">★ {media.vote_average.toFixed(1)}</span>
        {year && <span className="text-[#555] text-xs">{year}</span>}
      </div>
    </Link>
  )
}
