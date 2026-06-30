'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { posterUrl, getTitle, type Media } from '@/lib/tmdb'

function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Media[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const search = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setResults([]); return }
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
    }, 300),
    []
  )

  useEffect(() => { search(query) }, [query, search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-full px-3 py-1.5 focus-within:border-accent transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#555] shrink-0">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher..."
          className="bg-transparent text-white text-xs outline-none w-full placeholder-[#444]"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg overflow-hidden z-50 shadow-xl">
          {results.map(media => {
            const type = media.media_type ?? 'movie'
            const poster = posterUrl(media.poster_path, 'w92')
            return (
              <Link
                key={media.id}
                href={`/media/${type}-${media.id}`}
                onClick={() => { setOpen(false); setQuery('') }}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#252525] transition-colors"
              >
                <div className="relative w-7 h-10 shrink-0 rounded overflow-hidden bg-[#1c1c1c]">
                  {poster && <Image src={poster} alt="" fill sizes="28px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs truncate">{getTitle(media)}</p>
                  <p className="text-[#555] text-[10px]">{type === 'movie' ? 'Film' : 'Série'}</p>
                </div>
                <span className="text-accent text-[10px] ml-auto shrink-0">★ {media.vote_average.toFixed(1)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
