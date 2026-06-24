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
}

export function WatchlistButton({ tmdbId, mediaType, posterPath, title }: Props) {
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
      <a href="/profil" className="text-[#f97316] text-xs underline underline-offset-2">
        Connecte-toi pour ajouter à ta liste
      </a>
    )
  }

  const customLists = allLists.filter(l => !FIXED_LISTS.includes(l))

  return (
    <div className="relative inline-block">
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={closeDropdown} />
      )}

      {/* Bouton principal */}
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
                backgroundColor: hovered ? '#fb923c' : '#f97316',
                borderColor: '#f97316',
                color: '#fff',
              }
            : {
                backgroundColor: hovered ? 'rgba(249,115,22,0.12)' : 'transparent',
                borderColor: '#f97316',
                color: '#f97316',
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
                color: listType === l ? '#f97316' : '#ccc',
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
                    color: listType === l ? '#f97316' : '#ccc',
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
                className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#f97316] transition-colors"
              />
              <button
                onClick={createList}
                className="text-[#f97316] text-xs font-medium"
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
                color: '#f97316',
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
