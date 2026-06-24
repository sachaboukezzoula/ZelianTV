import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { YoutubePlayer } from '@/components/YoutubePlayer'
import { PosterPlayer } from '@/components/PosterPlayer'
import { WatchlistButton } from '@/components/WatchlistButton'
import {
  getMediaDetail,
  getVideos,
  getCredits,
  backdropUrl,
  posterUrl,
  getTitle,
  getYear,
  type MediaType,
} from '@/lib/tmdb'

interface PageProps {
  params: Promise<{ id: string }>
}

function parseId(id: string): { type: MediaType; tmdbId: number } | null {
  const match = id.match(/^(movie|tv)-(\d+)$/)
  if (!match) return null
  return { type: match[1] as MediaType, tmdbId: Number(match[2]) }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) return {}
  const media = await getMediaDetail(parsed.tmdbId, parsed.type).catch(() => null)
  if (!media) return {}
  return {
    title: `${getTitle(media)} — ZelianTV`,
    description: media.overview,
  }
}

export default async function MediaDetailPage({ params }: PageProps) {
  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) notFound()

  const { type, tmdbId } = parsed

  const [media, videos, cast] = await Promise.all([
    getMediaDetail(tmdbId, type).catch(() => null),
    getVideos(tmdbId, type).catch(() => []),
    getCredits(tmdbId, type).catch(() => []),
  ])

  if (!media) notFound()

  const title = getTitle(media)
  const year = getYear(media)
  const backdrop = backdropUrl(media.backdrop_path)
  const poster = posterUrl(media.poster_path)
  const trailer = videos[0]

  const runtime = type === 'movie'
    ? media.runtime
      ? `${Math.floor(media.runtime / 60)}h ${media.runtime % 60}min`
      : null
    : media.episode_run_time?.[0]
      ? `~${media.episode_run_time[0]}min / ép.`
      : null

  const metaLine = [year, runtime, type === 'movie' ? 'Film' : 'Série'].filter(Boolean).join(' · ')

  return (
    <div>
      {/* Backdrop */}
      <div className="relative w-full h-[180px] sm:h-[260px] md:h-[360px] lg:h-[480px] overflow-hidden">
        {backdrop ? (
          <Image src={backdrop} alt={title} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[#1c1c1c]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/60 to-transparent" />
        <div className="absolute bottom-4 left-4 sm:left-8 lg:hidden">
          <h1 className="text-white text-xl sm:text-2xl font-semibold">{title}</h1>
          {year && <p className="text-[#888] text-sm">{year}</p>}
        </div>
      </div>

      {/* ── MOBILE LAYOUT (hidden lg+) ── */}
      <div className="lg:hidden">
        <div className="px-4 sm:px-6 py-4 flex gap-4">
          {poster && (
            <div className="relative shrink-0 w-20 sm:w-28 aspect-[2/3] rounded-md overflow-hidden border border-[#2a2a2a]">
              <Image src={poster} alt={title} fill sizes="112px" className="object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-lg font-medium mb-0.5">{title}</h2>
            <p className="text-[#555] text-xs mb-2">{metaLine}</p>
            {media.genres && media.genres.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {media.genres.map(g => (
                  <span key={g.id} className="text-[#f97316] text-[9px] px-2 py-0.5 rounded bg-[#f97316]/10 border border-[#f97316]/20">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-5 mb-3">
              <div>
                <p className="text-[#444] text-[9px] uppercase tracking-wide mb-0.5">Note</p>
                <p className="text-[#f97316] text-sm">★ {media.vote_average.toFixed(1)}</p>
              </div>
            </div>
            <WatchlistButton tmdbId={tmdbId} mediaType={type} posterPath={media.poster_path} title={title} />
          </div>
        </div>

        {media.overview && (
          <div className="px-4 sm:px-6 pb-4 border-t border-[#1e1e1e] pt-4">
            <h3 className="text-gray-200 text-xs font-medium mb-2">Synopsis</h3>
            <p className="text-[#777] text-sm leading-relaxed">{media.overview}</p>
          </div>
        )}

        {trailer && (
          <div className="px-4 sm:px-6 pb-4">
            <YoutubePlayer videoKey={trailer.key} title={title} />
          </div>
        )}

        {cast.length > 0 && (
          <div className="px-4 sm:px-6 pb-6">
            <h3 className="text-gray-200 text-xs font-medium mb-3">Distribution</h3>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {cast.map(member => (
                <div key={member.id} className="shrink-0 text-center w-14">
                  <div className="w-10 h-10 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-1 text-[#666] text-xs font-medium overflow-hidden">
                    {member.profile_path ? (
                      <Image src={`https://image.tmdb.org/t/p/w92${member.profile_path}`} alt={member.name} width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      member.name.split(' ').map(n => n[0]).slice(0, 2).join('')
                    )}
                  </div>
                  <p className="text-[#666] text-[9px] leading-tight line-clamp-2">{member.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (hidden on mobile) ── */}
      <div className="hidden lg:grid lg:grid-cols-[300px_1fr] lg:gap-10 lg:px-12 lg:py-10 max-w-7xl mx-auto">
        {/* Colonne gauche : poster cliquable */}
        <div className="flex flex-col gap-4">
          {poster ? (
            <PosterPlayer posterSrc={poster} alt={title} videoKey={trailer?.key} title={title} />
          ) : (
            <div className="w-full aspect-[2/3] rounded-xl bg-[#1c1c1c] border border-[#2a2a2a]" />
          )}
          {!trailer && (
            <p className="text-[#444] text-xs text-center">Aucun trailer disponible</p>
          )}
        </div>

        {/* Colonne droite : toutes les infos */}
        <div className="flex flex-col gap-6 py-2">
          {/* Titre + Watchlist sur la même ligne */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-1">
              <h1 className="text-white text-4xl font-bold leading-tight">{title}</h1>
              <div className="shrink-0 pt-2">
                <WatchlistButton tmdbId={tmdbId} mediaType={type} posterPath={media.poster_path} title={title} />
              </div>
            </div>
            <p className="text-[#666] text-sm">{metaLine}</p>
          </div>

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {media.genres.map(g => (
                <span key={g.id} className="text-[#f97316] text-xs px-3 py-1 rounded-full bg-[#f97316]/10 border border-[#f97316]/30">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="flex gap-8">
            <div>
              <p className="text-[#444] text-[10px] uppercase tracking-widest mb-1">Note critique</p>
              <p className="text-[#f97316] text-2xl font-bold">★ {media.vote_average.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[#444] text-[10px] uppercase tracking-widest mb-1">Note public</p>
              <p className="text-gray-300 text-2xl font-bold">{media.vote_average.toFixed(1)}<span className="text-[#555] text-base font-normal"> / 10</span></p>
            </div>
          </div>

          {/* Synopsis */}
          {media.overview && (
            <div>
              <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-widest mb-3">Synopsis</h3>
              <p className="text-[#999] text-base leading-relaxed max-w-2xl">{media.overview}</p>
            </div>
          )}

          {/* Distribution */}
          {cast.length > 0 && (
            <div>
              <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-widest mb-4">Distribution</h3>
              <div className="flex gap-5 flex-wrap">
                {cast.slice(0, 10).map(member => (
                  <div key={member.id} className="text-center w-16">
                    <div className="w-12 h-12 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-1.5 text-[#666] text-xs font-medium overflow-hidden">
                      {member.profile_path ? (
                        <Image src={`https://image.tmdb.org/t/p/w92${member.profile_path}`} alt={member.name} width={48} height={48} className="object-cover w-full h-full" />
                      ) : (
                        member.name.split(' ').map(n => n[0]).slice(0, 2).join('')
                      )}
                    </div>
                    <p className="text-[#666] text-[10px] leading-tight line-clamp-2">{member.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
