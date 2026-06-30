'use client'

import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getProfileStatistics } from '@/app/actions/stats'
import type { ProfileStatistics, GenreSlice, PersonStat, DecadeSlice, Badge as BadgeT, Superlative, Compatibility } from '@/app/actions/stats'

// Genres : accent du profil + couleurs froides distinctes + gris pour « Autres ».
const GENRE_COLORS = ['var(--accent)', '#2bb3a3', '#8b5cf6', '#3d8bff', '#e0719f']
const OTHERS_COLOR = '#5b6472'
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const EASE = 'cubic-bezier(.22,1,.36,1)'

function fmtInt(n: number) { return n.toLocaleString('fr-FR') }
function initials(name: string) {
  const p = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!p.length) return '?'
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

/* ── Hooks d'animation ── */
// Passe à true juste après le premier paint → déclenche les transitions CSS (barres, anneaux…).
function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r) }, [])
  return m
}
// Compteur animé (easeOutCubic) de 0 → target.
function useCountUp(target: number, duration = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setV(target * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setV(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}
function CountUp({ value, decimals = 0, duration = 1100, suffix, className, style }: { value: number; decimals?: number; duration?: number; suffix?: ReactNode; className?: string; style?: CSSProperties }) {
  const v = useCountUp(value, duration)
  const txt = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('fr-FR')
  return <span className={className} style={style}>{txt}{suffix}</span>
}
// Apparition en fondu + montée, avec délai (stagger).
function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  return <div style={{ animation: `gal-fade-up .6s ${EASE} both`, animationDelay: `${delay}ms`, ...style }}>{children}</div>
}

/* ── Conteneur de section (carte) ── */
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ padding: '24px 26px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', ...style }}>
      {children}
    </div>
  )
}
function CardTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div className="gal-display" style={{ fontSize: 21, letterSpacing: '.04em', lineHeight: 1 }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

/* ── Donut genres (conic-gradient) ── */
function GenreDonut({ genres, total }: { genres: GenreSlice[]; total: number }) {
  const top = genres.slice(0, 5)
  const othersCount = genres.slice(5).reduce((s, g) => s + g.count, 0)
  const sliceData = othersCount > 0
    ? [...top.map((g, i) => ({ ...g, color: GENRE_COLORS[i] })), { name: 'Autres', count: othersCount, color: OTHERS_COLOR }]
    : top.map((g, i) => ({ ...g, color: GENRE_COLORS[i] }))
  const sum = sliceData.reduce((s, g) => s + g.count, 0) || 1
  let cum = 0
  const segs = sliceData.map(g => { const a = (cum / sum) * 100; cum += g.count; const b = (cum / sum) * 100; return `${g.color} ${a}% ${b}%` })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px,4vw,34px)', marginTop: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 168, height: 168, flexShrink: 0, borderRadius: '50%', background: `conic-gradient(${segs.join(',')})`, animation: `gal-pop .8s ${EASE} both` }}>
        <div style={{ position: 'absolute', inset: 25, borderRadius: '50%', background: '#0d0d10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <CountUp value={total} duration={1200} className="gal-display" style={{ fontSize: 33, lineHeight: 1, color: 'var(--accent)' }} />
          <div style={{ fontSize: 11, color: 'rgba(243,241,238,.5)', marginTop: 2 }}>titres</div>
        </div>
      </div>
      <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 170 }}>
        {sliceData.map((g, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, animation: `gal-fade-up .5s ${EASE} both`, animationDelay: `${260 + i * 70}ms` }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: g.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'rgba(243,241,238,.82)', flex: 1 }}>{g.name}</span>
            <CountUp value={Math.round((g.count / sum) * 100)} duration={1000} suffix="%" style={{ fontSize: 13, fontWeight: 600, color: '#f3f1ee', fontVariantNumeric: 'tabular-nums' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Décennies (barres verticales animées) ── */
function DecadeBars({ decades }: { decades: DecadeSlice[] }) {
  const mounted = useMounted()
  const max = Math.max(...decades.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 12, height: 150, marginTop: 20, padding: '0 4px' }}>
      {decades.map((d, i) => {
        const isMax = d.count === max
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
            <CountUp value={d.count} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(243,241,238,.7)' }} />
            <div style={{ width: '100%', maxWidth: 44, borderRadius: '6px 6px 3px 3px', background: isMax ? 'linear-gradient(180deg,var(--accent-2),var(--accent))' : 'var(--accent)', opacity: isMax ? 1 : 0.42, boxShadow: isMax ? '0 0 16px var(--accent-glow)' : 'none', height: mounted ? `${Math.max(6, (d.count / max) * 100)}%` : '0%', transition: `height .8s ${EASE}`, transitionDelay: `${i * 60}ms` }} />
            <div style={{ fontSize: 11.5, color: 'rgba(243,241,238,.5)' }}>{d.decade.replace('0s', "0's").replace('19', '').replace('20', '')}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Diagramme d'activité (barres : années / mois / semaine / jours, animées) ── */
type Bucket = { key: string; label: string; tip: string; count: number }
type ActMode = 'années' | 'mois' | 'semaine' | 'jours'
const ACT_MODES: ActMode[] = ['années', 'mois', 'semaine', 'jours']
const ACT_SUB: Record<ActMode, string> = {
  'années': 'ton activité au fil des ans',
  'mois': 'ton rythme, mois par mois',
  'semaine': 'tes 12 dernières semaines',
  'jours': 'tes 30 derniers jours',
}
const pad2 = (n: number) => String(n).padStart(2, '0')
const keyUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`

// Barres : la clé sur `mode` les remonte → l'anim « de 0 jusqu'à la valeur » (hauteur + compteur) rejoue à chaque vue.
function ActivityBars({ data, mode }: { data: Bucket[]; mode: ActMode }) {
  const grown = useMounted()
  const max = Math.max(...data.map(d => d.count), 1)
  const barW = mode === 'années' ? 54 : mode === 'mois' ? 38 : mode === 'semaine' ? 26 : 15
  const gap = mode === 'années' ? 18 : mode === 'mois' ? 10 : mode === 'semaine' ? 8 : 4
  const showLabel = (i: number) => mode !== 'jours' || i % 5 === 0 || i === data.length - 1
  return (
    <div className="no-scrollbar" style={{ overflowX: 'auto', marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap, height: 168, minWidth: data.length * (barW + gap) }}>
        {data.map((d, i) => {
          const h = d.count > 0 ? Math.max(16, (d.count / max) * 120) : 5
          const isMax = d.count === max && d.count > 0
          return (
            <div key={d.key} title={`${d.tip} · ${d.count} film${d.count > 1 ? 's' : ''}`} style={{ flex: 1, minWidth: barW * 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 7, height: '100%' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: d.count > 0 ? 'rgba(243,241,238,.85)' : 'transparent', fontVariantNumeric: 'tabular-nums', minHeight: 14 }}>
                {d.count > 0 ? <CountUp value={d.count} duration={900} /> : '.'}
              </div>
              <div style={{ width: '100%', maxWidth: barW, height: grown ? h : 0, borderRadius: '7px 7px 2px 2px', background: d.count > 0 ? 'linear-gradient(180deg,var(--accent-2),var(--accent))' : 'rgba(255,255,255,.06)', boxShadow: isMax ? '0 0 18px var(--accent-glow)' : 'none', transition: `height .8s ${EASE}`, transitionDelay: `${i * (mode === 'jours' ? 18 : 45)}ms` }} />
              <div style={{ fontSize: 11, color: 'rgba(243,241,238,.5)', whiteSpace: 'nowrap', height: 13 }}>{showLabel(i) ? d.label : ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityChart({ dates, year }: { dates: string[]; year: number }) {
  const [mode, setMode] = useState<ActMode>('mois')

  const dayCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dates) m.set(d, (m.get(d) ?? 0) + 1)
    return m
  }, [dates])

  const data = useMemo<Bucket[]>(() => {
    const now = new Date()
    if (mode === 'années') {
      const m = new Map<number, number>()
      for (const d of dates) { const y = Number(d.slice(0, 4)); if (y) m.set(y, (m.get(y) ?? 0) + 1) }
      if (m.size === 0) return [{ key: String(year), label: String(year), tip: String(year), count: 0 }]
      const min = Math.min(...m.keys())
      const max = Math.max(now.getUTCFullYear(), ...m.keys())
      const out: Bucket[] = []
      for (let y = min; y <= max; y++) out.push({ key: String(y), label: String(y), tip: String(y), count: m.get(y) ?? 0 })
      return out
    }
    if (mode === 'jours') {
      const out: Bucket[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setUTCDate(d.getUTCDate() - i)
        const key = keyUTC(d)
        out.push({ key, label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, tip: key, count: dayCounts.get(key) ?? 0 })
      }
      return out
    }
    if (mode === 'semaine') {
      const out: Bucket[] = []
      for (let w = 11; w >= 0; w--) {
        const start = new Date(now); start.setUTCDate(start.getUTCDate() - (w * 7 + 6))
        let count = 0
        for (let k = 0; k < 7; k++) { const d = new Date(start); d.setUTCDate(d.getUTCDate() + k); count += dayCounts.get(keyUTC(d)) ?? 0 }
        out.push({ key: keyUTC(start), label: `${start.getUTCDate()}/${start.getUTCMonth() + 1}`, tip: `Semaine du ${start.getUTCDate()}/${start.getUTCMonth() + 1}`, count })
      }
      return out
    }
    // mois — 12 derniers mois
    const m = new Map<string, number>()
    for (const d of dates) { const k = d.slice(0, 7); m.set(k, (m.get(k) ?? 0) + 1) }
    const out: Bucket[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const key = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
      const mon = d.getUTCMonth()
      out.push({ key, label: MONTHS[mon], tip: `${MONTHS[mon]} ${d.getUTCFullYear()}`, count: m.get(key) ?? 0 })
    }
    return out
  }, [mode, dates, dayCounts, year])

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <CardTitle sub={ACT_SUB[mode]}>Ton activité · {year}</CardTitle>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: 3, gap: 3, flexWrap: 'wrap' }}>
          {ACT_MODES.map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ height: 28, padding: '0 13px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize', background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? '#0a0a0c' : 'rgba(243,241,238,.6)', transition: 'background .15s, color .15s' }}>{m}</button>
          ))}
        </div>
      </div>
      <ActivityBars key={mode} data={data} mode={mode} />
    </Card>
  )
}

/* ── Réalisateurs / Acteurs (barres + avatar, animées) ── */
function PeopleBars({ people }: { people: PersonStat[] }) {
  const mounted = useMounted()
  const max = Math.max(...people.map(p => p.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 18 }}>
      {people.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, animation: `gal-fade-up .5s ${EASE} both`, animationDelay: `${i * 70}ms` }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'linear-gradient(150deg,#1a2030,#10131c)', border: '1.5px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.profile_path
              ? <Image src={`https://image.tmdb.org/t/p/w185${p.profile_path}`} alt="" fill sizes="38px" className="object-cover" />
              : <span className="gal-display" style={{ fontSize: 14, color: '#fff' }}>{initials(p.name)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <span className="line-clamp-1" style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', flexShrink: 0 }}>{p.count} film{p.count > 1 ? 's' : ''}</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: mounted ? `${Math.max(8, (p.count / max) * 100)}%` : '0%', background: 'linear-gradient(90deg,var(--accent-2),var(--accent))', borderRadius: 4, transition: `width .9s ${EASE}`, transitionDelay: `${120 + i * 70}ms` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Sévère ou généreux (curseur animé) ── */
function RatingGauge({ ratings }: { ratings: ProfileStatistics['ratings'] }) {
  const mounted = useMounted()
  if (ratings.userAvg == null || ratings.publicAvg == null) {
    return (
      <>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '16px 18px', borderRadius: 11, border: '1px dashed rgba(255,255,255,.14)', background: 'rgba(255,255,255,.02)', color: 'rgba(243,241,238,.6)', fontSize: 13, lineHeight: 1.5 }}>
          Note tes films « déjà vu » pour découvrir si tu es plutôt <b style={{ color: 'var(--accent-2)' }}>sévère</b> ou <b style={{ color: 'var(--accent-2)' }}>généreux</b> face au public.
        </div>
      </>
    )
  }
  // Échelle /10 (Zelectrons côté utilisateur, note publique TMDB /10)
  const u = ratings.userAvg, p = ratings.publicAvg
  const diff = u - p
  const txt = Math.abs(diff) < 0.3 ? 'pile dans la moyenne du public' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} point${Math.abs(diff) >= 2 ? 's' : ''} ${diff >= 0 ? 'au-dessus' : 'en-dessous'} du public`
  return (
    <>
      <div style={{ fontSize: 13, color: 'rgba(243,241,238,.62)', marginTop: 8, lineHeight: 1.55 }}>Tu notes en moyenne <b style={{ color: 'var(--accent-2)' }}>{txt}</b>. {diff >= 0 ? 'Plutôt bon public !' : 'Œil critique !'}</div>
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', height: 8, borderRadius: 5, background: 'linear-gradient(90deg,#3d8bff,#2bb3a3,var(--accent))', margin: '40px 4px 0' }}>
        <div style={{ position: 'absolute', top: -30, left: `${(p / 10) * 100}%`, transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(243,241,238,.5)', whiteSpace: 'nowrap' }}>Public {p.toFixed(1)}</div>
          <div style={{ width: 2, height: 16, background: 'rgba(243,241,238,.4)', margin: '3px auto 0' }} />
        </div>
        <div style={{ position: 'absolute', top: 14, left: `${((mounted ? u : p) / 10) * 100}%`, transform: 'translateX(-50%)', textAlign: 'center', transition: `left 1s ${EASE}` }}>
          <div style={{ width: 2, height: 16, background: '#fff', margin: '0 auto 3px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 9px', background: 'var(--accent)', color: '#0a0a0c', borderRadius: 12, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Toi · {u.toFixed(1)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(243,241,238,.4)', marginTop: 44, padding: '0 4px' }}><span>Sévère</span><span>Généreux</span></div>
    </>
  )
}

/* ── Superlatif ── */
function SuperCard({ s, label }: { s: Superlative; label: string }) {
  return (
    <Link href={`/media/${s.media_type}-${s.tmdb_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card style={{ display: 'flex', gap: 13, alignItems: 'center', transition: 'border-color .18s, transform .18s', height: '100%' }}>
        <div style={{ width: 50, aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#10131c' }}>
          {s.poster_path && <Image src={`https://image.tmdb.org/t/p/w185${s.poster_path}`} alt="" fill sizes="50px" className="object-cover" />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>{label}</div>
          <div className="gal-display line-clamp-2" style={{ fontSize: 18, letterSpacing: '.02em', marginTop: 6, lineHeight: 1.05 }}>{s.title}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(243,241,238,.55)', marginTop: 4 }}>{s.value}</div>
        </div>
      </Card>
    </Link>
  )
}

/* ── Badge ── */
function BadgeItem({ b, delay }: { b: BadgeT; delay: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, borderRadius: 11, background: b.unlocked ? 'var(--accent-glow-sm)' : 'rgba(255,255,255,.03)', border: `1px solid ${b.unlocked ? 'var(--accent-glow)' : 'rgba(255,255,255,.08)'}`, animation: `gal-pop .5s ${EASE} both`, animationDelay: `${delay}ms` }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: b.unlocked ? 'var(--accent)' : 'rgba(255,255,255,.06)', color: b.unlocked ? '#0a0a0c' : 'rgba(243,241,238,.35)' }}>
        {b.unlocked
          ? <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          : <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" /></svg>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: b.unlocked ? '#f3f1ee' : 'rgba(243,241,238,.55)' }}>{b.label}</div>
        <div style={{ fontSize: 11, color: 'rgba(243,241,238,.48)', marginTop: 2 }}>{b.unlocked ? 'Débloqué' : `${b.progress} / ${b.target}`}</div>
      </div>
    </div>
  )
}

/* ── Compatibilité (anneau tracé + compteur) ── */
function CompatCard({ compat, pseudo }: { compat: Compatibility | null; pseudo: string }) {
  const mounted = useMounted()
  if (!compat) {
    return (
      <Card style={{ display: 'flex', flexDirection: 'column' }}>
        <CardTitle>Compatibilité</CardTitle>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10, padding: '20px 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-glow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M8 14s-5-3.2-5-7a2.6 2.6 0 015-1 2.6 2.6 0 015 1c0 3.8-5 7-5 7z" stroke="var(--accent)" strokeWidth="1.4" /></svg>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(243,241,238,.55)', lineHeight: 1.5, maxWidth: 220 }}>Crée un second profil pour comparer vos goûts cinéma.</div>
        </div>
      </Card>
    )
  }
  const R = 52, C = 2 * Math.PI * R
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <CardTitle>Compatibilité</CardTitle>
      <div style={{ position: 'relative', width: 124, height: 124, marginTop: 16 }}>
        <svg width={124} height={124} viewBox="0 0 124 124">
          <circle cx={62} cy={62} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={11} />
          <circle cx={62} cy={62} r={R} fill="none" stroke="var(--accent)" strokeWidth={11} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={mounted ? C * (1 - compat.score / 100) : C}
            transform="rotate(-90 62 62)" style={{ transition: `stroke-dashoffset 1.2s ${EASE}` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CountUp value={compat.score} duration={1200} suffix="%" className="gal-display" style={{ fontSize: 38, lineHeight: 1, color: 'var(--accent)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(150deg,#1a2030,#10131c)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }} className="gal-display">{initials(pseudo)}</span>
        <span style={{ fontSize: 13, color: 'rgba(243,241,238,.6)' }}>{pseudo || 'Toi'} &amp; {compat.otherName}</span>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(150deg,#3a1024,#9e2a52)', border: '1.5px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }} className="gal-display">{compat.otherInitials}</span>
      </div>
      {compat.sharedGenres.length > 0 && (
        <div style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', marginTop: 10, lineHeight: 1.5 }}>Goûts proches en {compat.sharedGenres.map((g, i) => <b key={i} style={{ color: 'var(--accent-2)' }}>{g}{i < compat.sharedGenres.length - 1 ? ' et ' : ''}</b>)}.</div>
      )}
    </Card>
  )
}

/* ── Carte stat du héro (compteur animé) ── */
type HeroStatDef = { n: number | null; label: string; decimals?: number; suffix?: string; fallback?: string }
function HeroStat({ def, delay }: { def: HeroStatDef; delay: number }) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', animation: `gal-fade-up .6s ${EASE} both`, animationDelay: `${delay}ms` }}>
      <div className="gal-display" style={{ fontSize: 34, lineHeight: 1 }}>
        {def.n == null
          ? (def.fallback ?? '—')
          : <CountUp value={def.n} decimals={def.decimals ?? 0} suffix={def.suffix ? (def.decimals ? <span style={{ fontSize: 15, color: 'rgba(243,241,238,.4)' }}>{def.suffix}</span> : def.suffix) : undefined} />}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', marginTop: 3 }}>{def.label}</div>
    </div>
  )
}

/* ─────────────────────── Composant principal ─────────────────────── */

export function StatsTab({ pseudo, profileId }: { pseudo: string; profileId: string }) {
  const [stats, setStats] = useState<ProfileStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    getProfileStatistics(profileId).then(s => { if (alive) { setStats(s); setLoading(false) } }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [profileId])

  function share() {
    if (!stats) return
    const h = Math.round(stats.totalRuntimeMinutes / 60)
    const recap = `Ma rétro Zelian ${stats.year} : ${stats.watchedCount} titres vus · ≈ ${h} h · ${stats.genresExploredCount} genres explorés.`
    navigator.clipboard?.writeText(`${recap}\n${typeof window !== 'undefined' ? window.location.href : ''}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8 }}>
        <div className="animate-pulse" style={{ height: 210, borderRadius: 18, background: 'rgba(255,255,255,.04)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 18 }}>
          {[0, 1].map(i => <div key={i} className="animate-pulse" style={{ height: 230, borderRadius: 14, background: 'rgba(255,255,255,.03)' }} />)}
        </div>
        <div className="animate-pulse" style={{ height: 200, borderRadius: 14, background: 'rgba(255,255,255,.03)' }} />
      </div>
    )
  }

  if (!stats || !stats.hasData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '70px 20px 50px' }}>
        <div style={{ position: 'relative', width: 116, height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow-md), transparent 68%)' }} />
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none"><path d="M4 19V9m5 10V5m5 14v-7m5 7V8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" /></svg>
        </div>
        <div className="gal-display" style={{ fontSize: 38, letterSpacing: '.03em' }}>Ton histoire commence ici</div>
        <p style={{ fontSize: 15, color: 'rgba(243,241,238,.6)', marginTop: 12, maxWidth: 440, lineHeight: 1.6 }}>
          Marque tes premiers films comme <b style={{ color: 'var(--accent-2)' }}>vus</b> : tes genres favoris, ton temps de visionnage et tes réalisateurs phares apparaîtront ici.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 48, padding: '0 26px', background: 'var(--accent)', color: '#0a0a0c', borderRadius: 9, fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 24px var(--accent-glow)' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>Explorer le catalogue
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 26, marginTop: 44, opacity: 0.5 }}>
          {[['0', 'films vus'], ['0 h', 'visionnage'], ['0', 'genres']].map(([v, l], i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div className="gal-display" style={{ fontSize: 30, color: 'rgba(243,241,238,.4)' }}>{v}</div>
              <div style={{ fontSize: 12, color: 'rgba(243,241,238,.4)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const s = stats
  const hours = Math.round(s.totalRuntimeMinutes / 60)
  const heroStatDefs: HeroStatDef[] = [
    { n: hours, label: 'Temps estimé', suffix: ' h' },
    { n: s.genresExploredCount, label: 'Genres explorés' },
    { n: s.watchlistCount, label: 'Dans la backlog' },
    { n: s.ratings.userAvg, label: 'Note moyenne', decimals: 1, suffix: '/10', fallback: '—' },
  ]

  return (
    <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── HÉRO RÉTRO ── */}
      <Reveal>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, border: '1px solid var(--accent-glow)', background: 'linear-gradient(140deg, var(--accent-glow-sm), rgba(255,255,255,.02))', padding: 'clamp(26px,4vw,38px) clamp(22px,4vw,40px)' }}>
        <div aria-hidden style={{ position: 'absolute', top: -120, right: -40, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow-md), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', gap: 'clamp(24px,5vw,50px)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              <span style={{ width: 22, height: 1, background: 'var(--accent)' }} />Ta rétro Zelian
            </div>
            <div className="gal-display" style={{ fontSize: 28, letterSpacing: '.04em', marginTop: 8, color: 'rgba(243,241,238,.85)' }}>{pseudo ? `L'année de ${pseudo}` : 'Ton année'} · {s.year}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 12 }}>
              <CountUp value={s.watchedCount} duration={1400} className="gal-display" style={{ fontSize: 'clamp(72px,16vw,120px)', lineHeight: 0.82, color: 'var(--accent)', textShadow: '0 6px 40px var(--accent-glow)' }} />
              <div style={{ paddingBottom: 16 }}>
                <div className="gal-display" style={{ fontSize: 28, lineHeight: 1, color: '#f3f1ee' }}>titres vus</div>
                <div style={{ fontSize: 13, color: 'rgba(243,241,238,.5)', marginTop: 3 }}>soit ≈ {fmtInt(hours)} h de visionnage <span style={{ opacity: .6 }}>· estimation</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
              <button onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 46, padding: '0 22px', background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px var(--accent-glow)' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12.5h10" stroke="#0a0a0c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>Exporter ma rétro
              </button>
              <button onClick={share} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 20px', background: 'rgba(255,255,255,.08)', color: '#f3f1ee', border: '1px solid rgba(255,255,255,.16)', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11 5.5a2 2 0 10-1.9-2.6L6.4 4.5a2 2 0 100 3l2.7 1.6a2 2 0 10.5-1L7 6.5a2 2 0 000-1l2.6-1.6c.35.36.85.6 1.4.6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>{copied ? 'Copié !' : 'Partager'}
              </button>
            </div>
          </div>
          <div style={{ flex: '1 1 280px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignSelf: 'stretch', paddingBottom: 4 }}>
            {heroStatDefs.map((def, i) => <HeroStat key={i} def={def} delay={200 + i * 90} />)}
          </div>
        </div>
        </div>
      </Reveal>

      {/* ── GENRES + DÉCENNIES ── */}
      <Reveal delay={90}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          <Card>
            <CardTitle>Répartition par genre</CardTitle>
            <GenreDonut genres={s.genres} total={s.watchedCount} />
          </Card>
          {s.decades.length > 0 && (
            <Card>
              <CardTitle sub="nouveautés ou classiques ?">Par décennie</CardTitle>
              <DecadeBars decades={s.decades} />
            </Card>
          )}
        </div>
      </Reveal>

      {/* ── ACTIVITÉ (années / mois / semaine / jours) ── */}
      <Reveal delay={150}>
        <ActivityChart dates={s.activityDates} year={s.year} />
      </Reveal>

      {/* ── RÉALISATEURS + SÉVÈRE/GÉNÉREUX ── */}
      <Reveal delay={210}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          {s.topDirectors.length > 0 ? (
            <Card><CardTitle>Tes réalisateurs phares</CardTitle><PeopleBars people={s.topDirectors} /></Card>
          ) : s.topActors.length > 0 ? (
            <Card><CardTitle>Tes acteurs phares</CardTitle><PeopleBars people={s.topActors} /></Card>
          ) : <div />}
          <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <CardTitle>Sévère ou généreux ?</CardTitle>
            <RatingGauge ratings={s.ratings} />
          </Card>
        </div>
      </Reveal>

      {/* ── ACTEURS (si réalisateurs déjà affichés) ── */}
      {s.topDirectors.length > 0 && s.topActors.length > 0 && (
        <Reveal delay={250}>
          <Card><CardTitle>Tes acteurs phares</CardTitle><PeopleBars people={s.topActors} /></Card>
        </Reveal>
      )}

      {/* ── SUPERLATIFS ── */}
      {(s.superlatives.longest || s.superlatives.bestRated || s.superlatives.oldest) && (
        <Reveal delay={300}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
            {s.superlatives.longest && <SuperCard s={s.superlatives.longest} label="Le plus long" />}
            {s.superlatives.bestRated && <SuperCard s={s.superlatives.bestRated} label="Le mieux noté" />}
            {s.superlatives.oldest && <SuperCard s={s.superlatives.oldest} label="Le plus ancien" />}
          </div>
        </Reveal>
      )}

      {/* ── BADGES + COMPATIBILITÉ ── */}
      <Reveal delay={360}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="gal-display" style={{ fontSize: 21, letterSpacing: '.04em' }}>Objectifs &amp; badges</span>
              <span style={{ fontSize: 12, color: 'rgba(243,241,238,.45)' }}>{s.badges.filter(b => b.unlocked).length} / {s.badges.length} débloqués</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginTop: 18 }}>
              {s.badges.map((b, i) => <BadgeItem key={b.id} b={b} delay={i * 60} />)}
            </div>
          </Card>
          <CompatCard compat={s.compatibility} pseudo={pseudo} />
        </div>
      </Reveal>

      <p style={{ fontSize: 11.5, color: 'rgba(243,241,238,.35)', marginTop: 4, lineHeight: 1.5 }}>
        Statistiques basées sur ce que tu marques dans Zelian (et non sur un visionnage mesuré). Les durées sont estimées d&apos;après les métadonnées TMDB.
      </p>
    </div>
  )
}
