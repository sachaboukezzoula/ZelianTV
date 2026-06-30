'use client'

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getTitle, type Media, type MediaType } from '@/lib/tmdb'
import Image from 'next/image'
import { removeFromList, reorderItems, moveToList, toggleWatchlist } from '@/app/actions/watchlist'
import { createList } from '@/app/actions/lists'
import type { ListEntity } from '@/app/actions/lists'
import { likeMedia, toggleLike } from '@/app/actions/likes'
import { useTheme } from '@/components/ThemeProvider'
import { uploadProfileAvatarAction } from '@/app/actions/avatar'
import { changeEmailAction } from '@/app/actions/profile'
import type { Profile } from '@/app/actions/profiles'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { MediaListItem } from './DndMedia'
import { DroppableMiniGrid, GhostPoster } from './DndMedia'
import { ListFolderCard } from './ListFolderCard'
import { ListDetailModal } from './ListDetailModal'
import { StatsTab } from './StatsTab'

export interface FeaturedFilm {
  tmdb_id: number
  media_type: string
  title: string
  backdropUrl: string | null
  rating: string | null
  year: string | null
  genre: string | null
  runtime: string | null
  overview: string
}

export interface LikedItem {
  tmdb_id: number
  media_type: string
  poster_path: string | null
  title: string
  overview: string | null
  vote_average: number | null
  year: string | null
}

interface Props {
  user: User
  lists: MediaListItem[]
  preferredGenres: number[]
  recommendations: Media[]
  activeProfile: Profile | null
  featured?: FeaturedFilm | null
  avgRating?: string | null
  likedItems?: LikedItem[]
  customLists?: ListEntity[]
}

const FIXED_ORDER = ['watchlist', 'watched']
const FIXED_LABELS: Record<string, string> = {
  watchlist: 'À voir',
  watched: 'Déjà vu',
}

function listLabel(listType: string): string {
  return FIXED_LABELS[listType] ?? listType
}

function getInitials(name: string): string {
  if (!name) return '?'
  if (name.includes('@')) return name[0].toUpperCase()
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AMBIENT_PARTICLES = [
  { x: 8,  dur: 7.2, delay: 0,   cv: '--accent',   size: 2,   drift: 14  },
  { x: 16, dur: 5.8, delay: 1.3, cv: '--accent-2', size: 1.5, drift: -9  },
  { x: 24, dur: 8.1, delay: 0.5, cv: '--accent',   size: 2.5, drift: 7   },
  { x: 33, dur: 6.4, delay: 2.1, cv: '--accent-2', size: 1,   drift: -12 },
  { x: 41, dur: 9.0, delay: 0,   cv: '--accent',   size: 2,   drift: 5   },
  { x: 49, dur: 6.7, delay: 1.7, cv: '--accent-2', size: 1.5, drift: -6  },
  { x: 57, dur: 5.3, delay: 3.0, cv: '--accent',   size: 1,   drift: 11  },
  { x: 65, dur: 7.8, delay: 0.8, cv: '--accent-2', size: 2,   drift: -8  },
  { x: 73, dur: 8.6, delay: 1.5, cv: '--accent',   size: 1.5, drift: 15  },
  { x: 81, dur: 6.1, delay: 2.5, cv: '--accent-2', size: 2,   drift: -4  },
  { x: 89, dur: 5.7, delay: 0.3, cv: '--accent',   size: 1,   drift: 9   },
  { x: 12, dur: 9.2, delay: 4.0, cv: '--accent-2', size: 1,   drift: -13 },
  { x: 35, dur: 7.1, delay: 3.5, cv: '--accent',   size: 2,   drift: 6   },
  { x: 68, dur: 5.2, delay: 2.8, cv: '--accent-2', size: 1.5, drift: -10 },
  { x: 45, dur: 8.3, delay: 1.0, cv: '--accent',   size: 1,   drift: 3   },
  { x: 93, dur: 6.9, delay: 0.6, cv: '--accent-2', size: 1.5, drift: -7  },
  { x: 3,  dur: 7.4, delay: 2.2, cv: '--accent',   size: 2,   drift: 12  },
  { x: 77, dur: 5.9, delay: 1.1, cv: '--accent-2', size: 1,   drift: -5  },
]

const GATHER_PARTICLES = [
  { angle: 0,   dist: 75, dur: 0.75, delay: 0,    cv: '--accent',   size: 3   },
  { angle: 45,  dist: 60, dur: 0.60, delay: 0.10, cv: '--accent-2', size: 2.5 },
  { angle: 90,  dist: 85, dur: 0.85, delay: 0.05, cv: '--accent',   size: 3   },
  { angle: 135, dist: 65, dur: 0.65, delay: 0.15, cv: '--accent-2', size: 2   },
  { angle: 180, dist: 80, dur: 0.80, delay: 0.08, cv: '--accent',   size: 3   },
  { angle: 225, dist: 55, dur: 0.70, delay: 0.12, cv: '--accent-2', size: 2.5 },
  { angle: 270, dist: 70, dur: 0.80, delay: 0.02, cv: '--accent',   size: 2   },
  { angle: 315, dist: 50, dur: 0.60, delay: 0.18, cv: '--accent-2', size: 3   },
]

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

// Clé spéciale pour la zone « Coups de cœur » dans le DnD de la galerie
const LIKED_KEY = '__liked__'

// Zone de dépôt « Coups de cœur » (droppable). Les films lâchés ici sont likés.
function LikedDropZone({ isDragActive, isOverHint, children }: { isDragActive: boolean; isOverHint: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: LIKED_KEY, data: { listType: LIKED_KEY } })
  const highlight = isDragActive && (isOver || isOverHint)
  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 14,
        padding: isDragActive ? 12 : 0,
        transition: 'box-shadow .2s ease, background .2s ease, padding .15s ease',
        boxShadow: highlight
          ? 'inset 0 0 0 2px #ff6b6b, 0 0 30px rgba(255,107,107,.25)'
          : isDragActive ? 'inset 0 0 0 1.5px rgba(255,107,107,.35)' : 'none',
        background: highlight ? 'rgba(255,107,107,.07)' : 'transparent',
      }}
    >
      {isDragActive && (
        <div style={{ fontSize: 12, color: '#ff6b6b', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="#ff6b6b"><path d="M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.3a2.7 2.7 0 015.5 1.9C13.5 10 8 13.5 8 13.5z" /></svg>
          Déposez ici pour aimer
        </div>
      )}
      {children}
    </div>
  )
}

// Carte likée (draggable vers une liste) + overlay note/titre/synopsis + retrait en mode édition
function LikedDraggableCard({ m, editMode, onRemove }: { m: LikedItem; editMode: boolean; onRemove: (m: LikedItem) => void }) {
  const id = `liked-${m.media_type}-${m.tmdb_id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { listType: LIKED_KEY, liked: m } })
  const voteLabel = m.vote_average != null && m.vote_average > 0 ? m.vote_average.toFixed(1) : null
  return (
    <div ref={setNodeRef} style={{ width: 132, flexShrink: 0, position: 'relative', opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      <Link
        href={`/media/${m.media_type}-${m.tmdb_id}`}
        title={m.title}
        onClick={editMode || isDragging ? (e) => e.preventDefault() : undefined}
        draggable={false}
        className="gal-poster relative block w-full aspect-[2/3] rounded-[11px] overflow-hidden cursor-grab select-none"
        style={{ boxShadow: '0 8px 20px rgba(0,0,0,.4)', background: 'linear-gradient(160deg,#10131c,#1a2030)', touchAction: 'none' }}
      >
        {m.poster_path && <Image src={`https://image.tmdb.org/t/p/w342${m.poster_path}`} alt={m.title} fill sizes="132px" className="object-cover" draggable={false} />}
        <div style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(10,10,12,.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="#ff6b6b"><path d="M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.3a2.7 2.7 0 015.5 1.9C13.5 10 8 13.5 8 13.5z" /></svg>
        </div>
        {/* Trait rouge en bas (signature « coups de cœur ») */}
        <div className="absolute left-0 right-0 bottom-0 h-[3px] pointer-events-none" style={{ background: '#ff6b6b', zIndex: 2 }} />
        <div className="gal-ov absolute inset-0 flex flex-col p-3" style={{ background: 'linear-gradient(0deg,rgba(8,8,10,.98),rgba(8,8,10,.72))' }}>
          {voteLabel && <div className="text-[11px] font-semibold" style={{ color: 'var(--accent-2)' }}>★ {voteLabel}</div>}
          <div className="gal-display line-clamp-2" style={{ fontSize: 16, lineHeight: 1.04, marginTop: 6 }}>{m.title}</div>
          {m.overview ? (
            <div className="mt-1.5 overflow-hidden" style={{ fontSize: 10.5, lineHeight: 1.4, color: 'rgba(243,241,238,.72)', flex: '1 1 auto', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>{m.overview}</div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center justify-center gap-1.5 mt-2" style={{ height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: '#0a0a0c' }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>
            Voir la fiche
          </div>
        </div>
      </Link>
      <div style={{ marginTop: 10 }}>
        <div className="gal-display line-clamp-1" style={{ fontSize: 14.5, letterSpacing: '.02em', textTransform: 'uppercase' }}>{m.title}</div>
        <div style={{ fontSize: 11, color: 'rgba(243,241,238,.5)', marginTop: 2 }}>{[m.year, m.media_type === 'tv' ? 'Série' : 'Film'].filter(Boolean).join(' · ')}</div>
      </div>
      {editMode && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(m) }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Retirer des coups de cœur"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold z-30 shadow-lg"
          style={{ background: '#e05252', border: 'none', cursor: 'pointer' }}
        >×</button>
      )}
    </div>
  )
}

export function ProfileClient({ user, lists, preferredGenres: _preferredGenres, recommendations, activeProfile, featured = null, avgRating = null, likedItems = [], customLists = [] }: Props) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [editingList, setEditingList] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)
  const [tab, setTab] = useState<'galerie' | 'statistiques' | 'parametres'>('galerie')

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

  const avatarUrl = activeProfile?.avatar_url ?? undefined
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
    if (!file || !activeProfile) return
    e.target.value = ''
    setAvatarLoading(true)
    setActionError(null)
    try {
      const compressed = await compressImage(file, 400, 0.85)
      const formData = new FormData()
      formData.append('file', new File([compressed], 'avatar.jpg', { type: 'image/jpeg' }))
      const result = await uploadProfileAvatarAction(formData, activeProfile.id)
      if ('error' in result) throw new Error(result.error)
      // uploadProfileAvatarAction persiste déjà l'URL dans profiles.avatar_url
      // (source de vérité lue par le picker, le navbar et cet onglet)
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


  const [localGrouped, setLocalGrouped] = useState<Record<string, MediaListItem[]>>(
    () => lists.reduce((acc, item) => {
      if (!acc[item.list_type]) acc[item.list_type] = []
      acc[item.list_type].push(item)
      return acc
    }, {} as Record<string, MediaListItem[]>)
  )
  const [activeItem, setActiveItem] = useState<MediaListItem | null>(null)
  const [overListType, setOverListType] = useState<string | null>(null)
  const [localLiked, setLocalLiked] = useState<LikedItem[]>(likedItems)
  const [likedEditMode, setLikedEditMode] = useState(false)

  useEffect(() => {
    setLocalGrouped(
      lists.reduce((acc, item) => {
        if (!acc[item.list_type]) acc[item.list_type] = []
        acc[item.list_type].push(item)
        return acc
      }, {} as Record<string, MediaListItem[]>)
    )
  }, [lists])

  useEffect(() => { setLocalLiked(likedItems) }, [likedItems])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const watchedCount = (localGrouped['watched'] ?? []).length
  const watchlistCount = (localGrouped['watchlist'] ?? []).length
  const totalMedia = Object.values(localGrouped).reduce((sum, arr) => sum + arr.length, 0)
  const customKeys = useMemo(
    () => Object.keys(localGrouped).filter(k => !FIXED_ORDER.includes(k)),
    [localGrouped]
  )

  const coverByName = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const l of customLists) m[l.name] = l.cover_url
    return m
  }, [customLists])

  // Listes perso créées dans la galerie mais encore vides (pas de ligne en base tant qu'on n'y glisse rien)
  const [pendingLists, setPendingLists] = useState<string[]>([])
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListHover, setNewListHover] = useState(false)
  const [openedList, setOpenedList] = useState<string | null>(null)

  const allCustomKeys = useMemo(
    () => [...new Set([...customLists.map(l => l.name), ...customKeys, ...pendingLists])],
    [customLists, customKeys, pendingLists]
  )

  async function submitNewList() {
    const name = newListName.trim()
    setNewListName('')
    setCreatingList(false)
    if (!name) return
    const reserved = ['à voir', 'déjà vu', 'watchlist', 'watched']
    const taken = reserved.includes(name.toLowerCase()) || allCustomKeys.some(k => k.toLowerCase() === name.toLowerCase())
    if (taken) return
    setPendingLists(prev => [...prev, name]) // optimiste
    const res = await createList(name) // persiste (ou reste en local si la table n'existe pas encore)
    if (!('error' in res)) router.refresh()
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    const listType = event.active.data.current?.listType as string
    if (listType === LIKED_KEY) {
      const liked = event.active.data.current?.liked as LikedItem | undefined
      setActiveItem(liked ? {
        id, tmdb_id: liked.tmdb_id, media_type: liked.media_type, list_type: LIKED_KEY,
        rating: null, poster_path: liked.poster_path, title: liked.title,
        overview: liked.overview, vote_average: liked.vote_average, year: liked.year, sort_order: 0,
      } : null)
      setOverListType(null)
      return
    }
    const item = (localGrouped[listType] ?? []).find(i => i.id === id) ?? null
    setActiveItem(item)
    setOverListType(null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) { setOverListType(null); return }
    const lt = (over.data.current?.listType as string | undefined) ?? String(over.id)
    setOverListType(lt)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    setOverListType(null)
    if (!over) return

    const activeId = String(active.id)
    const activeListType = active.data.current?.listType as string
    const overListType = (over.data.current?.listType as string | undefined) ?? String(over.id)

    // ── Coups de cœur (likes, indépendant des listes) ──
    if (overListType === LIKED_KEY || activeListType === LIKED_KEY) {
      if (activeListType === LIKED_KEY && overListType === LIKED_KEY) return

      if (overListType === LIKED_KEY) {
        // liste → Coups de cœur : on aime (le film reste dans sa liste)
        const item = (localGrouped[activeListType] ?? []).find(i => i.id === activeId)
        if (!item) return
        if (!localLiked.some(l => l.tmdb_id === item.tmdb_id && l.media_type === item.media_type)) {
          setLocalLiked(prev => [{
            tmdb_id: item.tmdb_id, media_type: item.media_type, poster_path: item.poster_path ?? null,
            title: item.title ?? '', overview: item.overview ?? null,
            vote_average: item.vote_average ?? null, year: item.year ?? null,
          }, ...prev])
        }
        likeMedia(item.tmdb_id, item.media_type as MediaType).then(() => router.refresh())
      } else {
        // Coups de cœur → liste : on ajoute à la liste (le film reste liké)
        const liked = active.data.current?.liked as LikedItem | undefined
        if (!liked) return
        toggleWatchlist(liked.tmdb_id, liked.media_type as MediaType, overListType, null, liked.poster_path, liked.title)
          .then(() => router.refresh())
      }
      return
    }

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

  function handleRemoveLiked(m: LikedItem) {
    setLocalLiked(prev => prev.filter(l => !(l.tmdb_id === m.tmdb_id && l.media_type === m.media_type)))
    toggleLike(m.tmdb_id, m.media_type as MediaType)
  }

  const editTitles = { pseudo: 'Modifier le pseudo', email: "Modifier l'adresse mail", password: 'Changer le mot de passe' }

  return (
    <div
      className="max-w-6xl mx-auto px-4 md:px-8 pb-8"
      style={{ marginTop: -56, paddingTop: 88, background: tab === 'parametres' ? 'radial-gradient(ellipse at 50% 0%, var(--accent-glow-md) 0%, transparent 58%)' : 'radial-gradient(ellipse 65% 200px at 50% 0%, var(--accent-glow-sm) 0%, transparent 80%)' }}
    >

      {/* Tab navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: 32 }}>
        <div style={{ display: 'flex', marginBottom: -1 }}>
          {(['galerie', 'statistiques', 'parametres'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab !== t ? 'gal-tab' : undefined}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              {t === 'galerie' ? 'Ma Galerie' : t === 'statistiques' ? 'Statistiques' : 'Paramètres'}
            </button>
          ))}
        </div>
        <Link href="/profils" className="gal-link hidden md:block" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'none' }}>
          ← Changer de profil
        </Link>
      </div>

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
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: formLoading ? 'default' : 'pointer', opacity: formLoading || !formValue.trim() ? 0.6 : 1 }}
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

      {/* ─── Tab: Ma Galerie ─── */}
      {tab === 'galerie' && (
        <div className="gal-body" style={{ position: 'relative' }}>
          {/* Halo d'accent ambiant */}
          <div aria-hidden style={{ position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)', width: 1100, height: 440, maxWidth: '100%', background: 'radial-gradient(ellipse at center, var(--accent-glow-md), transparent 65%)', pointerEvents: 'none', animation: 'gal-glow-breathe 9s ease-in-out infinite', zIndex: 0 }} />

          <div style={{ position: 'relative', zIndex: 1 }}>

            {/* ── HÉRO : à voir ensuite ── */}
            {featured && (
              <div style={{ position: 'relative', minHeight: 'clamp(300px, 42vw, 420px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 18, overflow: 'hidden', marginBottom: 6, border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
                {featured.backdropUrl ? (
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featured.backdropUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', animation: 'gal-kenburns 12s ease-in-out infinite alternate' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg,#10131c,#1a2030)' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(10,10,12,.96) 0%,rgba(10,10,12,.72) 40%,rgba(10,10,12,.15) 72%,transparent 100%)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(10,10,12,.88) 0%,transparent 46%)' }} />
                <div style={{ position: 'absolute', left: '58%', top: '50%', width: 340, height: 340, transform: 'translateY(-50%)', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow-md), transparent 65%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, padding: 'clamp(24px, 7vw, 44px) clamp(20px, 4vw, 48px) clamp(22px, 4vw, 40px)', animation: 'gal-fade-up .7s ease both' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', animation: 'gal-kicker 3s ease-in-out infinite' }}>
                    <span style={{ width: 22, height: 1, background: 'var(--accent)' }} />À voir ensuite
                  </div>
                  <div className="gal-display line-clamp-2" style={{ fontSize: 'clamp(34px, 5.2vw, 58px)', lineHeight: .96, letterSpacing: '.02em', marginTop: 10, textShadow: '0 4px 30px rgba(0,0,0,.6)' }}>{featured.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 13, fontSize: 13, color: 'rgba(243,241,238,.66)', flexWrap: 'wrap' }}>
                    {featured.rating && <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>★ {featured.rating}</span>}
                    {featured.year && <><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(243,241,238,.3)' }} /><span>{featured.year}</span></>}
                    {featured.genre && <><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(243,241,238,.3)' }} /><span>{featured.genre}</span></>}
                    {featured.runtime && <><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(243,241,238,.3)' }} /><span>{featured.runtime}</span></>}
                  </div>
                  {featured.overview && <div className="line-clamp-2" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgba(243,241,238,.78)', marginTop: 12, maxWidth: 470 }}>{featured.overview}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                    <Link className="gal-btn-primary" href={`/media/${featured.media_type}-${featured.tmdb_id}`} style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 9, height: 48, padding: '0 26px', background: 'var(--accent)', color: '#0a0a0c', borderRadius: 8, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 26px var(--accent-glow)', textDecoration: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>Bande-annonce
                      <span className="gal-sheen" />
                    </Link>
                    <Link className="gal-btn-ghost" href={`/media/${featured.media_type}-${featured.tmdb_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 22px', background: 'rgba(255,255,255,.1)', color: '#f3f1ee', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: 'none', backdropFilter: 'blur(6px)' }}>Voir la fiche</Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── STATS ── */}
            <div style={{ display: 'flex', gap: 14, marginTop: featured ? 24 : 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderRadius: 14, background: 'linear-gradient(145deg, var(--accent-glow-sm), rgba(255,255,255,.02))', border: '1px solid var(--accent-glow-md)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-glow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l2.5 2.5 6-6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div><div className="gal-display" style={{ fontSize: 36, lineHeight: .9, color: 'var(--accent)' }}>{watchedCount}</div><div style={{ fontSize: 13, color: 'rgba(243,241,238,.55)', marginTop: 3 }}>{watchedCount > 1 ? 'Films vus' : 'Film vu'}</div></div>
              </div>
              <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M3 4l10 4-10 4z" fill="rgba(243,241,238,.7)" /></svg>
                </div>
                <div><div className="gal-display" style={{ fontSize: 36, lineHeight: .9 }}>{watchlistCount}</div><div style={{ fontSize: 13, color: 'rgba(243,241,238,.55)', marginTop: 3 }}>À voir</div></div>
              </div>
              <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {avgRating ? (
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="rgba(243,241,238,.7)"><path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.8 4.2 13.3l.7-4.3-3.1-3 4.3-.6z" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="rgba(243,241,238,.7)" strokeWidth="1.5" /><path d="M8 5v3l2 1.5" stroke="rgba(243,241,238,.7)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  )}
                </div>
                <div><div className="gal-display" style={{ fontSize: 36, lineHeight: .9 }}>{avgRating ? `★ ${avgRating}` : totalMedia}</div><div style={{ fontSize: 13, color: 'rgba(243,241,238,.55)', marginTop: 3 }}>{avgRating ? 'Note moyenne' : 'Médias au total'}</div></div>
              </div>
            </div>

            {/* ── Hint déplacement ── */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 26, padding: '8px 15px', borderRadius: 20, background: 'var(--accent-glow-sm)', border: '1px solid var(--accent-glow-md)' }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M8 2L5.5 4.5M8 2l2.5 2.5M8 14l-2.5-2.5M8 14l2.5-2.5" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span style={{ fontSize: 12.5, color: 'rgba(243,241,238,.7)' }}>Maintenez un poster appuyé pour le <b style={{ color: 'var(--accent-2)', fontWeight: 600 }}>déplacer entre vos listes</b></span>
            </div>

            {actionError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                {actionError}
              </div>
            )}

            {/* ── Listes (DnD) ── */}
            <div style={{ marginTop: 22 }}>
              <DndContext
                id="galerie-lists"
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                {FIXED_ORDER.map(key => (
                  <Section
                    key={key}
                    title={listLabel(key)}
                    count={(localGrouped[key] ?? []).length}
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
                      isOverList={overListType === key}
                      isEditing={editingList === key}
                      emptyText={
                        key === 'watchlist'
                          ? 'Déposez un film à voir ici'
                          : 'Déposez ici les films que vous avez vus'
                      }
                      onRemove={handleRemoveItem}
                    />
                  </Section>
                ))}

                {/* ── MES LISTES (cartes-dossiers) ── */}
                <div style={{ marginTop: 30 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                    <span className="gal-display text-[26px] sm:text-[28px]" style={{ letterSpacing: '.04em', lineHeight: 1 }}>Mes listes</span>
                    {allCustomKeys.length > 0 && <span style={{ fontSize: 15, color: 'rgba(243,241,238,.4)', marginLeft: 10 }}>{allCustomKeys.length}</span>}
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => setCreatingList(true)}
                      onMouseEnter={() => setNewListHover(true)}
                      onMouseLeave={() => setNewListHover(false)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600,
                        border: `1px solid ${newListHover ? 'var(--accent)' : 'rgba(255,255,255,.16)'}`,
                        background: 'transparent', color: newListHover ? 'var(--accent)' : 'rgba(243,241,238,.7)',
                        transition: 'all .15s ease',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                      Nouvelle liste
                    </button>
                  </div>

                  {creatingList && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 460, flexWrap: 'wrap', marginBottom: 16 }}>
                      <input
                        autoFocus
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitNewList()
                          if (e.key === 'Escape') { setCreatingList(false); setNewListName('') }
                        }}
                        placeholder="Nom de la liste…"
                        maxLength={40}
                        style={{ flex: '1 1 200px', height: 44, background: 'rgba(255,255,255,.04)', border: '1px solid var(--accent-glow)', borderRadius: 10, padding: '0 16px', color: '#f3f1ee', fontSize: 14, outline: 'none' }}
                      />
                      <button onClick={submitNewList} disabled={!newListName.trim()} style={{ height: 44, padding: '0 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#0a0a0c', fontSize: 13.5, fontWeight: 700, cursor: newListName.trim() ? 'pointer' : 'default', opacity: newListName.trim() ? 1 : 0.5 }}>Créer</button>
                      <button onClick={() => { setCreatingList(false); setNewListName('') }} style={{ height: 44, padding: '0 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.16)', background: 'transparent', color: 'rgba(243,241,238,.7)', fontSize: 13.5, cursor: 'pointer' }}>Annuler</button>
                    </div>
                  )}

                  <div className="no-scrollbar" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 2px 12px' }}>
                    {allCustomKeys.map(key => (
                      <div key={key} style={{ width: 260, flexShrink: 0 }}>
                        <ListFolderCard
                          listKey={key}
                          items={localGrouped[key] ?? []}
                          cover={coverByName[key] ?? null}
                          isDragActive={activeItem !== null}
                          onOpen={() => setOpenedList(key)}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setCreatingList(true)}
                      style={{ width: 260, flexShrink: 0, height: 168, borderRadius: 14, border: '1.5px dashed rgba(255,255,255,.16)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(243,241,238,.6)', transition: 'border-color .15s ease, color .15s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.16)'; e.currentTarget.style.color = 'rgba(243,241,238,.6)' }}
                    >
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--accent-glow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" /></svg>
                      </div>
                      <div className="gal-display" style={{ fontSize: 17, color: '#f3f1ee', letterSpacing: '.03em' }}>Créer une liste</div>
                      <div style={{ fontSize: 11.5, color: 'rgba(243,241,238,.45)' }}>Organisez vos films</div>
                    </button>
                  </div>
                </div>

                {/* ── Coups de cœur (❤) — likes + zone de dépôt DnD ── */}
                <div style={{ marginTop: 30 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span className="gal-display text-[26px] sm:text-[28px]" style={{ letterSpacing: '.04em', lineHeight: 1 }}>Coups de cœur</span>
                    {localLiked.length > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#ff6b6b', fontWeight: 600 }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="#ff6b6b"><path d="M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.3a2.7 2.7 0 015.5 1.9C13.5 10 8 13.5 8 13.5z" /></svg>
                        {localLiked.length} film{localLiked.length > 1 ? 's' : ''} liké{localLiked.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    {localLiked.length > 0 && (
                      <button onClick={() => setLikedEditMode(e => !e)} style={{ height: 34, padding: '0 13px', borderRadius: 8, border: likedEditMode ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,.16)', background: likedEditMode ? 'var(--accent-glow-sm)' : 'transparent', color: likedEditMode ? 'var(--accent-2)' : 'rgba(243,241,238,.7)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                        {likedEditMode ? 'Terminer' : 'Modifier'}
                      </button>
                    )}
                  </div>
                  <LikedDropZone isDragActive={activeItem !== null} isOverHint={overListType === LIKED_KEY}>
                    {localLiked.length === 0 ? (
                      <p className="text-[var(--text-muted)] text-[13px]" style={{ padding: '6px 0' }}>Cliquez sur le ❤ d&apos;une fiche, ou glissez un poster ici pour l&apos;ajouter à vos coups de cœur.</p>
                    ) : (
                      <div className="no-scrollbar" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0 10px' }}>
                        {localLiked.map(m => (
                          <LikedDraggableCard key={`${m.media_type}-${m.tmdb_id}`} m={m} editMode={likedEditMode} onRemove={handleRemoveLiked} />
                        ))}
                      </div>
                    )}
                  </LikedDropZone>
                </div>

                <DragOverlay>
                  <GhostPoster item={activeItem} />
                </DragOverlay>
              </DndContext>
            </div>

            {/* ── Recommandations ── */}
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                <span className="gal-display text-[26px] sm:text-[28px]" style={{ letterSpacing: '.04em', lineHeight: 1 }}>Recommandations</span>
                {recommendations.length > 0 && <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 12, fontWeight: 600 }}>Pour vous</span>}
              </div>
              {recommendations.length === 0 ? (
                <p className="text-[var(--text-muted)] text-[13px]">Marquez des médias comme « Déjà vu » pour recevoir des recommandations.</p>
              ) : (
                <div className="no-scrollbar" style={{ display: 'flex', gap: 13, overflowX: 'auto', padding: '4px 0 10px' }}>
                  {recommendations.map(media => (
                    <Link
                      key={media.id}
                      href={`/media/${media.media_type ?? 'movie'}-${media.id}`}
                      title={getTitle(media)}
                      className="gal-poster relative block w-[122px] sm:w-[138px] aspect-[2/3] rounded-lg overflow-hidden shrink-0"
                      style={{ boxShadow: '0 8px 20px rgba(0,0,0,.4)', background: 'linear-gradient(160deg,#10131c,#1a2030)' }}
                    >
                      {media.poster_path && (
                        <Image
                          src={`https://image.tmdb.org/t/p/w342${media.poster_path}`}
                          alt={getTitle(media)}
                          fill
                          sizes="(min-width: 640px) 138px, 122px"
                          className="object-cover"
                        />
                      )}
                      {/* Overlay survol : note + titre + synopsis + CTA (comme les cartes de listes) */}
                      <div className="gal-ov absolute inset-0 flex flex-col p-3" style={{ background: 'linear-gradient(0deg,rgba(8,8,10,.98),rgba(8,8,10,.72))' }}>
                        {media.vote_average ? (
                          <div className="text-[10px] font-semibold" style={{ color: 'var(--accent-2)' }}>★ {media.vote_average.toFixed(1)}</div>
                        ) : null}
                        <div className="gal-display text-[15px] leading-none mt-1 line-clamp-2">{getTitle(media)}</div>
                        {media.overview ? (
                          <div className="text-[10px] leading-[1.4] mt-1.5 overflow-hidden" style={{ color: 'rgba(243,241,238,.72)', flex: '1 1 auto', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>{media.overview}</div>
                        ) : (
                          <div className="flex-1" />
                        )}
                        <div className="flex items-center justify-center gap-1.5 h-[28px] rounded-md text-[11px] font-bold mt-2" style={{ background: 'var(--accent)', color: '#0a0a0c' }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>
                          Voir la fiche
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* ── Modale d'ouverture d'une liste ── */}
            {openedList && (
              <ListDetailModal
                listName={openedList}
                items={localGrouped[openedList] ?? []}
                otherLists={[
                  ...FIXED_ORDER.map(k => ({ key: k, label: listLabel(k) })),
                  { key: '__liked__', label: '❤ Aimés' },
                  ...allCustomKeys.filter(k => k !== openedList).map(k => ({ key: k, label: k })),
                ]}
                onClose={() => setOpenedList(null)}
                onRefresh={() => router.refresh()}
                onRenamed={(n) => setOpenedList(n)}
              />
            )}

          </div>
        </div>
      )}

      {/* ─── Tab: Statistiques ─── */}
      {tab === 'statistiques' && (
        <StatsTab pseudo={activeProfile?.name ?? ''} profileId={activeProfile?.id ?? ''} />
      )}

      {/* ─── Tab: Paramètres ─── */}
      {tab === 'parametres' && (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          {/* CSS Keyframes pour les particules */}
          <style>{`
            @keyframes zelian-particle-rise {
              0%   { transform: translateY(0)      translateX(0);           opacity: 0; }
              8%   {                                                          opacity: 1; }
              90%  {                                                          opacity: 0.6; }
              100% { transform: translateY(-600px) translateX(var(--drift)); opacity: 0; }
            }
            @keyframes zelian-gather {
              0%   { transform: translate(var(--sx), var(--sy)) scale(2);   opacity: 0; }
              20%  {                                                          opacity: 1; }
              100% { transform: translate(0px, 0px) scale(0.2);             opacity: 0; }
            }
          `}</style>

          {/* Couche de particules ambiantes */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            {AMBIENT_PARTICLES.map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: `${p.x}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  borderRadius: '50%',
                  background: `var(${p.cv})`,
                  boxShadow: `0 0 ${p.size * 3}px var(${p.cv})`,
                  animation: `zelian-particle-rise ${p.dur}s ${p.delay}s ease-in-out infinite`,
                  '--drift': `${p.drift}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Contenu */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '56px 16px 72px',
            minHeight: 500,
          }}>
            {/* Avatar avec anneau lumineux */}
            <div
              style={{
                position: 'relative',
                width: 124,
                height: 124,
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: '0 0 0 3px var(--accent), 0 0 32px var(--accent-glow)',
                marginBottom: 22,
                flexShrink: 0,
                transition: 'box-shadow 0.2s ease',
              }}
              onMouseEnter={() => setAvatarHovered(true)}
              onMouseLeave={() => setAvatarHovered(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill sizes="124px" className="rounded-full object-cover" />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: activeProfile?.color ?? 'linear-gradient(145deg, #1e1a14 0%, #111 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '2.4rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  {activeProfile ? activeProfile.name[0].toUpperCase() : getInitials(displayName ?? user.email ?? '?')}
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
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                }
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Badge membre depuis */}
            <div style={{
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20,
              padding: '3px 16px',
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.16em',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              marginBottom: 18,
            }}>
              Membre depuis {new Date(user.created_at).getFullYear()}
            </div>

            {/* Nom en grand */}
            <h1 style={{
              fontSize: 'clamp(2.2rem, 8vw, 5rem)',
              fontWeight: 900,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#fff',
              margin: '0 0 22px',
              textAlign: 'center',
              lineHeight: 1.05,
              wordBreak: 'break-word',
            }}>
              {displayName ?? 'Mon profil'}
            </h1>

            {/* Pseudo + email avec boutons modifier */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 38 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem' }}>{displayName ?? '-'}</span>
                <button
                  onClick={() => openEdit('pseudo')}
                  onMouseEnter={() => setHoveredBtn('pseudo')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    border: `1px solid ${hoveredBtn === 'pseudo' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)'}`,
                    borderRadius: 4,
                    padding: '2px 10px',
                    fontSize: '0.58rem',
                    letterSpacing: '0.13em',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: hoveredBtn === 'pseudo' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                    background: hoveredBtn === 'pseudo' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    cursor: 'pointer',
                    boxShadow: hoveredBtn === 'pseudo' ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✎ Modifier
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.85rem' }}>{user.email}</span>
                <button
                  onClick={() => openEdit('email')}
                  onMouseEnter={() => setHoveredBtn('email')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    border: `1px solid ${hoveredBtn === 'email' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)'}`,
                    borderRadius: 4,
                    padding: '2px 10px',
                    fontSize: '0.58rem',
                    letterSpacing: '0.13em',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: hoveredBtn === 'email' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                    background: hoveredBtn === 'email' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    cursor: 'pointer',
                    boxShadow: hoveredBtn === 'email' ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✎ Modifier
                </button>
              </div>
            </div>

            {/* Séparateur ★ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
              <div style={{ width: 64, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>★</span>
              <div style={{ width: 64, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Sélecteur de thème */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 40 }}>
              <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', margin: 0 }}>
                Thème
              </p>
              <div style={{ display: 'flex', gap: 14 }}>
                {([
                  ['orange', '#f97316'] as const,
                  ['blue', '#3b82f6'] as const,
                  ['violet', '#8b5cf6'] as const,
                ]).map(([t, color]) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: color,
                      border: theme === t ? '3px solid rgba(255,255,255,0.85)' : '3px solid transparent',
                      outline: theme === t ? `2px solid ${color}` : 'none',
                      outlineOffset: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Boutons d'action avec particules de rassemblement */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                {hoveredBtn === 'pwd' && GATHER_PARTICLES.map((p, i) => {
                  const sx = Math.cos(p.angle * Math.PI / 180) * p.dist
                  const sy = Math.sin(p.angle * Math.PI / 180) * p.dist
                  return (
                    <div
                      key={i}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        borderRadius: '50%',
                        background: `var(${p.cv})`,
                        boxShadow: `0 0 ${p.size * 2}px var(${p.cv})`,
                        marginTop: `${-(p.size / 2)}px`,
                        marginLeft: `${-(p.size / 2)}px`,
                        animation: `zelian-gather ${p.dur}s ${p.delay}s ease-in infinite`,
                        '--sx': `${sx}px`,
                        '--sy': `${sy}px`,
                        pointerEvents: 'none',
                        zIndex: 10,
                      } as React.CSSProperties}
                    />
                  )
                })}
                <button
                  onClick={() => openEdit('password')}
                  onMouseEnter={() => setHoveredBtn('pwd')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    border: `1px solid ${hoveredBtn === 'pwd' ? 'var(--accent)' : 'var(--accent-glow)'}`,
                    borderRadius: 4,
                    padding: '16px 40px',
                    fontSize: '0.68rem',
                    letterSpacing: '0.14em',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: hoveredBtn === 'pwd' ? 'var(--accent)' : 'var(--accent-2)',
                    background: hoveredBtn === 'pwd' ? 'var(--accent-glow-sm)' : 'transparent',
                    cursor: 'pointer',
                    minWidth: 220,
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    zIndex: 1,
                    overflow: 'hidden',
                  }}
                >
                  Modifier le mot de passe
                  <span className="gal-sheen" />
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                {hoveredBtn === 'logout' && GATHER_PARTICLES.map((p, i) => {
                  const sx = Math.cos(p.angle * Math.PI / 180) * p.dist
                  const sy = Math.sin(p.angle * Math.PI / 180) * p.dist
                  return (
                    <div
                      key={i}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        borderRadius: '50%',
                        background: `var(${p.cv})`,
                        boxShadow: `0 0 ${p.size * 2}px var(${p.cv})`,
                        marginTop: `${-(p.size / 2)}px`,
                        marginLeft: `${-(p.size / 2)}px`,
                        animation: `zelian-gather ${p.dur}s ${p.delay}s ease-in infinite`,
                        '--sx': `${sx}px`,
                        '--sy': `${sy}px`,
                        pointerEvents: 'none',
                        zIndex: 10,
                      } as React.CSSProperties}
                    />
                  )
                })}
                <button
                  onClick={logout}
                  onMouseEnter={() => setHoveredBtn('logout')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    border: `1px solid ${hoveredBtn === 'logout' ? '#ef4444' : '#c82020'}`,
                    borderRadius: 4,
                    padding: '16px 40px',
                    fontSize: '0.68rem',
                    letterSpacing: '0.14em',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#fff',
                    background: hoveredBtn === 'logout' ? '#ef4444' : '#c82020',
                    cursor: 'pointer',
                    minWidth: 220,
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    zIndex: 1,
                    overflow: 'hidden',
                  }}
                >
                  Se déconnecter
                  <span className="gal-sheen" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  count?: number
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
  count,
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
    <div className="mb-6">
      <div className="flex items-center mb-3.5">
        <span className="gal-display text-[26px] sm:text-[28px] tracking-wide leading-none">{title}</span>
        {count !== undefined && <span className="text-[15px] text-white/40 ml-2.5">{count}</span>}
        <div className="flex-1" />
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
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 14px',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 6,
                fontSize: 12,
                border: `1px solid ${isEditing || hovered ? 'var(--accent)' : 'rgba(255,255,255,.16)'}`,
                color: isEditing || hovered ? 'var(--accent)' : 'rgba(243,241,238,.6)',
                transition: 'border-color 0.15s ease, color 0.15s ease',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M11 3l2 2-7 7H4v-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
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
