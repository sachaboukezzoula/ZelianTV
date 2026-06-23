'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getTitle, type Media } from '@/lib/tmdb'
import Image from 'next/image'
import { removeFromList, deleteList } from '@/app/actions/watchlist'

interface MediaListItem {
  id: string
  tmdb_id: number
  media_type: string
  list_type: string
  rating: number | null
  poster_path: string | null
  title: string | null
}

interface Props {
  user: User
  lists: MediaListItem[]
  preferredGenres: number[]
  recommendations: Media[]
}

const FIXED_ORDER = ['watchlist', 'watched']
const FIXED_LABELS: Record<string, string> = {
  watchlist: 'À voir',
  watched: 'Déjà vu',
}

function listLabel(listType: string): string {
  return FIXED_LABELS[listType] ?? listType
}

export function ProfileClient({ user, lists, preferredGenres: _preferredGenres, recommendations }: Props) {
  const router = useRouter()
  const [editingList, setEditingList] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  async function handleRemoveItem(id: string) {
    await removeFromList(id)
    router.refresh()
  }

  async function handleDeleteList(listType: string) {
    await deleteList(listType)
    setEditingList(null)
    setConfirmDelete(null)
    router.refresh()
  }

  const grouped = lists.reduce((acc, item) => {
    if (!acc[item.list_type]) acc[item.list_type] = []
    acc[item.list_type].push(item)
    return acc
  }, {} as Record<string, MediaListItem[]>)

  const watchedCount = (grouped['watched'] ?? []).length
  const watchlistCount = (grouped['watchlist'] ?? []).length
  const customKeys = Object.keys(grouped).filter(k => !FIXED_ORDER.includes(k))

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar */}
        <aside className="md:w-56 shrink-0">
          <div className="md:sticky md:top-20 space-y-6">
            {/* Avatar + infos */}
            <div className="flex md:flex-col items-center md:items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] font-semibold text-xl shrink-0">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[var(--text)] text-sm font-medium">Mon profil</p>
                <p className="text-[var(--text-muted)] text-xs truncate">{user.email}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              <div className="bg-[var(--navbar)] border border-[var(--border)] rounded-lg px-3 py-2.5">
                <p className="text-[var(--accent)] text-lg font-semibold">{watchedCount}</p>
                <p className="text-[var(--text-muted)] text-xs">Films vus</p>
              </div>
              <div className="bg-[var(--navbar)] border border-[var(--border)] rounded-lg px-3 py-2.5">
                <p className="text-[var(--text)] text-lg font-semibold">{watchlistCount}</p>
                <p className="text-[var(--text-muted)] text-xs">À voir</p>
              </div>
              {customKeys.length > 0 && (
                <div className="bg-[var(--navbar)] border border-[var(--border)] rounded-lg px-3 py-2.5 col-span-2 md:col-span-1">
                  <p className="text-[var(--text)] text-lg font-semibold">{customKeys.length}</p>
                  <p className="text-[var(--text-muted)] text-xs">Listes perso</p>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="text-[var(--text-muted)] text-xs border border-[var(--border)] px-3 py-1.5 rounded hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors w-full md:w-auto"
            >
              Déconnexion
            </button>
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 min-w-0">
          {/* Listes fixes */}
          {FIXED_ORDER.map(key => (
            <Section
              key={key}
              title={`${listLabel(key)} (${(grouped[key] ?? []).length})`}
              isEditing={editingList === key}
              onToggleEdit={() => setEditingList(editingList === key ? null : key)}
              canDelete={false}
            >
              {(grouped[key] ?? []).length === 0 ? (
                <p className="text-[var(--text-muted)] text-xs">
                  {key === 'watchlist'
                    ? "Aucun film ou série à voir. Ajoutez des médias depuis la page d'accueil."
                    : 'Aucun média marqué comme déjà vu.'}
                </p>
              ) : (
                <MediaMiniGrid
                  items={grouped[key]}
                  isEditing={editingList === key}
                  onRemove={handleRemoveItem}
                />
              )}
            </Section>
          ))}

          {/* Listes custom */}
          {customKeys.map(key => (
            <Section
              key={key}
              title={`${listLabel(key)} (${grouped[key].length})`}
              isEditing={editingList === key}
              onToggleEdit={() => setEditingList(editingList === key ? null : key)}
              canDelete={true}
              confirmingDelete={confirmDelete === key}
              onRequestDelete={() => setConfirmDelete(key)}
              onCancelDelete={() => setConfirmDelete(null)}
              onConfirmDelete={() => handleDeleteList(key)}
            >
              <MediaMiniGrid
                items={grouped[key]}
                isEditing={editingList === key}
                onRemove={handleRemoveItem}
              />
            </Section>
          ))}

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
                    className="relative w-16 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors shrink-0"
                    title={getTitle(media)}
                  >
                    {media.poster_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w200${media.poster_path}`}
                        alt={getTitle(media)}
                        fill
                        sizes="64px"
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
  return (
    <div className="mb-8">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isEditing ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
        <h2 className="text-[var(--text)] text-sm font-medium">{title}</h2>
        {showEditButton !== false && (
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
              className="text-[var(--text-muted)] text-xs border border-[var(--border)] px-2 py-1 rounded hover:border-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
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

interface MediaMiniGridProps {
  items: MediaListItem[]
  isEditing?: boolean
  onRemove?: (id: string) => void
}

function MediaMiniGrid({ items, isEditing = false, onRemove }: MediaMiniGridProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map(item => (
        <div key={item.id ?? item.tmdb_id} className="relative shrink-0">
          <Link
            href={`/media/${item.media_type}-${item.tmdb_id}`}
            title={item.title ?? undefined}
            className="relative w-16 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors block"
            onClick={isEditing ? (e) => e.preventDefault() : undefined}
          >
            {item.poster_path ? (
              <Image
                src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                alt={item.title ?? ''}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </div>
            )}
          </Link>
          {isEditing && (
            <button
              onClick={() => onRemove?.(item.id)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 transition-colors"
              title={`Retirer ${item.title ?? ''}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
