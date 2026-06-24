'use client'

import { useMemo } from 'react'
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import Image from 'next/image'
import Link from 'next/link'

export interface MediaListItem {
  id: string
  tmdb_id: number
  media_type: string
  list_type: string
  rating: number | null
  poster_path: string | null
  title: string | null
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

  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0" {...attributes} {...listeners}>
      <Link
        href={`/media/${item.media_type}-${item.tmdb_id}`}
        title={item.title ?? undefined}
        className="relative w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors block"
        onClick={isEditing || isDragging ? (e) => e.preventDefault() : undefined}
        draggable={false}
      >
        {item.poster_path ? (
          <Image
            src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
            alt={item.title ?? ''}
            fill
            sizes="(min-width: 640px) 96px, 80px"
            className="object-cover"
            draggable={false}
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
          onClick={(e) => { e.stopPropagation(); if (item.id) onRemove?.(item.id) }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 transition-colors"
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

  const itemIds = useMemo(() => items.map(i => i.id), [items])

  return (
    <SortableContext items={itemIds} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          minHeight: 96,
          borderRadius: 8,
          padding: highlight ? 8 : 2,
          border: highlight ? '2px solid #f97316' : '2px solid transparent',
          background: highlight ? 'rgba(249,115,22,.06)' : 'transparent',
          transition: 'all 0.15s ease',
        }}
      >
        {items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', alignSelf: 'center' }}>
            {emptyText}
          </p>
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
      className="relative w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--accent)]"
      style={{
        opacity: 0.95,
        transform: 'rotate(3deg) scale(1.05)',
        boxShadow: '0 12px 32px rgba(249,115,22,.45)',
      }}
    >
      {item.poster_path ? (
        <Image
          src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
          alt={item.title ?? ''}
          fill
          sizes="96px"
          className="object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--accent)] text-2xl font-bold">
          {item.title?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
    </div>
  )
}
