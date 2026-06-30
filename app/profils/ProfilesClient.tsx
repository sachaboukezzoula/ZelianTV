// app/profils/ProfilesClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { setActiveProfile } from '@/app/actions/profiles'
import type { Profile } from '@/app/actions/profiles'

interface ProfileWithStats extends Profile {
  mediaCount: number
  listCount: number
}

interface Props {
  profiles: ProfileWithStats[]
}

export function ProfilesClient({ profiles }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(profileId: string) {
    if (editMode) return
    setLoading(profileId)
    setError(null)
    const result = await setActiveProfile(profileId)
    if ('error' in result) {
      setError(result.error)
      setLoading(null)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 78% 58% at 50% 50%, var(--accent-glow-md) 0%, transparent 70%), #141414',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Titre */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{
          color: '#fff',
          fontSize: 'clamp(2.2rem, 7vw, 4.5rem)',
          fontWeight: 900,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          lineHeight: 1,
          margin: 0,
        }}>
          QUI REGARDE{' '}
          <span style={{ color: 'var(--accent)' }}>?</span>
        </h1>
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--accent-glow-md), transparent)', marginTop: '1.25rem', width: '100%', maxWidth: 340, margin: '1.25rem auto 0' }} />
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error}</p>
      )}

      {/* Grille de profils */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3rem' }}>
        {profiles.map(profile => (
          <div key={profile.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => editMode
                ? router.push(`/profils/${profile.id}/modifier`)
                : handleSelect(profile.id)
              }
              disabled={!editMode && loading === profile.id}
              style={{
                position: 'relative',
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: profile.color,
                overflow: 'hidden',
                border: loading === profile.id ? '3px solid #fff' : '3px solid transparent',
                cursor: loading && !editMode ? 'default' : 'pointer',
                opacity: loading && !editMode && loading !== profile.id ? 0.4 : 1,
                transition: 'opacity 0.2s, transform 0.18s, border-color 0.15s, box-shadow 0.18s',
                flexShrink: 0,
                padding: 0,
                boxShadow: editMode ? '0 0 0 2px var(--accent)' : '0 4px 24px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={e => {
                if (!loading || editMode) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = editMode
                    ? '0 0 0 2px var(--accent), 0 8px 32px rgba(0,0,0,0.5)'
                    : '0 8px 32px rgba(0,0,0,0.5)'
                }
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = editMode
                  ? '0 0 0 2px var(--accent)'
                  : '0 4px 24px rgba(0,0,0,0.4)'
              }}
            >
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name}
                  fill
                  sizes="140px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '3.5rem', fontWeight: 700, color: '#fff',
                }}>
                  {profile.name[0].toUpperCase()}
                </div>
              )}

              {/* Overlay édition */}
              {editMode && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
              )}
            </button>

            <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>
              {profile.name}
            </span>
            <span style={{ color: '#666', fontSize: '0.75rem', letterSpacing: '0.02em' }}>
              {profile.mediaCount} film{profile.mediaCount !== 1 ? 's' : ''} · {profile.listCount} liste{profile.listCount !== 1 ? 's' : ''}
            </span>
          </div>
        ))}

        {/* Bouton Ajouter */}
        {!editMode && profiles.length < 5 && (
          <Link
            href="/profils/nouveau"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: 140, height: 140, borderRadius: '50%',
              background: 'transparent',
              border: '2px dashed #444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3rem', color: '#555',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = '#888'
              ;(e.currentTarget as HTMLDivElement).style.color = '#999'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = '#444'
              ;(e.currentTarget as HTMLDivElement).style.color = '#555'
            }}
            >
              +
            </div>
            <span style={{ color: '#555', fontSize: '0.875rem' }}>Ajouter</span>
          </Link>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => setEditMode(m => !m)}
        onMouseEnter={e => {
          const b = e.currentTarget
          b.style.borderColor = 'var(--accent)'
          b.style.color = 'var(--accent)'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget
          b.style.borderColor = editMode ? 'var(--accent)' : '#333'
          b.style.color = editMode ? 'var(--accent)' : '#666'
        }}
        style={{
          background: 'transparent',
          border: editMode ? '1px solid var(--accent)' : '1px solid #333',
          color: editMode ? 'var(--accent)' : '#666',
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          padding: '0.6rem 1.5rem',
          borderRadius: 4,
          cursor: 'pointer',
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        {editMode ? 'Terminer' : 'Gérer les profils'}
      </button>
    </div>
  )
}
