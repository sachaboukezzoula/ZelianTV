// components/Navbar.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { SearchBar } from '@/components/SearchBar'
import type { Profile } from '@/app/actions/profiles'

interface NavbarProps {
  activeProfile: Profile | null
}

export function Navbar({ activeProfile }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const profileAvatar = activeProfile ? (
    <div style={{
      width: 32, height: 32, borderRadius: 6,
      background: activeProfile.color, overflow: 'hidden',
      position: 'relative', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {activeProfile.avatar_url ? (
        <Image src={activeProfile.avatar_url} alt={activeProfile.name} fill sizes="32px" style={{ objectFit: 'cover' }} />
      ) : (
        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 700 }}>
          {activeProfile.name[0].toUpperCase()}
        </span>
      )}
    </div>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )

  return (
    <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#1a1a1a]">
      <div className="flex items-center justify-between px-6 h-14 w-full">
        <Link href="/" className="shrink-0">
          <Image src="/zelian-tv-logo.png" alt="ZelianTV" width={120} height={32}
            className="h-8 w-auto" style={{ filter: 'invert(1) hue-rotate(180deg)' }} priority />
        </Link>

        <div className="hidden md:flex flex-1 max-w-xs mx-6">
          <SearchBar />
        </div>

        <div className="flex items-center gap-3">
          {/* Changer de profil → /profils */}
          <Link href="/profils" className="hidden md:flex items-center gap-2 text-gray-400 hover:text-white transition-colors" aria-label="Changer de profil">
            {profileAvatar}
          </Link>
          {/* Paramètres compte → /profil */}
          <Link href="/profil" className="hidden md:block text-gray-400 hover:text-white transition-colors" aria-label="Mon compte">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </Link>

          <button className="md:hidden text-gray-400 hover:text-white focus:outline-none"
            onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden px-4 pb-3 border-t border-[#1a1a1a]">
          <div className="pt-3 flex flex-col gap-3">
            <SearchBar />
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-sm text-[#aaa] hover:text-white transition-colors">Accueil</Link>
            <Link href="/profils" onClick={() => setMenuOpen(false)} className="text-sm text-[#aaa] hover:text-white transition-colors flex items-center gap-2">
              {activeProfile && (
                <div style={{ width: 20, height: 20, borderRadius: 4, background: activeProfile.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                  {activeProfile.name[0].toUpperCase()}
                </div>
              )}
              {activeProfile ? activeProfile.name : 'Changer de profil'}
            </Link>
            <Link href="/profil" onClick={() => setMenuOpen(false)} className="text-sm text-[#aaa] hover:text-white transition-colors">Paramètres du compte</Link>
          </div>
        </div>
      )}
    </header>
  )
}
