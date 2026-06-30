// components/Navbar.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SearchBar } from '@/components/SearchBar'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import type { Profile } from '@/app/actions/profiles'

interface NavbarProps {
  activeProfile: Profile | null
}

export function Navbar({ activeProfile }: NavbarProps) {
  const router = useRouter()
  const { theme } = useTheme()

  const logoFilter =
    theme === 'blue'   ? 'invert(1) hue-rotate(12deg)' :
    theme === 'violet' ? 'invert(1) hue-rotate(53deg)' :
                         'invert(1) hue-rotate(180deg)'

  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setDropdownOpen(false)
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Fermer le menu mobile au clic en dehors du header
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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
    <header ref={headerRef} className="sticky top-0 z-50" style={{ background: menuOpen ? '#0e0e12' : 'transparent', transition: 'background 0.2s ease' }}>
      <div className="flex items-center justify-between px-6 h-14 w-full">
        <Link href="/" className="shrink-0">
          <Image src="/zelian-tv-logo.png" alt="ZelianTV" width={147} height={32}
            className="h-8 w-auto" style={{ filter: `${logoFilter} drop-shadow(0 0 4px rgba(0,0,0,.6)) drop-shadow(0 2px 4px rgba(0,0,0,.55))`, transition: 'filter 0.3s ease' }} priority />
        </Link>

        <div className="hidden md:flex flex-1 max-w-xs mx-6">
          <SearchBar />
        </div>

        <div className="flex items-center gap-3">
          {/* Bouton Accueil */}
          <Link
            href="/"
            aria-label="Accueil"
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-full text-[#666] hover:text-white hover:bg-[#1e1e1e] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>

          {/* Compte → dropdown (avatar + pseudo, façon Netflix) */}
          <div ref={dropdownRef} className="relative hidden md:block">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              aria-label="Mon compte"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '3px 9px 3px 3px', borderRadius: 999,
                background: dropdownOpen ? 'rgba(255,255,255,.08)' : 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, overflow: 'hidden', position: 'relative', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeProfile ? (activeProfile.avatar_url ? 'transparent' : activeProfile.color) : '#252525',
                border: '1.5px solid rgba(255,255,255,.2)',
              }}>
                {activeProfile ? (
                  activeProfile.avatar_url
                    ? <Image src={activeProfile.avatar_url} alt={activeProfile.name} fill sizes="30px" style={{ objectFit: 'cover' }} />
                    : <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 700 }}>{activeProfile.name[0].toUpperCase()}</span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                )}
              </div>
              {activeProfile && (
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{activeProfile.name}</span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.55))' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Menu déroulant */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 10px)',
              minWidth: 220,
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              opacity: dropdownOpen ? 1 : 0,
              transform: dropdownOpen ? 'translateY(0)' : 'translateY(-8px)',
              pointerEvents: dropdownOpen ? 'auto' : 'none',
              transition: 'opacity 0.18s ease, transform 0.18s ease',
              zIndex: 60,
            }}>
              {/* Changer de profil */}
              <Link
                href="/profils"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-[#bbb] hover:bg-[#1e1e1e] hover:text-white transition-colors"
              >
                <div style={{ flexShrink: 0 }}>{profileAvatar}</div>
                <span>Changer de profil</span>
              </Link>

              {/* Séparateur */}
              <div style={{ height: 1, background: '#222', margin: '0 12px' }} />

              {/* Paramètres du compte */}
              <Link
                href="/profil"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-[#bbb] hover:bg-[#1e1e1e] hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Paramètres du compte
              </Link>

              {/* Séparateur */}
              <div style={{ height: 1, background: '#222', margin: '0 12px' }} />

              {/* Se déconnecter */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#e05252] hover:bg-[#1e1e1e] hover:text-[#f87171] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Se déconnecter
              </button>
            </div>
          </div>

          {/* Déclencheur mobile : avatar + pseudo (ouvre le menu) — façon Netflix */}
          <button
            className="md:hidden flex items-center gap-2 focus:outline-none"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu compte"
            style={{ padding: '3px 7px 3px 3px', borderRadius: 999, background: menuOpen ? 'rgba(255,255,255,.08)' : 'transparent', transition: 'background 0.15s ease' }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 8, overflow: 'hidden', position: 'relative', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: activeProfile ? (activeProfile.avatar_url ? 'transparent' : activeProfile.color) : '#252525',
              border: '1.5px solid rgba(255,255,255,.2)',
            }}>
              {activeProfile ? (
                activeProfile.avatar_url
                  ? <Image src={activeProfile.avatar_url} alt={activeProfile.name} fill sizes="30px" style={{ objectFit: 'cover' }} />
                  : <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>{activeProfile.name[0].toUpperCase()}</span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              )}
            </div>
            {activeProfile && (
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{activeProfile.name}</span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.55))' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div className="pt-3 flex flex-col">
            <div className="pb-2"><SearchBar /></div>
            <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 py-2.5 text-sm text-[#cfcfcf] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Accueil
            </Link>
            <Link href="/profils" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 py-2.5 text-sm text-[#cfcfcf] hover:text-white transition-colors">
              <span style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeProfile ? (activeProfile.avatar_url ? 'transparent' : activeProfile.color) : '#252525', border: '1px solid rgba(255,255,255,.18)' }}>
                {activeProfile?.avatar_url
                  ? <Image src={activeProfile.avatar_url} alt="" fill sizes="22px" style={{ objectFit: 'cover' }} />
                  : <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 700 }}>{activeProfile ? activeProfile.name[0].toUpperCase() : '?'}</span>}
              </span>
              Changer de profil
            </Link>
            <Link href="/profil" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 py-2.5 text-sm text-[#cfcfcf] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Paramètres du compte
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-3 py-2.5 text-sm text-[#e05252] hover:text-[#f87171] transition-colors text-left">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
