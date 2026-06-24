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
      className="media-card-link flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px]"
    >
      <div className="media-card-inner">
        {/* Image + overlay hover */}
        <div className="relative w-full aspect-[2/3] overflow-hidden">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, 180px"
              className="media-card-img object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[#333]">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
            </div>
          )}
          <div className="media-card-overlay">
            <div style={{width:44,height:44,borderRadius:'50%',backgroundColor:'#f97316',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </div>

        {/* Infos */}
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium text-gray-200 truncate">{title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[#f97316] text-xs font-semibold">★ {media.vote_average.toFixed(1)}</span>
            {year && <span className="text-[#555] text-xs">{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}
