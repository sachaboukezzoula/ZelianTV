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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', borderRadius: 8, background: 'var(--accent)', color: '#0a0a0c', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 20px var(--accent-glow)' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3.5l8 4.5-8 4.5z" />
              </svg>
              Voir la fiche
            </span>
          </div>
        </div>

        {/* Infos */}
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium text-gray-200 truncate">{title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-accent text-xs font-semibold">★ {media.vote_average.toFixed(1)}</span>
            {year && <span className="text-[#555] text-xs">{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}
