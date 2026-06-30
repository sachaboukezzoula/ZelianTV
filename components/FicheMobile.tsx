import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PosterPlayer } from '@/components/PosterPlayer'
import { TrailerPlayer } from '@/components/TrailerPlayer'
import { WatchlistButton } from '@/components/WatchlistButton'
import { ShareLikeButtons } from '@/components/ShareLikeButtons'
import { ZelectronRating } from '@/components/Zelectron'
import { BackButton } from '@/components/BackButton'
import { CastSection } from '@/components/CastSection'
import {
  providerLogoUrl,
  providerOfficialUrl,
  getTitle,
  getYear,
  type MediaType,
  type Media,
  type CastMember,
  type WatchProvider,
} from '@/lib/tmdb'

interface Props {
  tmdbId: number
  type: MediaType
  title: string
  poster: string | null
  backdrop: string | null
  trailerKey?: string
  overview: string | null
  genres: { id: number; name: string }[]
  metaParts: string[]
  status: { label: string; done: boolean } | null
  cert: { label: string; ok: boolean } | null
  voteAvg: string | null
  voteCount: number
  posterPath: string | null
  cast: CastMember[]
  providers: WatchProvider[]
  watchLink: string | null
  similar: Media[]
}

function MTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
      <span className="gal-display" style={{ fontSize: 25, letterSpacing: '.05em' }}>{children}</span>
      {sub && <span style={{ fontSize: 12, color: 'rgba(243,241,238,.45)' }}>{sub}</span>}
    </div>
  )
}

/** Fiche film — disposition mobile (verticale, centrée). Le PC reste géré par la page. */
export function FicheMobile({
  tmdbId, type, title, poster, backdrop, trailerKey, overview, genres, metaParts,
  status, cert, voteAvg, voteCount, posterPath, cast, providers, watchLink, similar,
}: Props) {
  return (
    <>
      {/* ═══ HÉRO ═══ */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Backdrop étendu de 56px vers le haut (derrière le header transparent) */}
        <div aria-hidden style={{ position: 'absolute', top: -56, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          {backdrop ? (
            <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover" style={{ animation: 'gal-kenburns 28s ease-in-out infinite alternate' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#10131c,#1a2030)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 60% 26%, var(--accent-glow-sm), transparent 52%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,#0a0a0c 3%,rgba(10,10,12,.55) 52%,rgba(10,10,12,.32) 100%)' }} />
          <div style={{ position: 'absolute', top: -70, right: -30, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow-md), transparent 65%)', pointerEvents: 'none', animation: 'gal-glow-breathe 9s ease-in-out infinite' }} />
        </div>

        <div style={{ position: 'relative', padding: '14px 18px 22px' }}>
          <BackButton />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 12 }}>
            {/* POSTER */}
            <div style={{ width: 168, flexShrink: 0 }}>
              {poster ? (
                <PosterPlayer posterSrc={poster} alt={title} videoKey={trailerKey} title={title} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 14, background: 'linear-gradient(160deg,#10131c,#1a2030)', border: '1px solid rgba(255,255,255,.08)' }} />
              )}
            </div>

            {/* TITRE */}
            <h1 className="gal-display" style={{ fontSize: 'clamp(36px, 11vw, 50px)', lineHeight: .94, letterSpacing: '.02em', textShadow: '0 4px 30px rgba(0,0,0,.5)', margin: '20px 0 0' }}>{title}</h1>

            {/* INFOS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 11, fontSize: 13, color: 'rgba(243,241,238,.72)' }}>
              {metaParts.map((p, i) => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{i > 0 && <span style={{ opacity: .4 }}>·</span>}{p}</span>
              ))}
              {status && (
                <>
                  <span style={{ opacity: .4 }}>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: status.done ? '#5fd08a' : 'rgba(243,241,238,.7)', fontWeight: 600 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.done ? '#5fd08a' : '#bbb', boxShadow: status.done ? '0 0 8px rgba(95,208,138,.7)' : 'none' }} />{status.label}
                  </span>
                </>
              )}
            </div>

            {/* GENRES */}
            {genres.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {genres.map(g => (
                  <span key={g.id} style={{ height: 30, display: 'inline-flex', alignItems: 'center', padding: '0 14px', border: '1px solid var(--accent-glow)', borderRadius: 16, fontSize: 12.5, color: 'var(--accent-2)', fontWeight: 500 }}>{g.name}</span>
                ))}
              </div>
            )}

            {/* NOTE ZELIAN + JAUGE ZELECTRONS */}
            {voteAvg && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20, flexWrap: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="#f5c518" style={{ flexShrink: 0 }}><path d="M8 1.6l1.9 4 4.3.5-3.2 2.9.9 4.3L8 11.9 4.1 13.2l.9-4.3L1.8 6.1l4.3-.5z" /></svg>
                  <div style={{ textAlign: 'left' }}>
                    <div><span className="gal-display" style={{ fontSize: 25, lineHeight: 1 }}>{voteAvg}</span><span style={{ fontSize: 11, color: 'rgba(243,241,238,.45)' }}>/10</span></div>
                    <div style={{ fontSize: 10, color: 'rgba(243,241,238,.45)', marginTop: -2 }}>Note Zelian{voteCount > 0 ? ` · ${voteCount.toLocaleString('fr-FR')} votes` : ''}</div>
                  </div>
                </div>
                <ZelectronRating tmdbId={tmdbId} mediaType={type} compact />
              </div>
            )}

            {/* ACTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 22, width: '100%' }}>
              <WatchlistButton tmdbId={tmdbId} mediaType={type} posterPath={posterPath} title={title} variant="hero-mobile" />
              <ShareLikeButtons title={title} tmdbId={tmdbId} mediaType={type} variant="mobile" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENU ═══ */}
      <div style={{ padding: '4px 18px 56px' }}>

        {/* SYNOPSIS */}
        {overview && (
          <div style={{ marginTop: 26 }}>
            <MTitle>Synopsis</MTitle>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(243,241,238,.9)' }}>{overview}</div>
          </div>
        )}

        {/* BANDE-ANNONCE */}
        <div style={{ marginTop: 30 }}>
          <MTitle>Bande-annonce</MTitle>
          <TrailerPlayer videoKey={trailerKey} title={title} backdrop={backdrop} />
        </div>

        {/* OÙ REGARDER */}
        {providers.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <MTitle sub="· France">Où regarder</MTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {providers.map(p => (
                <a
                  key={`${p.type}-${p.provider_id}`}
                  href={providerOfficialUrl(p.provider_name) ?? watchLink ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fiche-provider"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,.06)', position: 'relative' }}>
                    {p.logo_path && <Image src={providerLogoUrl(p.logo_path)!} alt={p.provider_name} fill sizes="42px" className="object-cover" />}
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
          <div style={{ marginTop: 30 }}>
            <MTitle>Casting</MTitle>
            <CastSection cast={cast} />
          </div>
        )}

        {/* AVERTISSEMENTS */}
        {cert && (
          <div style={{ marginTop: 30 }}>
            <MTitle>Avertissements de contenu</MTitle>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: cert.ok ? 'rgba(95,208,138,.12)' : 'rgba(240,138,29,.12)', border: `1px solid ${cert.ok ? 'rgba(95,208,138,.4)' : 'rgba(240,138,29,.4)'}`, color: cert.ok ? '#5fd08a' : 'var(--accent-2)' }}>{cert.label}</span>
            </div>
          </div>
        )}

        {/* TITRES SIMILAIRES */}
        {similar.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <MTitle>Titres similaires</MTitle>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 13, overflowX: 'auto', margin: '0 -18px', padding: '0 18px 4px' }}>
              {similar.map(s => (
                <Link
                  key={s.id}
                  href={`/media/${s.media_type ?? type}-${s.id}`}
                  title={getTitle(s)}
                  style={{ position: 'relative', width: 142, height: 213, flexShrink: 0, borderRadius: 11, overflow: 'hidden', boxShadow: '0 10px 24px rgba(0,0,0,.42)', background: 'linear-gradient(160deg,#10131c,#1a2030)', display: 'block' }}
                >
                  {s.poster_path && <Image src={`https://image.tmdb.org/t/p/w342${s.poster_path}`} alt={getTitle(s)} fill sizes="142px" className="object-cover" />}
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '30px 12px 12px', background: 'linear-gradient(0deg,rgba(0,0,0,.92),transparent)' }}>
                    <div className="gal-display line-clamp-2" style={{ fontSize: 17, letterSpacing: '.03em', lineHeight: 1.05 }}>{getTitle(s)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(243,241,238,.5)', marginTop: 4 }}>{[getYear(s), s.vote_average ? `★ ${s.vote_average.toFixed(1)}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
