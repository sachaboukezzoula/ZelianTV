'use client'

import { useState } from 'react'

interface Props {
  videoKey: string
  title: string
}

export function YoutubePlayer({ videoKey, title }: Props) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-[#1c1c1c] border border-[#2a2a2a]">
      {!loaded ? (
        <button
          onClick={() => setLoaded(true)}
          className="absolute inset-0 flex items-center justify-center gap-3 hover:bg-white/5 transition-colors w-full"
        >
          <div className="w-10 h-10 rounded-full bg-[#f97316] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <span className="text-[#666] text-sm">Bande-annonce — {title}</span>
        </button>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      )}
    </div>
  )
}
