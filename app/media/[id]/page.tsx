import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PosterPlayer } from '@/components/PosterPlayer'
import { TrailerPlayer } from '@/components/TrailerPlayer'
import { WatchlistButton } from '@/components/WatchlistButton'
import { ShareLikeButtons } from '@/components/ShareLikeButtons'
import { ZelectronRating } from '@/components/Zelectron'
import { BackButton } from '@/components/BackButton'
import { CastSection } from '@/components/CastSection'
import { FicheMobile } from '@/components/FicheMobile'
import {
  getMediaDetail,
  getVideos,
  getCredits,
  getWatchProviders,
  getSimilarTitles,
  getCertification,
  backdropUrl,
  posterUrl,
  providerLogoUrl,
  providerOfficialUrl,
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

function statusInfo(status: string | undefined): { label: string; done: boolean } | null {
  if (!status) return null
  const map: Record<string, { label: string; done: boolean }> = {
    Released: { label: 'Sorti', done: true },
    Ended: { label: 'Terminé', done: true },
    'Returning Series': { label: 'En cours', done: true },
    'In Production': { label: 'En production', done: false },
    'Post Production': { label: 'En post-production', done: false },
    Planned: { label: 'Prévu', done: false },
    Canceled: { label: 'Annulé', done: false },
    Rumored: { label: 'Rumeur', done: false },
  }
  return map[status] ?? { label: status, done: true }
}

function certInfo(cert: string | null): { label: string; ok: boolean } | null {
  if (!cert) return null
  const c = cert.trim()
  if (!c || c === 'U' || c === 'TP' || /tous public/i.test(c) || c === '0') {
    return { label: 'Tous publics', ok: true }
  }
  const num = c.replace(/[^0-9]/g, '')
  if (num) return { label: `Déconseillé aux -${num} ans`, ok: false }
  return { label: c, ok: false }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) return {}
  const media = await getMediaDetail(parsed.tmdbId, parsed.type).catch(() => null)
  if (!media) return {}
  return { title: `${getTitle(media)} — ZelianTV`, description: media.overview }
}

export default async function MediaDetailPage({ params }: PageProps) {
  const { id } = await params
  const parsed = parseId(id)
  if (!parsed) notFound()

  const { type, tmdbId } = parsed

  const [media, videos, cast, watch, similar, certification] = await Promise.all([
    getMediaDetail(tmdbId, type).catch(() => null),
    getVideos(tmdbId, type).catch(() => []),
    getCredits(tmdbId, type).catch(() => []),
    getWatchProviders(tmdbId, type).catch(() => ({ providers: [], link: null })),
    getSimilarTitles(tmdbId, type).catch(() => []),
    getCertification(tmdbId, type).catch(() => null),
  ])

  if (!media) notFound()

  const title = getTitle(media)
  const year = getYear(media)
  const backdrop = backdropUrl(media.backdrop_path)
  const poster = posterUrl(media.poster_path)
  const trailer = videos[0]
  const status = statusInfo(media.status)
  const cert = certInfo(certification)

  const runtime = type === 'movie'
    ? media.runtime ? `${Math.floor(media.runtime / 60)}h ${media.runtime % 60}min` : null
    : media.episode_run_time?.[0] ? `~${media.episode_run_time[0]}min / ép.` : null

  const metaParts = [year, runtime, type === 'movie' ? 'Film' : 'Série'].filter(Boolean) as string[]
  const voteAvg = media.vote_average ? media.vote_average.toFixed(1) : null
  const voteCount = media.vote_count ?? 0

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="gal-display" style={{ fontSize: 27, letterSpacing: '.05em', marginBottom: 16 }}>{children}</div>
  )

  return (
    <div className="gal-body" style={{ minHeight: '100vh', background: '#0a0a0c', color: '#f3f1ee', position: 'relative' }}>

      {/* ═══════════ DESKTOP (PC — inchangé) ═══════════ */}
      <div className="hidden md:block">

      {/* ═══ HÉRO ═══ */}
      <div style={{ position: 'relative' }}>
        {/* Couche backdrop clippée — étendue de 56px vers le haut pour passer derrière le header transparent */}
        <div aria-hidden style={{ position: 'absolute', top: -56, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          {backdrop ? (
            <Image src={backdrop} alt={title} fill priority sizes="100vw" className="object-cover" style={{ animation: 'gal-kenburns 28s ease-in-out infinite alternate' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,#10131c,#1a2030)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 30%,rgba(255,255,255,.06),transparent 48%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,#0a0a0c 2%,rgba(10,10,12,.6) 42%,rgba(10,10,12,.4) 100%)' }} />
          <div style={{ position: 'absolute', top: -120, right: '8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow-md), transparent 65%)', pointerEvents: 'none', animation: 'gal-glow-breathe 9s ease-in-out infinite' }} />
        </div>

        <div style={{ position: 'relative', maxWidth: 1120, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px)' }}>
          <BackButton />

          <div className="fiche-hero" style={{ display: 'flex', gap: 'clamp(20px, 4vw, 42px)', alignItems: 'flex-end', marginTop: 22 }}>
            {/* POSTER */}
            <div style={{ width: 'clamp(140px, 22vw, 248px)', flexShrink: 0 }}>
              {poster ? (
                <PosterPlayer posterSrc={poster} alt={title} videoKey={trailer?.key} title={title} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 14, background: 'linear-gradient(160deg,#10131c,#1a2030)', border: '1px solid rgba(255,255,255,.08)' }} />
              )}
            </div>

            {/* INFO */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
              <h1 className="gal-display" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: .92, letterSpacing: '.015em', textShadow: '0 4px 30px rgba(0,0,0,.5)', margin: 0 }}>{title}</h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 12, fontSize: 14, color: 'rgba(243,241,238,.72)', flexWrap: 'wrap' }}>
                {metaParts.map((p, i) => (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
                    {i > 0 && <span style={{ opacity: .4 }}>·</span>}{p}
                  </span>
                ))}
                {status && (
                  <>
                    <span style={{ opacity: .4 }}>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: status.done ? '#5fd08a' : 'rgba(243,241,238,.7)', fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.done ? '#5fd08a' : '#bbb', boxShadow: status.done ? '0 0 8px rgba(95,208,138,.7)' : 'none' }} />
                      {status.label}
                    </span>
                  </>
                )}
              </div>

              {/* Genres */}
              {media.genres && media.genres.length > 0 && (
                <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
                  {media.genres.map(g => (
                    <span key={g.id} style={{ height: 30, display: 'inline-flex', alignItems: 'center', padding: '0 14px', border: '1px solid var(--accent-glow)', borderRadius: 16, fontSize: 12.5, color: 'var(--accent-2)', fontWeight: 500 }}>{g.name}</span>
                  ))}
                </div>
              )}

              {/* Note réelle (TMDB) + note Zelectron de l'utilisateur */}
              {voteAvg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <svg width="26" height="26" viewBox="0 0 16 16" fill="#f5c518"><path d="M8 1.6l1.9 4 4.3.5-3.2 2.9.9 4.3L8 11.9 4.1 13.2l.9-4.3L1.8 6.1l4.3-.5z" /></svg>
                    <div>
                      <span className="gal-display" style={{ fontSize: 30, lineHeight: 1 }}>{voteAvg}</span>
                      <span style={{ fontSize: 13, color: 'rgba(243,241,238,.45)' }}>/10</span>
                      <div style={{ fontSize: 11, color: 'rgba(243,241,238,.45)', marginTop: -2 }}>
                        Note Zelian{voteCount > 0 ? ` · ${voteCount.toLocaleString('fr-FR')} votes` : ''}
                      </div>
                    </div>
                  </div>
                  <ZelectronRating tmdbId={tmdbId} mediaType={type} />
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
                <WatchlistButton tmdbId={tmdbId} mediaType={type} posterPath={media.poster_path} title={title} variant="hero" />
                <ShareLikeButtons title={title} tmdbId={tmdbId} mediaType={type} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENU ═══ */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '8px clamp(20px, 4vw, 40px) 70px' }}>

        {/* SYNOPSIS */}
        {media.overview && (
          <div style={{ maxWidth: 760, marginTop: 10 }}>
            <div style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(243,241,238,.82)' }}>{media.overview}</div>
          </div>
        )}

        {/* BANDE-ANNONCE */}
        <div style={{ marginTop: 44 }}>
          <SectionTitle>Bande-annonce</SectionTitle>
          <TrailerPlayer videoKey={trailer?.key} title={title} backdrop={backdrop} />
        </div>

        {/* OÙ REGARDER */}
        {watch.providers.length > 0 && (
          <div style={{ marginTop: 44 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <span className="gal-display" style={{ fontSize: 27, letterSpacing: '.05em' }}>Où regarder</span>
              <span style={{ fontSize: 13, color: 'rgba(243,241,238,.45)' }}>· France</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {watch.providers.map(p => (
                <a
                  key={`${p.type}-${p.provider_id}`}
                  href={providerOfficialUrl(p.provider_name) ?? watch.link ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fiche-provider"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 13, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,.06)', position: 'relative' }}>
                    {p.logo_path && (
                      <Image src={providerLogoUrl(p.logo_path)!} alt={p.provider_name} fill sizes="42px" className="object-cover" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.provider_name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', marginTop: 2 }}>{p.type}</div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: .5 }}><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* CASTING */}
        {cast.length > 0 && (
          <div style={{ marginTop: 44 }}>
            <SectionTitle>Casting</SectionTitle>
            <CastSection cast={cast} />
          </div>
        )}

        {/* AVERTISSEMENTS */}
        {cert && (
          <div style={{ marginTop: 44 }}>
            <SectionTitle>Avertissements de contenu</SectionTitle>
            <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
              <span style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 18px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, background: cert.ok ? 'rgba(95,208,138,.12)' : 'rgba(240,138,29,.12)', border: `1px solid ${cert.ok ? 'rgba(95,208,138,.4)' : 'rgba(240,138,29,.4)'}`, color: cert.ok ? '#5fd08a' : 'var(--accent-2)' }}>{cert.label}</span>
            </div>
          </div>
        )}

        {/* TITRES SIMILAIRES */}
        {similar.length > 0 && (
          <div style={{ marginTop: 44 }}>
            <SectionTitle>Titres similaires</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
              {similar.map(s => (
                <Link
                  key={s.id}
                  href={`/media/${s.media_type ?? type}-${s.id}`}
                  title={getTitle(s)}
                  className="gal-poster"
                  style={{ position: 'relative', display: 'block', aspectRatio: '2/3', borderRadius: 11, overflow: 'hidden', boxShadow: '0 10px 24px rgba(0,0,0,.42)', background: 'linear-gradient(160deg,#10131c,#1a2030)' }}
                >
                  {s.poster_path && (
                    <Image src={`https://image.tmdb.org/t/p/w342${s.poster_path}`} alt={getTitle(s)} fill sizes="(min-width: 640px) 200px, 45vw" className="object-cover" />
                  )}
                  {/* Face : année seulement (le titre passe en overlay) */}
                  {getYear(s) && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '26px 12px 10px', background: 'linear-gradient(0deg,rgba(0,0,0,.85),transparent)', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(243,241,238,.62)', fontWeight: 500 }}>{getYear(s)}</span>
                    </div>
                  )}
                  {/* Overlay survol : note + titre + synopsis + CTA */}
                  <div className="gal-ov" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: 14, background: 'linear-gradient(0deg,rgba(8,8,10,.98),rgba(8,8,10,.72))' }}>
                    {s.vote_average ? (
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)' }}>★ {s.vote_average.toFixed(1)}</div>
                    ) : null}
                    <div className="gal-display line-clamp-2" style={{ fontSize: 19, lineHeight: 1, marginTop: 6 }}>{getTitle(s)}</div>
                    {s.overview ? (
                      <div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 8, color: 'rgba(243,241,238,.72)', flex: '1 1 auto', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>{s.overview}</div>
                    ) : (
                      <div style={{ flex: 1 }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#0a0a0c', marginTop: 10 }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>
                      Voir la fiche
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
      </div>

      {/* ═══════════ MOBILE ═══════════ */}
      <div className="md:hidden">
        <FicheMobile
          tmdbId={tmdbId}
          type={type}
          title={title}
          poster={poster}
          backdrop={backdrop}
          trailerKey={trailer?.key}
          overview={media.overview ?? null}
          genres={media.genres ?? []}
          metaParts={metaParts}
          status={status}
          cert={cert}
          voteAvg={voteAvg}
          voteCount={voteCount}
          posterPath={media.poster_path ?? null}
          cast={cast}
          providers={watch.providers}
          watchLink={watch.link}
          similar={similar}
        />
      </div>
    </div>
  )
}
