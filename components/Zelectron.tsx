'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getRating, setRating } from '@/app/actions/rating'
import type { MediaType } from '@/lib/tmdb'

/** Symbole Zelectron (vrai logo Zelian, masque public/zelectron-shape.png) teinté à la couleur
 *  d'accent du profil via CSS mask. `dim` = état « non noté » (atténué). */
export function ZelectronIcon({ size = 16, dim = false, color = 'var(--accent)', style }: { size?: number; dim?: boolean; color?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: 'url(/zelectron-shape.png)',
        maskImage: 'url(/zelectron-shape.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        opacity: dim ? 0.24 : 1,
        transition: 'opacity .12s ease',
        ...style,
      }}
    />
  )
}

/** Badge lecture seule : symbole + note (pour les posters « déjà vu »). */
export function ZelectronBadge({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div
      title={`${rating}/10 Zelectrons`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px 0 5px',
        borderRadius: 7, background: 'rgba(10,10,12,.82)', backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,.14)', color: '#fff', fontWeight: 700, fontSize: 12.5,
      }}
    >
      <ZelectronIcon size={size} />
      {rating}
    </div>
  )
}

const MASK = {
  WebkitMaskImage: 'url(/zelectron-shape.png)',
  maskImage: 'url(/zelectron-shape.png)',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
} as const

function zLabel(v: number): string {
  if (v <= 0) return 'Pas encore noté'
  if (v <= 2) return 'Décevant'
  if (v <= 4) return 'Bof'
  if (v <= 6) return 'Correct'
  if (v <= 8) return 'Très bon'
  return 'Chef-d’œuvre'
}

/** Contrôle de notation Zelectron — jauge d'énergie : le symbole se charge de bas en haut. */
export function ZelectronRating({ tmdbId, mediaType, compact = false }: { tmdbId: number; mediaType: MediaType; compact?: boolean }) {
  const [canRate, setCanRate] = useState(false)
  const [rating, setRatingLocal] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const meterRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    let alive = true
    getRating(tmdbId, mediaType).then(r => { if (alive) { setCanRate(r.canRate); setRatingLocal(r.rating); setLoaded(true) } })
    return () => { alive = false }
  }, [tmdbId, mediaType])

  if (!loaded || !canRate) return null

  const D = compact ? 46 : 56, INSET = 5, WELL = D - INSET * 2

  function valueAt(clientY: number): number {
    const el = meterRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    return Math.round((1 - y) * 10)
  }
  function commit(v: number) {
    setRatingLocal(v || null)
    setRating(tmdbId, mediaType, v).catch(() => {})
  }

  const display = hover != null ? hover : (rating ?? 0)
  const fillPct = display * 10
  const dragging = draggingRef.current
  const full = display >= 10 // jauge pleine → lumière à la couleur du thème

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 9 : 14 }}>
      <div aria-hidden style={{ width: 1, height: compact ? 46 : 56, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />

      {/* Jauge d'énergie — réacteur circulaire */}
      <div
        ref={meterRef}
        role="slider"
        aria-label="Note Zelectron sur 10"
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={rating ?? 0}
        title="Cliquez (ou glissez) sur la jauge pour noter"
        onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ } draggingRef.current = true; setHover(valueAt(e.clientY)) }}
        onPointerMove={(e) => { if (draggingRef.current) setHover(valueAt(e.clientY)) }}
        onPointerUp={(e) => { if (draggingRef.current) { draggingRef.current = false; const v = valueAt(e.clientY); setHover(null); commit(v) } }}
        onPointerLeave={() => { if (!draggingRef.current) setHover(null) }}
        style={{ position: 'relative', width: D, height: D, flexShrink: 0, cursor: 'ns-resize', touchAction: 'none' }}
      >
        {/* halo */}
        <div aria-hidden style={{ position: 'absolute', inset: -9, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow-md), transparent 70%)', opacity: 0.12 + (display / 10) * 0.5, transition: 'opacity .16s ease', pointerEvents: 'none' }} />
        {/* anneau statique */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.14)', pointerEvents: 'none' }} />
        {/* lumière blanche tournante sur l'anneau */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 270deg, ${full ? 'var(--accent-glow)' : 'rgba(255,255,255,.12)'} 318deg, ${full ? 'var(--accent-2)' : 'rgba(255,255,255,.95)'} 350deg, transparent 360deg)`,
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          animation: 'gal-spin 4.5s linear infinite', pointerEvents: 'none',
        }} />
        {/* puits intérieur (cercle sombre, le logo charge dedans) */}
        <div aria-hidden style={{ position: 'absolute', inset: INSET, borderRadius: '50%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 38%, #16161d, #0c0c11)', boxShadow: 'inset 0 2px 9px rgba(0,0,0,.6)' }}>
          {/* base atténuée */}
          <span style={{ position: 'absolute', left: 0, bottom: 0, width: WELL, height: WELL, backgroundColor: 'rgba(255,255,255,.16)', ...MASK }} />
          {/* charge révélée du bas */}
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: `${fillPct}%`, overflow: 'hidden', transition: dragging ? 'none' : 'height .16s ease-out' }}>
            <span style={{ position: 'absolute', left: 0, bottom: 0, width: WELL, height: WELL, backgroundColor: 'var(--accent)', ...MASK }} />
          </div>
          {/* ligne de niveau — masquée quand vide (0) ou pleine (10) pour ne pas marquer le bord */}
          {display > 0 && display < 10 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${100 - fillPct}%`, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent-2), transparent)', boxShadow: '0 0 8px var(--accent)', transition: dragging ? 'none' : 'top .16s ease-out' }} />
          )}
        </div>
      </div>

      {/* Valeur + label */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: compact ? 58 : 92 }}>
        <span style={{ fontSize: compact ? 9.5 : 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Tes Zelectrons</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 2 }}>
          <span className="gal-display" style={{ fontSize: compact ? 25 : 36, lineHeight: .8, color: 'var(--accent-2)' }}>{display}</span>
          <span style={{ fontSize: compact ? 11 : 13, color: 'rgba(243,241,238,.4)', paddingBottom: compact ? 3 : 4 }}>/10</span>
        </div>
        <span style={{ fontSize: compact ? 10.5 : 12, color: 'rgba(243,241,238,.6)', fontWeight: 600, marginTop: 2 }}>{zLabel(display)}</span>
      </div>
    </div>
  )
}
