'use client'

import { useMemo } from 'react'
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import Image from 'next/image'
import Link from 'next/link'
import { ZelectronBadge } from '@/components/Zelectron'

export interface MediaListItem {
  id: string
  tmdb_id: number
  media_type: string
  list_type: string
  rating: number | null
  poster_path: string | null
  title: string | null
  overview?: string | null
  vote_average?: number | null
  year?: string | null
  sort_order: number
}

interface SortableMediaItemProps {
  item: MediaListItem
  isEditing: boolean
  onRemove?: (id: string) => void
}

export function SortableMediaItem({ item, isEditing, onRemove }: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { listType: item.list_type },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : undefined,
  }

  const isWatched = item.list_type === 'watched'
  const voteLabel = item.vote_average != null && item.vote_average > 0 ? item.vote_average.toFixed(1) : null

  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0" {...attributes} {...listeners}>
      <Link
        href={`/media/${item.media_type}-${item.tmdb_id}`}
        title={item.title ?? undefined}
        onClick={isEditing || isDragging ? (e) => e.preventDefault() : undefined}
        draggable={false}
        className="gal-poster relative block w-[140px] sm:w-[160px] aspect-[2/3] rounded-[10px] overflow-hidden cursor-grab select-none"
        style={{ boxShadow: '0 10px 26px rgba(0,0,0,.45)', touchAction: 'none', background: 'linear-gradient(160deg,#10131c,#1a2030)' }}
      >
        {item.poster_path ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
            alt={item.title ?? ''}
            fill
            sizes="(min-width: 640px) 160px, 140px"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gal-display text-4xl text-white/40">
            {item.title?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        {/* Badge « vu » (déjà vu). La note reste dans l'overlay pour ne pas masquer l'affiche. */}
        {isWatched && (
          <div
            className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 h-[22px] px-2 rounded-[5px] text-[10px] font-semibold tracking-wide"
            style={{ background: 'rgba(74,180,110,.9)', color: '#04140a' }}
          >
            ✓ VU
          </div>
        )}

        {/* Note Zelectron de l'utilisateur (haut-droite) */}
        {item.rating != null && item.rating > 0 && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <ZelectronBadge rating={item.rating} />
          </div>
        )}

        {/* Ligne d'accent (couleur du thème) en bas de toutes les cartes de listes */}
        <div className="absolute left-0 right-0 bottom-0 h-[3px] pointer-events-none" style={{ background: 'var(--accent)' }} />

        {/* Overlay survol : note + titre + synopsis + CTA */}
        <div
          className="gal-ov absolute inset-0 flex flex-col p-3.5"
          style={{ background: 'linear-gradient(0deg,rgba(8,8,10,.98),rgba(8,8,10,.72))' }}
        >
          {voteLabel && (
            <div className="text-[11px] font-semibold" style={{ color: 'var(--accent-2)' }}>★ {voteLabel}</div>
          )}
          <div className="gal-display text-[19px] leading-none mt-1.5 line-clamp-2">{item.title ?? 'Sans titre'}</div>
          {item.overview ? (
            <div className="text-[11px] leading-[1.45] mt-2 overflow-hidden" style={{ color: 'rgba(243,241,238,.72)', flex: '1 1 auto', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>{item.overview}</div>
          ) : (
            <div className="flex-1" />
          )}
          <div
            className="flex items-center justify-center gap-2 h-[32px] rounded-md text-[12px] font-bold mt-2.5"
            style={{ background: 'var(--accent)', color: '#0a0a0c' }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>
            Voir la fiche
          </div>
        </div>
      </Link>

      {isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); if (item.id) onRemove?.(item.id) }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold z-30 transition-colors shadow-lg"
          title={`Retirer ${item.title ?? ''}`}
        >
          ×
        </button>
      )}
    </div>
  )
}

interface DroppableMiniGridProps {
  items: MediaListItem[]
  listType: string
  isDragActive: boolean
  isOverList?: boolean
  isEditing: boolean
  emptyText: string
  onRemove?: (id: string) => void
}

export function DroppableMiniGrid({
  items,
  listType,
  isDragActive,
  isOverList,
  isEditing,
  emptyText,
  onRemove,
}: DroppableMiniGridProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: listType,
    data: { listType },
  })

  const highlight = isDragActive && (isOver || !!isOverList)
  const idle = isDragActive && !highlight

  const itemIds = useMemo(() => items.map(i => i.id), [items])

  return (
    <SortableContext items={itemIds} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        style={{
          borderRadius: 16,
          padding: 16,
          minHeight: 268,
          transition: 'box-shadow 0.2s ease, background 0.2s ease',
          boxShadow: highlight
            ? 'inset 0 0 0 2px var(--accent), 0 0 34px var(--accent-glow-md)'
            : idle
              ? 'inset 0 0 0 1.5px var(--accent-glow-md)'
              : 'none',
          background: highlight ? 'var(--accent-glow-sm)' : idle ? 'var(--accent-glow-sm)' : 'transparent',
        }}
      >
        <div className="flex gap-4 flex-wrap">
          {items.length === 0 ? (
            <div
              className="w-full flex flex-col items-center justify-center gap-2.5 rounded-xl"
              style={{ minHeight: 236, color: 'rgba(243,241,238,.32)', border: '1.5px dashed rgba(255,255,255,.12)' }}
            >
              {listType === 'watched' ? (
                <svg width="26" height="26" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l2.5 2.5 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 16 16" fill="none"><path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              )}
              <span className="text-[13px]">{emptyText}</span>
            </div>
          ) : (
            items.map(item => (
              <SortableMediaItem
                key={item.id}
                item={item}
                isEditing={isEditing}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </div>
    </SortableContext>
  )
}

interface GhostPosterProps {
  item: MediaListItem | null
}

export function GhostPoster({ item }: GhostPosterProps) {
  if (!item) return null
  return (
    <div
      className="relative w-[140px] sm:w-[150px] aspect-[2/3] rounded-[11px] overflow-hidden"
      style={{
        transform: 'rotate(-6deg) scale(1.05)',
        boxShadow: '0 26px 64px rgba(0,0,0,.62), 0 0 0 2px var(--accent), 0 0 44px var(--accent-glow)',
        background: 'linear-gradient(160deg,#10131c,#1a2030)',
      }}
    >
      {item.poster_path ? (
        <Image
          src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
          alt={item.title ?? ''}
          fill
          sizes="150px"
          className="object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center gal-display text-4xl text-white/50">
          {item.title?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <div
        className="absolute left-0 right-0 bottom-0 px-2.5 pt-8 pb-2.5"
        style={{ background: 'linear-gradient(0deg,rgba(0,0,0,.92),transparent)' }}
      >
        <div className="gal-display text-[15px] leading-none tracking-wide line-clamp-2">{item.title ?? ''}</div>
      </div>
    </div>
  )
}
