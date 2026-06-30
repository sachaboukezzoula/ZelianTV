'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { getWatchlistData, toggleWatchlist } from '@/app/actions/watchlist'
import { useListsContext } from '@/components/ListsProvider'
import type { MediaType } from '@/lib/tmdb'

const FIXED_LISTS = ['watchlist', 'watched']
const FIXED_LABELS: Record<string, string> = {
  watchlist: 'À voir',
  watched: 'Déjà vu',
}

function label(listType: string): string {
  return FIXED_LABELS[listType] ?? listType
}

interface Props {
  tmdbId: number
  mediaType: MediaType
  posterPath?: string | null
  title?: string | null
  variant?: 'default' | 'hero' | 'hero-mobile'
}

export function WatchlistButton({ tmdbId, mediaType, posterPath, title, variant = 'default' }: Props) {
  const { allLists, addList } = useListsContext()
  const [listType, setListType] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getWatchlistData(tmdbId, mediaType).then(({ user, listType: lt }) => {
      setIsLoggedIn(!!user)
      setListType(lt)
      setLoading(false)
    })
  }, [tmdbId, mediaType])

  useEffect(() => {
    if (isCreating) inputRef.current?.focus()
  }, [isCreating])

  function closeDropdown() {
    setIsOpen(false)
    setIsCreating(false)
    setNewListName('')
  }

  function selectList(target: string) {
    const nextListType = listType === target ? null : target

    // Mise à jour immédiate — pas d'attente serveur
    setListType(nextListType)
    if (nextListType) addList(nextListType)
    closeDropdown()

    // Sync DB en arrière-plan (sans annuler l'état local si erreur)
    startTransition(async () => {
      await toggleWatchlist(tmdbId, mediaType, target, listType, posterPath, title)
    })
  }

  function createList() {
    const name = newListName.trim()
    if (!name) return
    selectList(name)
  }

  if (loading) return null

  if (!isLoggedIn) {
    return (
      <a href="/profil" className="text-accent text-xs underline underline-offset-2">
        Connecte-toi pour ajouter à ta liste
      </a>
    )
  }

  const customLists = allLists.filter(l => !FIXED_LISTS.includes(l))

  return (
    <div className={variant === 'hero-mobile' ? 'relative block w-full' : 'relative inline-block'}>
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={closeDropdown} />
      )}

      {/* Bouton principal */}
      {(variant === 'hero' || variant === 'hero-mobile') ? (
        <button
          onClick={() => setIsOpen(o => !o)}
          disabled={isPending}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            height: 50, padding: '0 22px', borderRadius: 9,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.2s ease',
            transform: hovered ? 'translateY(-2px)' : 'none',
            border: '1.5px solid var(--accent)',
            background: listType ? 'transparent' : 'var(--accent)',
            color: listType ? 'var(--accent)' : '#0a0a0c',
            boxShadow: listType ? 'none' : '0 8px 26px var(--accent-glow)',
            filter: hovered && !listType ? 'brightness(1.08)' : 'none',
            ...(variant === 'hero-mobile' ? { width: '100%', height: 52, justifyContent: 'center', padding: '0 16px', fontSize: 15 } : null),
          }}
        >
          {listType ? (
            <><span>✓</span><span>Ajouté</span><span style={{ opacity: .55, fontWeight: 500, fontSize: 12.5, marginLeft: 2 }}>· {label(listType)}</span></>
          ) : (
            <><span style={{ fontSize: 18, lineHeight: 1 }}>＋</span><span>À voir</span></>
          )}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(o => !o)}
          disabled={isPending}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border disabled:opacity-60"
          style={{
            cursor: 'pointer',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            ...(listType
              ? {
                  backgroundColor: 'var(--accent)',
                  filter: hovered ? 'brightness(1.12)' : 'none',
                  borderColor: 'var(--accent)',
                  color: '#fff',
                }
              : {
                  backgroundColor: hovered ? 'var(--accent-glow-sm)' : 'transparent',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }
            ),
          }}
        >
          {listType ? (
            <><span>✓</span><span>Ajouté</span><span className="opacity-50 text-[9px] ml-0.5">— {label(listType)}</span><span className="opacity-60 text-[10px] ml-1">▾</span></>
          ) : (
            <><span className="text-base leading-none">+</span><span>Ajouter à ma liste</span></>
          )}
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-20 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[190px] overflow-hidden">

          {/* Listes fixes */}
          {FIXED_LISTS.map(l => (
            <button
              key={l}
              onClick={() => selectList(l)}
              onMouseEnter={() => setHoveredItem(l)}
              onMouseLeave={() => setHoveredItem(null)}
              className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5"
              style={{
                cursor: 'pointer',
                backgroundColor: hoveredItem === l ? '#252525' : 'transparent',
                color: listType === l ? 'var(--accent)' : '#ccc',
                transition: 'background-color 0.12s ease',
              }}
            >
              <span style={{ width: 12, textAlign: 'center', fontSize: 10, opacity: listType === l ? 1 : 0 }}>✓</span>
              {FIXED_LABELS[l]}
            </button>
          ))}

          {/* Listes custom */}
          {customLists.length > 0 && (
            <>
              <div className="h-px bg-[#2a2a2a] mx-2 my-1" />
              {customLists.map(l => (
                <button
                  key={l}
                  onClick={() => selectList(l)}
                  onMouseEnter={() => setHoveredItem(l)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5"
                  style={{
                    cursor: 'pointer',
                    backgroundColor: hoveredItem === l ? '#252525' : 'transparent',
                    color: listType === l ? 'var(--accent)' : '#ccc',
                    transition: 'background-color 0.12s ease',
                  }}
                >
                  <span style={{ width: 12, textAlign: 'center', fontSize: 10, opacity: listType === l ? 1 : 0 }}>✓</span>
                  {l}
                </button>
              ))}
            </>
          )}

          {/* Retirer */}
          {listType && (
            <>
              <div className="h-px bg-[#2a2a2a] mx-2 my-1" />
              <button
                onClick={() => selectList(listType)}
                onMouseEnter={() => setHoveredItem('__remove__')}
                onMouseLeave={() => setHoveredItem(null)}
                className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5"
                style={{
                  cursor: 'pointer',
                  backgroundColor: hoveredItem === '__remove__' ? '#252525' : 'transparent',
                  color: hoveredItem === '__remove__' ? '#888' : '#555',
                  transition: 'background-color 0.12s ease, color 0.12s ease',
                }}
              >
                <span style={{ width: 12, textAlign: 'center', fontSize: 10 }}>✕</span>
                Retirer de la liste
              </button>
            </>
          )}

          {/* Créer une liste */}
          <div className="h-px bg-[#2a2a2a] mx-2 my-1" />
          {isCreating ? (
            <div className="px-3 py-2 flex gap-2">
              <input
                ref={inputRef}
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createList()
                  if (e.key === 'Escape') { setIsCreating(false); setNewListName('') }
                }}
                placeholder="Nom de la liste..."
                className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-white placeholder-[#444] focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={createList}
                className="text-accent text-xs font-medium"
                style={{ cursor: 'pointer' }}
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              onMouseEnter={() => setHoveredItem('__create__')}
              onMouseLeave={() => setHoveredItem(null)}
              className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5"
              style={{
                cursor: 'pointer',
                backgroundColor: hoveredItem === '__create__' ? '#252525' : 'transparent',
                color: 'var(--accent)',
                transition: 'background-color 0.12s ease',
              }}
            >
              <span style={{ width: 12, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>+</span>
              Créer une liste
            </button>
          )}
        </div>
      )}
    </div>
  )
}
