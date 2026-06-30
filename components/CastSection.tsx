'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { CastMember } from '@/lib/tmdb'

const CAST_GRADS = [
  'linear-gradient(150deg,#3a2c08,#7a5e14)',
  'linear-gradient(150deg,#08263a,#136a8a)',
  'linear-gradient(150deg,#2a1245,#5b2db0)',
  'linear-gradient(150deg,#3a1024,#9e2a52)',
  'linear-gradient(150deg,#0a2a1a,#15704a)',
  'linear-gradient(150deg,#2a1a08,#7a4a14)',
]

const INITIAL = 6

export function CastSection({ cast }: { cast: CastMember[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? cast : cast.slice(0, INITIAL)
  const remaining = cast.length - INITIAL

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {shown.map((member, i) => (
        <Link
          key={member.id}
          href={`/person/${member.id}`}
          title={member.name}
          className="fiche-cast"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 92, textDecoration: 'none', color: 'inherit' }}
        >
          <div className="fiche-cast-photo" style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: CAST_GRADS[i % CAST_GRADS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(0,0,0,.4)', border: '2px solid rgba(255,255,255,.1)' }}>
            {member.profile_path ? (
              <Image src={`https://image.tmdb.org/t/p/w185${member.profile_path}`} alt={member.name} fill sizes="72px" className="object-cover" />
            ) : (
              <span className="gal-display" style={{ fontSize: 24, color: '#fff' }}>{member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
            )}
          </div>
          <div className="fiche-cast-name" style={{ fontSize: 13, fontWeight: 600, marginTop: 11, textAlign: 'center' }}>{member.name}</div>
          {member.character && <div style={{ fontSize: 11.5, color: 'rgba(243,241,238,.45)', marginTop: 1, textAlign: 'center' }}>{member.character}</div>}
        </Link>
      ))}

      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="fiche-cast"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 92, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div className="fiche-cast-photo" style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'rgba(243,241,238,.7)' }}>+{remaining}</div>
          <div className="fiche-cast-name" style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', marginTop: 11 }}>Voir tout</div>
        </button>
      )}

      {expanded && cast.length > INITIAL && (
        <button
          onClick={() => setExpanded(false)}
          className="fiche-cast"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 92, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div className="fiche-cast-photo" style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(243,241,238,.7)' }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div className="fiche-cast-name" style={{ fontSize: 12, color: 'rgba(243,241,238,.5)', marginTop: 11 }}>Réduire</div>
        </button>
      )}
    </div>
  )
}
