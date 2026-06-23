'use client'

import { useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Genre } from '@/lib/tmdb'

interface Props {
  genres: Genre[]
}

export function FilterBar({ genres }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = searchParams.get('type') ?? 'movie'
  const genreId = searchParams.get('genre') ?? ''
  const scrollRef = useRef<HTMLDivElement>(null)

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    if (key === 'type') params.delete('genre')
    router.push(`/?${params.toString()}`)
  }

  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
  }, [])

  return (
    <div className="w-full border-b border-[#1e1e1e] relative flex items-center">
      {/* Flèche gauche */}
      <button
        onClick={() => scroll('left')}
        className="shrink-0 z-10 flex items-center justify-center w-8 py-2.5 text-[#666] hover:text-white hover:bg-[#ffffff10] transition-colors"
        aria-label="Défiler à gauche"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Conteneur scrollable sans scrollbar */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 py-2.5 overflow-x-auto flex-1 no-scrollbar"
      >
        <button
          onClick={() => setParam('type', 'movie')}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
            type === 'movie'
              ? 'bg-[#f97316] text-white'
              : 'text-[#666] border border-[#2a2a2a] hover:border-[#444]'
          }`}
        >
          Film
        </button>
        <button
          onClick={() => setParam('type', 'tv')}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
            type === 'tv'
              ? 'bg-[#f97316] text-white'
              : 'text-[#666] border border-[#2a2a2a] hover:border-[#444]'
          }`}
        >
          Série
        </button>

        <span className="text-[#2a2a2a] mx-1 shrink-0">│</span>

        {genres.map(g => (
          <button
            key={g.id}
            onClick={() => setParam('genre', genreId === String(g.id) ? '' : String(g.id))}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-colors ${
              genreId === String(g.id)
                ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]'
                : 'bg-[#1c1c1c] text-[#666] hover:text-[#999]'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* Flèche droite */}
      <button
        onClick={() => scroll('right')}
        className="shrink-0 z-10 flex items-center justify-center w-8 py-2.5 text-[#666] hover:text-white hover:bg-[#ffffff10] transition-colors"
        aria-label="Défiler à droite"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}
