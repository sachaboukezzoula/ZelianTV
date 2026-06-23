'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { SearchBar } from '@/components/SearchBar'

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#1a1a1a]">
      <div className="flex items-center justify-between px-6 h-14 w-full">

        {/* Logo — lien home sur desktop, menu toggle sur mobile */}
        <Link href="/" className="shrink-0">
          <Image
            src="/zelian-tv-logo.png"
            alt="ZelianTV"
            width={120}
            height={32}
            className="h-8 w-auto"
            style={{ filter: 'invert(1) hue-rotate(180deg)' }}
            priority
          />
        </Link>

        {/* Hamburger mobile */}
        <button
          className="md:hidden text-gray-400 hover:text-white ml-2 focus:outline-none"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></>
            }
          </svg>
        </button>

        {/* Search — centré sur desktop */}
        <div className="hidden md:flex flex-1 max-w-xs mx-6">
          <SearchBar />
        </div>

        {/* Profil */}
        <Link
          href="/profil"
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Mon profil"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </Link>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="md:hidden px-4 pb-3 border-t border-[#1a1a1a]">
          <div className="pt-3 flex flex-col gap-3">
            <SearchBar />
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-[#aaa] hover:text-white transition-colors"
            >
              Accueil
            </Link>
            <Link
              href="/profil"
              onClick={() => setMenuOpen(false)}
              className="text-sm text-[#aaa] hover:text-white transition-colors"
            >
              Mon profil
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
