'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface Props {
  posterSrc: string
  alt: string
  videoKey?: string
  title: string
}

export function PosterPlayer({ posterSrc, alt, videoKey, title }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [modalOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Poster — reste en place */}
      <div
        className="poster-wrap relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-[#2a2a2a] group/poster"
        onClick={() => videoKey && setModalOpen(true)}
        style={{ cursor: videoKey ? 'pointer' : 'default' }}
      >
        <Image
          src={posterSrc}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 112px, 300px"
          className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
        />
        {videoKey && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shadow-lg">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <span className="text-white text-sm font-semibold tracking-wide">Voir le trailer</span>
          </div>
        )}
      </div>

      {/* Modal overlay — par-dessus toute la page */}
      {modalOpen && videoKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full mx-6"
            style={{ maxWidth: '900px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Bouton fermer */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute -top-10 right-0 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium"
            >
              Fermer
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Player YouTube */}
            <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            <p className="text-center text-white/40 text-xs mt-3">Cliquez en dehors pour fermer · Échap</p>
          </div>
        </div>
      )}
    </>
  )
}
