'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getTitle, type Media } from '@/lib/tmdb'
import Image from 'next/image'
import { removeFromList, deleteList, reorderItems, moveToList } from '@/app/actions/watchlist'
import { uploadAvatarAction } from '@/app/actions/avatar'
import { changeEmailAction } from '@/app/actions/profile'
import type { Profile } from '@/app/actions/profiles'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { MediaListItem } from './DndMedia'
import { DroppableMiniGrid, GhostPoster } from './DndMedia'

interface Props {
  user: User
  lists: MediaListItem[]
  preferredGenres: number[]
  recommendations: Media[]
  activeProfile: Profile | null
}

const FIXED_ORDER = ['watchlist', 'watched']
const FIXED_LABELS: Record<string, string> = {
  watchlist: 'À voir',
  watched: 'Déjà vu',
}

function listLabel(listType: string): string {
  return FIXED_LABELS[listType] ?? listType
}

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
      canvas.width = width
      canvas.height = height
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

export function ProfileClient({ user, lists, preferredGenres: _preferredGenres, recommendations, activeProfile: _activeProfile }: Props) {
  const router = useRouter()
  const [editingList, setEditingList] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  // Edition profil
  const [editMode, setEditMode] = useState<'pseudo' | 'email' | 'password' | null>(null)
  const [formValue, setFormValue] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const displayName = user.user_metadata?.display_name as string | undefined

  function openEdit(mode: typeof editMode) {
    setEditMode(mode)
    setFormValue(mode === 'pseudo' ? (displayName ?? '') : mode === 'email' ? (user.email ?? '') : '')
    setConfirmValue('')
    setFormError(null)
    setFormSuccess(null)
  }

  function closeEdit() {
    setEditMode(null)
    setFormValue('')
    setConfirmValue('')
    setFormError(null)
    setFormSuccess(null)
    setFormLoading(false)
  }

  async function handleSubmit() {
    setFormError(null)
    setFormLoading(true)
    try {
      const supabase = createClient()
      if (editMode === 'pseudo') {
        const { error } = await supabase.auth.updateUser({ data: { display_name: formValue.trim() } })
        if (error) throw error
        setFormSuccess('Pseudo mis à jour.')
        router.refresh()
      } else if (editMode === 'email') {
        const result = await changeEmailAction(formValue.trim())
        if ('error' in result && result.error) throw new Error(result.error)
        setFormSuccess('Adresse email mise à jour.')
        router.refresh()
      } else if (editMode === 'password') {
        if (formValue !== confirmValue) { setFormError('Les mots de passe ne correspondent pas.'); setFormLoading(false); return }
        if (formValue.length < 6) { setFormError('Minimum 6 caractères.'); setFormLoading(false); return }
        const { error } = await supabase.auth.updateUser({ password: formValue })
        if (error) throw error
        setFormSuccess('Mot de passe mis à jour.')
      }
    } catch (e: unknown) {
      setFormError((e as Error).message ?? 'Une erreur est survenue.')
    }
    setFormLoading(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAvatarLoading(true)
    setActionError(null)
    try {
      const compressed = await compressImage(file, 400, 0.85)
      const formData = new FormData()
      formData.append('file', new File([compressed], 'avatar.jpg', { type: 'image/jpeg' }))
      const result = await uploadAvatarAction(formData)
      if ('error' in result) throw new Error(result.error)
      router.refresh()
    } catch (e: unknown) {
      setActionError((e as Error).message ?? 'Erreur upload avatar.')
    }
    setAvatarLoading(false)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  async function handleRemoveItem(id: string) {
    if (!id) return
    let capturedSnapshot: Record<string, MediaListItem[]> | null = null
    setLocalGrouped(prev => {
      capturedSnapshot = Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, [...v]])
      ) as Record<string, MediaListItem[]>
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(i => i.id !== id)
      }
      return next
    })
    const result = await removeFromList(id)
    if ('error' in result) {
      if (capturedSnapshot) setLocalGrouped(capturedSnapshot)
      setActionError((result as { error: string }).error)
    } else {
      setActionError(null)
      router.refresh()
    }
  }

  async function handleDeleteList(listType: string) {
    const result = await deleteList(listType)
    if ('error' in result) {
      setActionError((result as { error: string }).error)
      return
    }
    setActionError(null)
    setEditingList(null)
    setConfirmDelete(null)
    router.refresh()
  }

  const [localGrouped, setLocalGrouped] = useState<Record<string, MediaListItem[]>>(
    () => lists.reduce((acc, item) => {
      if (!acc[item.list_type]) acc[item.list_type] = []
      acc[item.list_type].push(item)
      return acc
    }, {} as Record<string, MediaListItem[]>)
  )
  const [activeItem, setActiveItem] = useState<MediaListItem | null>(null)

  useEffect(() => {
    setLocalGrouped(
      lists.reduce((acc, item) => {
        if (!acc[item.list_type]) acc[item.list_type] = []
        acc[item.list_type].push(item)
        return acc
      }, {} as Record<string, MediaListItem[]>)
    )
  }, [lists])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const watchedCount = (localGrouped['watched'] ?? []).length
  const watchlistCount = (localGrouped['watchlist'] ?? []).length
  const customKeys = useMemo(
    () => Object.keys(localGrouped).filter(k => !FIXED_ORDER.includes(k)),
    [localGrouped]
  )

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    const listType = event.active.data.current?.listType as string
    const item = (localGrouped[listType] ?? []).find(i => i.id === id) ?? null
    setActiveItem(item)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    if (!over) return

    const activeId = String(active.id)
    const activeListType = active.data.current?.listType as string
    const overListType = (over.data.current?.listType as string | undefined) ?? String(over.id)

    if (activeListType === overListType) {
      const items = localGrouped[activeListType] ?? []
      const oldIndex = items.findIndex(i => i.id === activeId)
      if (oldIndex < 0) return
      const overId = String(over.id)
      let newIndex = items.findIndex(i => i.id === overId)
      if (newIndex < 0) newIndex = items.length - 1
      if (oldIndex === newIndex) return

      const reordered = arrayMove(items, oldIndex, newIndex)
      setLocalGrouped(prev => ({ ...prev, [activeListType]: reordered }))
      reorderItems(activeListType, reordered.map(i => i.id)).then(result => {
        if ('error' in result) setActionError((result as { error: string }).error)
      })
    } else {
      const movedItem = (localGrouped[activeListType] ?? []).find(i => i.id === activeId)
      if (!movedItem) return

      let capturedSnapshot: Record<string, typeof movedItem[]> | null = null

      setLocalGrouped(prev => {
        capturedSnapshot = Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, [...v]])
        ) as Record<string, MediaListItem[]>
        return {
          ...prev,
          [activeListType]: (prev[activeListType] ?? []).filter(i => i.id !== activeId),
          [overListType]: [...(prev[overListType] ?? []), { ...movedItem, list_type: overListType }],
        }
      })

      moveToList(activeId, overListType).then(result => {
        if ('error' in result) {
          setActionError((result as { error: string }).error)
          if (capturedSnapshot) setLocalGrouped(capturedSnapshot)
        }
      })
    }
  }

  const editTitles = { pseudo: 'Modifier le pseudo', email: "Modifier l'adresse mail", password: 'Changer le mot de passe' }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar */}
        <aside className="md:w-56 shrink-0">
          <div className="md:sticky md:top-20 space-y-6">
            {/* Avatar + infos */}
            <div className="flex md:flex-col items-center md:items-start gap-4">
              {/* Avatar cliquable */}
              <div
                className="relative w-16 h-16 md:w-24 md:h-24 rounded-full shrink-0"
                onMouseEnter={() => setAvatarHovered(true)}
                onMouseLeave={() => setAvatarHovered(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" fill sizes="(min-width: 768px) 96px, 64px" className="rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] font-semibold text-2xl md:text-4xl">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: avatarHovered || avatarLoading ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}>
                  {avatarLoading
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  }
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="min-w-0">
                {/* Pseudo */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-[var(--text)] text-base md:text-xl font-semibold">{displayName ?? 'Mon profil'}</p>
                  <button onClick={() => openEdit('pseudo')} title="Modifier le pseudo" style={{ cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
                {/* Email */}
                <div className="flex items-center gap-1.5">
                  <p className="text-[var(--text-muted)] text-xs md:text-sm truncate max-w-[160px] md:max-w-full">{user.email}</p>
                  <button onClick={() => openEdit('email')} title="Modifier l'email" style={{ cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              <div className="bg-[var(--navbar)] border border-[var(--border)] rounded-lg px-3 py-2.5 flex flex-col items-center">
                <p className="text-[var(--accent)] text-lg font-semibold">{watchedCount}</p>
                <p className="text-[var(--text-muted)] text-sm">Films vus</p>
              </div>
              <div className="bg-[var(--navbar)] border border-[var(--border)] rounded-lg px-3 py-2.5 flex flex-col items-center">
                <p className="text-[var(--text)] text-lg font-semibold">{watchlistCount}</p>
                <p className="text-[var(--text-muted)] text-sm">À voir</p>
              </div>
              {customKeys.length > 0 && (
                <div className="bg-[var(--navbar)] border border-[var(--border)] rounded-lg px-3 py-2.5 col-span-2 md:col-span-1 flex flex-col items-center">
                  <p className="text-[var(--text)] text-lg font-semibold">{customKeys.length}</p>
                  <p className="text-[var(--text-muted)] text-sm">Listes perso</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => openEdit('password')}
                onMouseEnter={() => setHoveredBtn('pwd')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{ cursor: 'pointer', transition: 'border-color 0.15s ease, color 0.15s ease', borderColor: hoveredBtn === 'pwd' ? '#888' : 'var(--border)', color: hoveredBtn === 'pwd' ? 'var(--text)' : 'var(--text-muted)' }}
                className="text-xs border px-3 py-1.5 rounded text-left"
              >
                Changer le mot de passe
              </button>
              <button
                onClick={logout}
                onMouseEnter={() => setHoveredBtn('logout')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{ cursor: 'pointer', transition: 'border-color 0.15s ease, color 0.15s ease', borderColor: hoveredBtn === 'logout' ? '#888' : 'var(--border)', color: hoveredBtn === 'logout' ? 'var(--text)' : 'var(--text-muted)' }}
                className="text-xs border px-3 py-1.5 rounded text-left"
              >
                Déconnexion
              </button>
            </div>
            {/* Lien gestion profils */}
            <Link
              href="/profils"
              style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'none' }}
            >
              ← Changer de profil
            </Link>
          </div>
        </aside>

      {/* Modal édition profil */}
      {editMode && (
        <div onClick={closeEdit} style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 12, padding: '24px', width: '100%', maxWidth: 400, margin: '0 16px' }}>
            <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>{editTitles[editMode]}</h3>

            {formSuccess ? (
              <div style={{ color: '#4ade80', fontSize: '0.8rem', marginBottom: 16 }}>{formSuccess}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <input
                  type={editMode === 'password' ? 'password' : editMode === 'email' ? 'email' : 'text'}
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !formLoading && handleSubmit()}
                  placeholder={editMode === 'pseudo' ? 'Nouveau pseudo' : editMode === 'email' ? 'Nouvelle adresse mail' : 'Nouveau mot de passe'}
                  style={{ background: '#111', border: '1px solid #333', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: '0.8rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
                {editMode === 'password' && (
                  <input
                    type="password"
                    value={confirmValue}
                    onChange={e => setConfirmValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !formLoading && handleSubmit()}
                    placeholder="Confirmer le mot de passe"
                    style={{ background: '#111', border: '1px solid #333', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: '0.8rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                )}
                {formError && <p style={{ color: '#f87171', fontSize: '0.75rem' }}>{formError}</p>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {!formSuccess && (
                <button
                  onClick={handleSubmit}
                  disabled={formLoading || !formValue.trim()}
                  style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: formLoading ? 'default' : 'pointer', opacity: formLoading || !formValue.trim() ? 0.6 : 1 }}
                >
                  {formLoading ? '...' : 'Confirmer'}
                </button>
              )}
              <button
                onClick={closeEdit}
                style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, padding: '7px 16px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {formSuccess ? 'Fermer' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Contenu principal */}
        <main className="flex-1 min-w-0">
          {actionError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
              {actionError}
            </div>
          )}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Listes fixes */}
            {FIXED_ORDER.map(key => (
              <Section
                key={key}
                title={`${listLabel(key)} (${(localGrouped[key] ?? []).length})`}
                isEditing={editingList === key}
                onToggleEdit={() => {
                  if (editingList === key) {
                    setEditingList(null)
                    setConfirmDelete(null)
                  } else {
                    setEditingList(key)
                  }
                }}
                canDelete={false}
              >
                <DroppableMiniGrid
                  items={localGrouped[key] ?? []}
                  listType={key}
                  isDragActive={activeItem !== null}
                  isEditing={editingList === key}
                  emptyText={
                    key === 'watchlist'
                      ? "Aucun film ou série à voir. Ajoutez des médias depuis la page d'accueil."
                      : 'Aucun média marqué comme déjà vu.'
                  }
                  onRemove={handleRemoveItem}
                />
              </Section>
            ))}

            {/* Listes custom */}
            {customKeys.map(key => (
              <Section
                key={key}
                title={`${listLabel(key)} (${(localGrouped[key] ?? []).length})`}
                isEditing={editingList === key}
                onToggleEdit={() => {
                  if (editingList === key) {
                    setEditingList(null)
                    setConfirmDelete(null)
                  } else {
                    setEditingList(key)
                  }
                }}
                canDelete={true}
                confirmingDelete={confirmDelete === key}
                onRequestDelete={() => setConfirmDelete(key)}
                onCancelDelete={() => setConfirmDelete(null)}
                onConfirmDelete={() => handleDeleteList(key)}
              >
                <DroppableMiniGrid
                  items={localGrouped[key] ?? []}
                  listType={key}
                  isDragActive={activeItem !== null}
                  isEditing={editingList === key}
                  emptyText="Cette liste est vide."
                  onRemove={handleRemoveItem}
                />
              </Section>
            ))}

            <DragOverlay>
              <GhostPoster item={activeItem} />
            </DragOverlay>
          </DndContext>

          {/* Recommandations */}
          <Section
            title="Recommandations"
            isEditing={false}
            onToggleEdit={() => {}}
            canDelete={false}
            showEditButton={false}
          >
            {recommendations.length === 0 ? (
              <p className="text-[var(--text-muted)] text-xs">Marquez des médias comme &quot;Déjà vu&quot; pour recevoir des recommandations.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {recommendations.map(media => (
                  <Link
                    key={media.id}
                    href={`/media/${media.media_type ?? 'movie'}-${media.id}`}
                    className="relative w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors shrink-0"
                    title={getTitle(media)}
                  >
                    {media.poster_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w200${media.poster_path}`}
                        alt={getTitle(media)}
                        fill
                        sizes="(min-width: 640px) 96px, 80px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </main>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
  isEditing: boolean
  onToggleEdit: () => void
  canDelete: boolean
  confirmingDelete?: boolean
  onRequestDelete?: () => void
  onCancelDelete?: () => void
  onConfirmDelete?: () => void
  showEditButton?: boolean
}

function Section({
  title,
  children,
  isEditing,
  onToggleEdit,
  canDelete,
  confirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  showEditButton = true,
}: SectionProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="mb-8">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isEditing ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
        <h2 className="text-[var(--text)] text-lg md:text-xl font-semibold">{title}</h2>
        {showEditButton && (
          <div className="flex items-center gap-3">
            {isEditing && canDelete && (
              <button
                onClick={onRequestDelete}
                className="text-red-400 text-xs hover:text-red-300 transition-colors"
              >
                Supprimer la liste
              </button>
            )}
            <button
              onClick={onToggleEdit}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, color 0.15s ease',
                borderColor: isEditing ? 'var(--accent)' : hovered ? '#888' : 'var(--border)',
                color: hovered || isEditing ? 'var(--text)' : 'var(--text-muted)',
              }}
              className="text-sm border px-3 py-1.5 rounded"
            >
              {isEditing ? 'Terminer' : 'Modifier'}
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div className="mb-3 bg-[var(--surface)] border border-red-500/40 rounded-lg px-4 py-3 text-sm text-[var(--text)]">
          <p className="mb-2">Supprimer cette liste et tous ses films ?</p>
          <div className="flex gap-3">
            <button
              onClick={onConfirmDelete}
              className="bg-red-500 text-white text-xs px-3 py-1.5 rounded hover:bg-red-600 transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={onCancelDelete}
              className="text-[var(--text-muted)] text-xs px-3 py-1.5 hover:text-[var(--text)] transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

