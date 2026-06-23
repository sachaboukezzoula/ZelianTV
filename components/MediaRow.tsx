'use client'

import { useRef, useCallback } from 'react'
import { MediaCard } from '@/components/MediaCard'
import type { Media, MediaType } from '@/lib/tmdb'

interface Props {
  title: string
  items: Media[]
  mediaType: MediaType
}

export function MediaRow({ title, items, mediaType }: Props) {
  if (items.length === 0) return null

  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' })
  }, [])

  return (
    <section className="py-4 px-4">
      <h2 className="text-sm font-medium text-gray-200 mb-3">{title}</h2>
      <div className="relative group/row">
        {/* Flèche gauche */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 h-full z-10 flex items-center justify-center w-10 bg-gradient-to-r from-[#141414]/80 to-transparent text-[#aaa] hover:text-white transition-colors opacity-0 group-hover/row:opacity-100"
          aria-label="Défiler à gauche"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Rangée scrollable */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 no-scrollbar"
        >
          {items.map(media => (
            <MediaCard key={media.id} media={media} mediaType={mediaType} />
          ))}
        </div>

        {/* Flèche droite */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 h-full z-10 flex items-center justify-center w-10 bg-gradient-to-l from-[#141414]/80 to-transparent text-[#aaa] hover:text-white transition-colors opacity-0 group-hover/row:opacity-100"
          aria-label="Défiler à droite"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>
  )
}
