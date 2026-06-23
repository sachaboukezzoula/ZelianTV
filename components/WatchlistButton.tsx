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
}

export function WatchlistButton({ tmdbId, mediaType }: Props) {
  const { allLists, addList } = useListsContext()
  const [listType, setListType] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
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
      await toggleWatchlist(tmdbId, mediaType, target, listType)
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
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-60 ${
          listType
            ? 'bg-[#f97316] border-[#f97316] text-white'
            : 'border-[#f97316] text-[#f97316] hover:bg-[#f97316]/10'
        }`}
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
              className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 hover:bg-[#252525] transition-colors ${
                listType === l ? 'text-[#f97316]' : 'text-[#ccc]'
              }`}
            >
              <span className={`w-3 text-center text-[10px] ${listType === l ? 'opacity-100' : 'opacity-0'}`}>✓</span>
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
                  className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 hover:bg-[#252525] transition-colors ${
                    listType === l ? 'text-[#f97316]' : 'text-[#ccc]'
                  }`}
                >
                  <span className={`w-3 text-center text-[10px] ${listType === l ? 'opacity-100' : 'opacity-0'}`}>✓</span>
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
                className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 text-[#555] hover:text-[#888] hover:bg-[#252525] transition-colors"
              >
                <span className="w-3 text-center text-[10px]">✕</span>
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
                className="text-[#f97316] text-xs font-medium hover:text-orange-400 transition-colors"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 text-[#f97316] hover:bg-[#252525] transition-colors"
            >
              <span className="w-3 text-center text-base leading-none">+</span>
              Créer une liste
            </button>
          )}
        </div>
      )}
    </div>
  )
}
