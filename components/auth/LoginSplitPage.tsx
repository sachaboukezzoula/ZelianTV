'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearActiveProfile } from '@/app/actions/profiles'
import { backdropUrl, posterUrl, getTitle, getYear } from '@/lib/tmdb'
import type { Media, Genre } from '@/lib/tmdb'
import { useTheme } from '@/components/ThemeProvider'

interface Props {
  trending: Media[]
  movieGenres: Genre[]
  tvGenres: Genre[]
}

export function LoginSplitPage({ trending, movieGenres, tvGenres }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [slide, setSlide] = useState(0)
  const [fading, setFading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { theme } = useTheme()
  const logoFilter =
    theme === 'blue'   ? 'invert(1) hue-rotate(12deg)' :
    theme === 'violet' ? 'invert(1) hue-rotate(53deg)' :
                         'invert(1) hue-rotate(180deg)'

  const genreMap = new Map<number, string>()
  movieGenres.forEach(g => genreMap.set(g.id, g.name))
  tvGenres.forEach(g => genreMap.set(g.id, g.name))

  const advance = useCallback((to: number) => {
    setFading(true)
    setTimeout(() => { setSlide(to); setFading(false) }, 350)
  }, [])

  useEffect(() => {
    if (trending.length <= 1) return
    const t = setInterval(() => advance((slide + 1) % trending.length), 6000)
    return () => clearInterval(t)
  }, [trending.length, slide, advance])

  const current = trending[slide]
  const bg = current ? backdropUrl(current.backdrop_path, 'original') : null
  // Mobile : poster portrait (remplit bien l'écran vertical), repli sur le backdrop si absent
  const mobileImg = current ? (posterUrl(current.poster_path, 'w780') ?? bg) : null
  const title = current ? getTitle(current) : ''
  const year = current ? getYear(current) : ''
  const genres = (current?.genre_ids ?? []).slice(0, 2).map(id => genreMap.get(id)).filter(Boolean)
  const chipText = [...genres, year].filter(Boolean).join(' · ')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(error.message); setLoading(false) }
    else {
      // Effacer le profil actif pour forcer l'écran « Qui regarde ? » à chaque connexion (comme Netflix)
      await clearActiveProfile()
      router.refresh()
      router.push('/profils')
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setMessage(error.message) }
    else { setMessage('Email de confirmation envoyé ✓') }
    setLoading(false)
  }

  async function handleReset() {
    if (!email) { setMessage('Entrez votre email pour réinitialiser'); return }
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profil`,
    })
    setMessage('Email de réinitialisation envoyé ✓')
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.18em', textTransform: 'uppercase',
    color: 'rgba(243,241,238,.62)', textShadow: '0 1px 3px rgba(0,0,0,.55)', marginBottom: 7,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0d0d0d' }}>
      <style>{`
        .ztab { padding: 2px 0 10px; margin-right: 22px; font-size: 0.78rem; font-weight: 400; color: #444; background: none; cursor: pointer; outline: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-bottom-color 0.15s; }
        .ztab.ztab-active { font-weight: 600; color: #fff; border-bottom-color: var(--accent); }
        .ztabs-bar { display: flex; border-bottom: 1px solid #222; margin-bottom: 26px; }
        .zinput { width: 100%; background: var(--accent-glow-sm); border: 1px solid var(--accent-glow); border-radius: 6px; padding: 12px 14px; font-size: 0.875rem; color: #fff; outline: none; box-sizing: border-box; transition: border-color 0.15s ease, background 0.15s ease; }
        .zinput:focus { border-color: var(--accent); background: var(--accent-glow-md); }
        .zreset { font-size: 0.62rem; color: #444; background: none; border: none; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; transition: color 0.15s; }
        .zreset:hover { color: #888; }
        .zsubmit { width: 100%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%); color: #fff; border: none; border-radius: 6px; padding: 13px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; margin-top: 4px; transition: opacity 0.15s, transform 0.1s; }
        .zsubmit:hover:not(:disabled) { transform: translateY(-1px); }
        .zsubmit:disabled { opacity: 0.6; cursor: not-allowed; }
        .zdot { height: 6px; border-radius: 3px; border: none; cursor: pointer; padding: 0; background: rgba(255,255,255,0.25); transition: all 0.3s ease; }
        .zdot.zdot-active { background: var(--accent); }
        .zmtab { flex: 1; height: 42px; background: none; border: none; cursor: pointer; outline: none; font-size: 0.875rem; font-weight: 600; letter-spacing: .03em; color: #8a8a8a; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .2s, border-bottom-color .2s; }
        .zmtab.zmtab-active { color: var(--accent); border-bottom-color: var(--accent); }
        @keyframes zform-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* ═══════════════ DESKTOP (split) ═══════════════ */}
      <div className="hidden md:flex" style={{ position: 'absolute', inset: 0 }}>
        {/* ── MÉDIA PLEIN ÉCRAN (derrière les deux panneaux) ── */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          {bg && (
            <Image src={bg} alt="" fill sizes="100vw" priority
              style={{ objectFit: 'cover', opacity: fading ? 0 : 1, transition: 'opacity 0.35s ease' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,9,13,.8) 0%, rgba(8,9,13,.42) 52%, rgba(8,9,13,.18) 100%)' }} />
        </div>

        {/* ── LEFT PANEL (verre translucide sur le média) ── */}
        <div style={{
          width: 460, minWidth: 360, flexShrink: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '0 52px', background: 'rgba(13,13,16,.34)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', position: 'relative', zIndex: 2,
        }}>
          {/* Logo */}
          <div style={{ position: 'absolute', top: 28, left: 52 }}>
            <Link href="/">
              <Image src="/zelian-tv-logo.png" alt="ZelianTV" width={90} height={24}
                style={{ filter: logoFilter, height: 'auto', width: 'auto', transition: 'filter 0.3s ease' }} />
            </Link>
          </div>

          {/* Header */}
          <p style={{ color: 'var(--accent)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 8 }}>
            Bienvenue
          </p>
          <h1 style={{ color: '#fff', fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', lineHeight: 1, marginBottom: 28 }}>
            {tab === 'login' ? 'Connexion' : 'Inscription'}
          </h1>

          {/* Tabs */}
          <div className="ztabs-bar">
            {([['login', 'Connexion'], ['signup', 'Créer un compte']] as const).map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setMessage('') }}
                className={`ztab${tab === key ? ' ztab-active' : ''}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleSignup}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com" required className="zinput" />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Mot de passe</label>
                {tab === 'login' && (
                  <button type="button" onClick={handleReset} className="zreset">
                    Oublié ?
                  </button>
                )}
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                minLength={tab === 'signup' ? 6 : undefined}
                className="zinput" />
            </div>

            {message && (
              <p style={{ fontSize: '0.72rem', color: message.includes('✓') ? '#4ade80' : '#f87171', marginTop: -2 }}>
                {message}
              </p>
            )}

            <button type="submit" disabled={loading} className="zsubmit">
              {loading ? '...' : tab === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          <p style={{ marginTop: 22, fontSize: '0.62rem', color: '#2e2e2e', lineHeight: 1.6 }}>
            En continuant, vous acceptez nos{' '}
            <span style={{ textDecoration: 'underline', color: '#3a3a3a', cursor: 'pointer' }}>
              conditions d&apos;utilisation
            </span>
          </p>
        </div>

        {/* ── RIGHT PANEL (contenu sur le média plein écran) ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

          {/* Bottom gradient */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(to top, rgba(9,10,15,0.96) 0%, rgba(9,10,15,0.25) 45%, transparent 100%)',
          }} />

          {/* Content */}
          <div style={{ position: 'absolute', bottom: 52, left: 44, right: 44, zIndex: 2 }}>
            {(genres.length > 0 || year) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {genres.map((g, i) => (
                  <span key={i} style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(6px)',
                    padding: '3px 10px', borderRadius: 4,
                    fontSize: '0.6rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#bbb',
                  }}>
                    {g}
                  </span>
                ))}
                {year && (
                  <span style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '0.1em' }}>· {year}</span>
                )}
              </div>
            )}

            <h2 style={{
              color: '#fff', fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)',
              fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.02em',
              textTransform: 'uppercase', marginBottom: 10,
              textShadow: '0 2px 24px rgba(0,0,0,0.6)',
            }}>
              {title}
            </h2>

            {current?.vote_average != null && current.vote_average > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 18 }}>
                <span style={{ color: '#fbbf24' }}>★</span>
                <span style={{ color: '#d4d4d4', fontSize: '0.875rem', fontWeight: 600 }}>
                  {current.vote_average.toFixed(1)}
                </span>
              </div>
            )}

            {trending.length > 1 && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {trending.map((_, i) => (
                  <button key={i} onClick={() => advance(i)}
                    className={`zdot${i === slide ? ' zdot-active' : ''}`}
                    style={{ width: i === slide ? 22 : 6 }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ MOBILE (feuille formulaire) ═══════════════ */}
      <div className="flex flex-col md:hidden" style={{ position: 'absolute', inset: 0 }}>

        {/* Backdrop slideshow plein écran */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          {mobileImg && (
            <Image src={mobileImg} alt="" fill sizes="100vw" priority
              style={{ objectFit: 'cover', objectPosition: 'center top', opacity: fading ? 0 : 1, transition: 'opacity 0.35s ease' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,12,.35) 0%, rgba(10,10,12,.15) 22%, rgba(10,10,12,.62) 50%, #0a0a0c 88%)' }} />
        </div>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 2, padding: '46px 24px 0', flexShrink: 0 }}>
          <Image src="/zelian-tv-logo.png" alt="ZelianTV" width={120} height={28}
            style={{ filter: `${logoFilter} drop-shadow(0 2px 6px rgba(0,0,0,.6))`, height: 'auto', width: 'auto', transition: 'filter 0.3s ease' }} />
        </div>

        {/* Accroche du film courant */}
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 6px', minHeight: 0 }}>
          {chipText && (
            <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(0,0,0,.36)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(6px)', borderRadius: 8, fontSize: 10.5, fontWeight: 700, color: 'rgba(238,242,248,.8)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              {chipText}
            </span>
          )}
          <h2 key={`m-${slide}`} className="gal-display" style={{ fontSize: title.length > 13 ? 42 : 54, color: '#eef2f8', letterSpacing: '.03em', lineHeight: .9, textShadow: '0 2px 28px rgba(0,0,0,.6)', margin: 0, animation: 'zform-in .5s ease' }}>
            {title}
          </h2>
          {current?.vote_average != null && current.vote_average > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
              <span style={{ color: '#f5c518', fontSize: 15 }}>★</span>
              <span style={{ fontSize: 14, color: '#f5c518', fontWeight: 700 }}>{current.vote_average.toFixed(1)}</span>
            </div>
          )}
          {trending.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
              {trending.map((_, i) => (
                <button key={i} onClick={() => advance(i)} className={`zdot${i === slide ? ' zdot-active' : ''}`} style={{ width: i === slide ? 22 : 7 }} />
              ))}
            </div>
          )}
        </div>

        {/* Feuille formulaire */}
        <div style={{ position: 'relative', zIndex: 3, flexShrink: 0, background: 'linear-gradient(180deg, rgba(13,13,16,.92), #0c0c0f)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderTop: '1px solid var(--accent-glow)', borderRadius: '22px 22px 0 0', padding: '20px 24px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -20px 50px rgba(0,0,0,.55)' }}>

          {/* Onglets */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--accent-glow)', marginBottom: 20 }}>
            {([['login', 'Connexion'], ['signup', 'Créer un compte']] as const).map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setMessage('') }}
                className={`zmtab${tab === key ? ' zmtab-active' : ''}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleSignup}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'zform-in .4s ease' }}>

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com" required className="zinput" style={{ height: 52 }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Mot de passe</label>
                {tab === 'login' && (
                  <button type="button" onClick={handleReset} className="zreset">Oublié ?</button>
                )}
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                minLength={tab === 'signup' ? 6 : undefined}
                className="zinput" style={{ height: 52 }} />
            </div>

            {message && (
              <p style={{ fontSize: '0.78rem', color: message.includes('✓') ? '#4ade80' : '#f87171', marginTop: -2 }}>
                {message}
              </p>
            )}

            <button type="submit" disabled={loading} className="zsubmit" style={{ height: 54, fontSize: '0.78rem' }}>
              {loading ? '...' : tab === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          {/* Footer légal */}
          <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(160,150,140,.5)', marginTop: 16, lineHeight: 1.5 }}>
            En continuant, vous acceptez nos <span style={{ color: 'var(--accent)', opacity: .85 }}>conditions d&apos;utilisation</span>
          </p>
        </div>
      </div>
    </div>
  )
}
