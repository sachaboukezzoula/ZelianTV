// app/profils/ProfilesClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { setActiveProfile } from '@/app/actions/profiles'
import type { Profile } from '@/app/actions/profiles'

interface Props {
  profiles: Profile[]
}

export function ProfilesClient({ profiles }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(profileId: string) {
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
      background: '#141414',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: 700, marginBottom: '2.5rem', textAlign: 'center' }}>
        Qui regarde ?
      </h1>

      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2.5rem' }}>
        {profiles.map(profile => (
          <button
            key={profile.id}
            onClick={() => handleSelect(profile.id)}
            disabled={loading === profile.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'transparent',
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading && loading !== profile.id ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 96,
              height: 96,
              borderRadius: 8,
              background: profile.color,
              position: 'relative',
              overflow: 'hidden',
              border: loading === profile.id ? '3px solid #fff' : '3px solid transparent',
              transition: 'border-color 0.15s',
            }}>
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name}
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem', fontWeight: 700, color: '#fff',
                }}>
                  {profile.name[0].toUpperCase()}
                </div>
              )}
            </div>
            <span style={{ color: '#aaa', fontSize: '0.875rem', fontWeight: 500 }}>
              {profile.name}
            </span>
          </button>
        ))}

        {/* Bouton Ajouter (affiché si < 5 profils) */}
        {profiles.length < 5 && (
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
              width: 96, height: 96, borderRadius: 8,
              background: 'transparent', border: '2px dashed #555',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', color: '#555',
            }}>
              +
            </div>
            <span style={{ color: '#555', fontSize: '0.875rem' }}>Ajouter</span>
          </Link>
        )}
      </div>

      {/* Gérer les profils */}
      <Link
        href="/profil"
        style={{ color: '#aaa', fontSize: '0.875rem', textDecoration: 'none', borderBottom: '1px solid #555' }}
      >
        Gérer les profils
      </Link>
    </div>
  )
}
