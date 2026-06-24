// app/profils/[id]/modifier/ProfileEditClient.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { updateProfile, deleteProfile } from '@/app/actions/profiles'
import { uploadProfileAvatarAction } from '@/app/actions/avatar'
import type { Profile } from '@/app/actions/profiles'

function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
        else { width = Math.round((width * maxDim) / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas non supporté')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression échouée')); return }
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire l\'image')) }
    img.src = url
  })
}

const COLORS = ['#f97316', '#2563eb', '#16a34a', '#7c3aed', '#ca8a04', '#0891b2', '#dc2626', '#db2777']

interface Props {
  profile: Profile
  canDelete: boolean
}

export function ProfileEditClient({ profile, canDelete }: Props) {
  const router = useRouter()
  const [name, setName] = useState(profile.name)
  const [color, setColor] = useState(profile.color)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const compressed = await compressImage(file, 400, 0.85)
      setAvatarFile(new File([compressed], 'avatar.jpg', { type: 'image/jpeg' }))
      setAvatarPreview(URL.createObjectURL(compressed))
    } catch { setError('Impossible de traiter l\'image.') }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis.'); return }
    setLoading(true)
    setError(null)

    let finalAvatarUrl = avatarPreview

    if (avatarFile) {
      const formData = new FormData()
      formData.append('file', avatarFile)
      const uploadResult = await uploadProfileAvatarAction(formData, profile.id)
      if ('error' in uploadResult) { setError(uploadResult.error ?? null); setLoading(false); return }
      finalAvatarUrl = uploadResult.url
    }

    const result = await updateProfile(profile.id, name.trim(), finalAvatarUrl, color)
    if ('error' in result) { setError(result.error); setLoading(false); return }

    router.push('/profils')
    router.refresh()
  }

  async function handleDelete() {
    setLoading(true)
    const result = await deleteProfile(profile.id)
    if ('error' in result) { setError(result.error); setLoading(false); return }
    router.push('/profils')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#141414',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>
        Modifier le profil
      </h1>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ width: 96, height: 96, borderRadius: 8, background: color, border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            {avatarPreview
              ? <Image src={avatarPreview} alt="Avatar" fill style={{ objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: '2rem', fontWeight: 700 }}>{name ? name[0].toUpperCase() : '?'}</span>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        <div>
          <p style={{ color: '#aaa', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Couleur</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                style={{ width: 28, height: 28, borderRadius: 4, background: c, border: 'none', cursor: 'pointer',
                  outline: color === c ? '2px solid #fff' : '2px solid transparent', outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Nom du profil" maxLength={30}
          style={{ background: '#222', border: '1px solid #333', borderRadius: 6, padding: '10px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />

        {error && <p style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={loading || !name.trim()}
            style={{ flex: 1, background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '10px', fontWeight: 600, cursor: 'pointer', opacity: loading || !name.trim() ? 0.6 : 1 }}>
            {loading ? '...' : 'Enregistrer'}
          </button>
          <button type="button" onClick={() => router.back()}
            style={{ flex: 1, background: 'transparent', color: '#aaa', border: '1px solid #333', borderRadius: 6, padding: '10px', cursor: 'pointer' }}>
            Annuler
          </button>
        </div>

        {canDelete && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)}
            style={{ background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
            Supprimer ce profil
          </button>
        )}

        {confirmDelete && (
          <div style={{ background: '#1c1c1c', border: '1px solid #f87171', borderRadius: 8, padding: '1rem' }}>
            <p style={{ color: '#fff', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Supprimer ce profil et toutes ses listes ?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleDelete} disabled={loading}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                Confirmer
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
