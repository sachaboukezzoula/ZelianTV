'use client'

import { useRef, useCallback, useEffect } from 'react'
import { MediaCard } from '@/components/MediaCard'
import type { Media, MediaType } from '@/lib/tmdb'

interface Props {
  title: string
  items: Media[]
  mediaType: MediaType
}

export function MediaRow({ title, items, mediaType }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Défilement par flèche — circulaire : au bord, on boucle de l'autre côté
  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const step = Math.max(el.clientWidth * 0.85, 300)
    const atStart = el.scrollLeft <= 2
    const atEnd = el.scrollLeft >= max - 2
    if (dir === 'right') {
      el.scrollTo({ left: atEnd ? 0 : Math.min(el.scrollLeft + step, max), behavior: 'smooth' })
    } else {
      el.scrollTo({ left: atStart ? max : Math.max(el.scrollLeft - step, 0), behavior: 'smooth' })
    }
  }, [])

  // Molette de la souris → défilement horizontal quand on survole la rangée
  // (au bord, on rend la molette à la page pour pouvoir continuer à scroller verticalement)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return // geste déjà horizontal (trackpad)
      const max = el!.scrollWidth - el!.clientWidth
      if (max <= 0) return
      const atStart = el!.scrollLeft <= 0
      const atEnd = el!.scrollLeft >= max - 1
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return // bord → laisser la page défiler
      e.preventDefault()
      el!.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  if (items.length === 0) return null

  return (
    <section className="py-4 px-4">
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="relative group/row">
        {/* Flèche gauche */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 h-full z-10 flex items-center justify-center w-10 bg-gradient-to-r from-[#141414]/80 to-transparent text-[#aaa] hover:text-accent hover:scale-110 transition-all opacity-0 group-hover/row:opacity-100"
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
          className="absolute right-0 top-0 h-full z-10 flex items-center justify-center w-10 bg-gradient-to-l from-[#141414]/80 to-transparent text-[#aaa] hover:text-accent hover:scale-110 transition-all opacity-0 group-hover/row:opacity-100"
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
