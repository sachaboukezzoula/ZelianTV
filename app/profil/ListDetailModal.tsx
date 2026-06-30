'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { MediaListItem } from './DndMedia'
import type { MediaType } from '@/lib/tmdb'
import { renameList, setListCover, uploadListCoverAction, deleteCustomList } from '@/app/actions/lists'
import { moveToList, removeFromList } from '@/app/actions/watchlist'
import { likeMedia } from '@/app/actions/likes'

interface OtherList {
  key: string
  label: string
}

interface Props {
  listName: string
  items: MediaListItem[]
  otherLists: OtherList[]
  onClose: () => void
  onRefresh: () => void
  onRenamed: (newName: string) => void
}

function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
        else { width = Math.round((width * maxDim) / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas non supporté')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression échouée')), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

function DraggableFilm({ item, editMode, onRemove }: { item: MediaListItem; editMode: boolean; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, data: { from: item.list_type } })
  const voteLabel = item.vote_average != null && item.vote_average > 0 ? item.vote_average.toFixed(1) : null
  return (
    <div ref={setNodeRef} className="relative" style={{ opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      <Link
        href={`/media/${item.media_type}-${item.tmdb_id}`}
        title={item.title ?? undefined}
        onClick={editMode || isDragging ? (e) => e.preventDefault() : undefined}
        draggable={false}
        className="gal-poster relative block aspect-[2/3] rounded-[10px] overflow-hidden cursor-grab select-none"
        style={{ background: 'linear-gradient(160deg,#10131c,#1a2030)', boxShadow: '0 8px 18px rgba(0,0,0,.4)', touchAction: 'none' }}
      >
        {item.poster_path ? (
          <Image src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title ?? ''} fill sizes="116px" className="object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gal-display text-3xl text-white/40">{item.title?.[0]?.toUpperCase() ?? '?'}</div>
        )}

        {/* Date de sortie sur la face (à la place du titre) */}
        {item.year && (
          <div className="absolute left-0 right-0 bottom-0 px-2.5 pt-6 pb-2.5" style={{ background: 'linear-gradient(0deg,rgba(8,8,10,.9),transparent)', pointerEvents: 'none' }}>
            <span className="gal-display" style={{ fontSize: 15, letterSpacing: '.04em', color: 'rgba(243,241,238,.92)' }}>{item.year}</span>
          </div>
        )}

        {/* Ligne d'accent (couleur du thème) */}
        <div className="absolute left-0 right-0 bottom-0 h-[3px] pointer-events-none" style={{ background: 'var(--accent)' }} />

        {/* Overlay survol : note + titre + synopsis + CTA */}
        <div className="gal-ov absolute inset-0 flex flex-col p-3" style={{ background: 'linear-gradient(0deg,rgba(8,8,10,.98),rgba(8,8,10,.72))' }}>
          {voteLabel && <div className="text-[11px] font-semibold" style={{ color: 'var(--accent-2)' }}>★ {voteLabel}</div>}
          <div className="gal-display line-clamp-2" style={{ fontSize: 16, lineHeight: 1.04, marginTop: 6 }}>{item.title ?? 'Sans titre'}</div>
          {item.overview ? (
            <div className="mt-1.5 overflow-hidden" style={{ fontSize: 10.5, lineHeight: 1.4, color: 'rgba(243,241,238,.72)', flex: '1 1 auto', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>{item.overview}</div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center justify-center gap-1.5 mt-2" style={{ height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: '#0a0a0c' }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.5l8 4.5-8 4.5z" /></svg>
            Voir la fiche
          </div>
        </div>
      </Link>

      {editMode && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(item.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Retirer de la liste"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold z-30 shadow-lg"
          style={{ background: '#e05252', border: 'none', cursor: 'pointer' }}
        >×</button>
      )}
    </div>
  )
}

function MoveChip({ list }: { list: OtherList }) {
  const { setNodeRef, isOver } = useDroppable({ id: `move-${list.key}`, data: { to: list.key } })
  return (
    <div ref={setNodeRef} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 18, fontSize: 12.5, fontWeight: 600, border: `1px dashed ${isOver ? 'var(--accent)' : 'rgba(255,255,255,.2)'}`, background: isOver ? 'var(--accent-glow-sm)' : 'rgba(255,255,255,.03)', color: isOver ? 'var(--accent)' : 'rgba(243,241,238,.7)', transition: 'all .12s ease' }}>
      {list.label}
    </div>
  )
}

export function ListDetailModal({ listName, items, otherLists, onClose, onRefresh, onRenamed }: Props) {
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(listName)
  const [coverOpen, setCoverOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const activeItem = items.find(i => i.id === activeId) ?? null

  async function doRename() {
    const next = renameValue.trim()
    setRenaming(false)
    if (!next || next === listName) return
    setBusy(true)
    const res = await renameList(listName, next)
    setBusy(false)
    if (!('error' in res)) { onRenamed(next); router.refresh() }
  }

  async function pickCover(url: string | null) {
    setCoverOpen(false)
    setBusy(true)
    await setListCover(listName, url)
    setBusy(false)
    onRefresh()
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCoverOpen(false)
    setBusy(true)
    try {
      const blob = await compressImage(file, 800, 0.85)
      const fd = new FormData()
      fd.append('file', new File([blob], 'cover.jpg', { type: 'image/jpeg' }))
      await uploadListCoverAction(fd, listName)
      onRefresh()
    } catch { /* ignore */ }
    setBusy(false)
  }

  async function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)) }
  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const to = over.data.current?.to as string | undefined
    if (!to) return
    const id = String(active.id)
    setBusy(true)
    if (to === '__liked__') {
      // Vers « Aimés » : on ajoute aux likes (table indépendante) puis on retire de la liste courante.
      // Si le like échoue (table non migrée), on NE retire PAS le film (évite toute perte).
      const it = items.find(i => i.id === id)
      if (it) {
        const res = await likeMedia(it.tmdb_id, it.media_type as MediaType)
        if (!('error' in res)) await removeFromList(id)
      }
    } else {
      await moveToList(id, to)
    }
    setBusy(false)
    onRefresh()
  }

  function handleRemove(id: string) {
    removeFromList(id).then(() => onRefresh())
  }

  async function handleDelete() {
    onClose()
    await deleteCustomList(listName)
    router.refresh()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="gal-body" style={{ width: '100%', maxWidth: 1000, background: '#0f0f14', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '26px clamp(20px,4vw,34px) 34px', boxShadow: '0 30px 80px rgba(0,0,0,.6)', opacity: busy ? 0.7 : 1, transition: 'opacity .15s' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') { setRenaming(false); setRenameValue(listName) } }}
              onBlur={doRename}
              maxLength={40}
              className="gal-display"
              style={{ fontSize: 28, letterSpacing: '.03em', background: 'rgba(255,255,255,.05)', border: '1px solid var(--accent-glow)', borderRadius: 8, padding: '2px 12px', color: '#f3f1ee', outline: 'none', minWidth: 200 }}
            />
          ) : (
            <button onClick={() => { setRenameValue(listName); setRenaming(true) }} title="Renommer la liste" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#f3f1ee' }}>
              <span className="gal-display" style={{ fontSize: 30, letterSpacing: '.03em', textTransform: 'uppercase' }}>{listName}</span>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ opacity: .55 }}><path d="M11 3l2 2-7 7H4v-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            </button>
          )}
          <span style={{ fontSize: 14, color: 'rgba(243,241,238,.4)' }}>{items.length} film{items.length > 1 ? 's' : ''}</span>
          <div style={{ flex: 1 }} />
          {items.length > 0 && (
            <button onClick={() => setEditMode(e => !e)} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: editMode ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,.16)', background: editMode ? 'var(--accent-glow-sm)' : 'transparent', color: editMode ? 'var(--accent-2)' : 'rgba(243,241,238,.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {editMode ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Terminer
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 3l2 2-7 7H4v-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                  Modifier
                </>
              )}
            </button>
          )}
          <button onClick={() => setCoverOpen(o => !o)} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.16)', background: coverOpen ? 'rgba(255,255,255,.08)' : 'transparent', color: 'rgba(243,241,238,.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="6" cy="7" r="1.3" fill="currentColor" /><path d="M3 12l3.5-3 2.5 2 2-1.5L14 12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            Couverture
          </button>
          <button onClick={handleDelete} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(210,50,50,.4)', background: 'rgba(210,50,50,.1)', color: '#e06868', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Supprimer</button>
          <button onClick={onClose} aria-label="Fermer" style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#f3f1ee', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Panneau couverture */}
        {coverOpen && (
          <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(243,241,238,.45)', marginBottom: 12 }}>Image de couverture</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: items.some(i => i.poster_path) ? 14 : 0 }}>
              <button onClick={() => fileRef.current?.click()} style={{ height: 38, padding: '0 16px', borderRadius: 9, border: '1px solid var(--accent-glow)', background: 'var(--accent-glow-sm)', color: 'var(--accent-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 11V3M5 6l3-3 3 3M3 12v1.5h10V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Uploader une photo
              </button>
              <button onClick={() => pickCover(null)} style={{ height: 38, padding: '0 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,.16)', background: 'transparent', color: 'rgba(243,241,238,.7)', fontSize: 13, cursor: 'pointer' }}>Aucune (par défaut)</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />
            </div>
            {items.some(i => i.poster_path) && (
              <>
                <div style={{ fontSize: 11.5, color: 'rgba(243,241,238,.45)', marginBottom: 8 }}>…ou choisissez le poster d&apos;un film de la liste :</div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
                  {items.filter(i => i.poster_path).map(i => (
                    <button key={i.id} onClick={() => pickCover(`https://image.tmdb.org/t/p/w500${i.poster_path}`)} title={i.title ?? undefined} style={{ flexShrink: 0, width: 70, aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', cursor: 'pointer', padding: 0, position: 'relative', background: '#10131c' }}>
                      <Image src={`https://image.tmdb.org/t/p/w342${i.poster_path}`} alt={i.title ?? ''} fill sizes="70px" className="object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {/* Cibles de déplacement */}
          {items.length > 0 && otherLists.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              <span style={{ fontSize: 12.5, color: 'rgba(243,241,238,.5)' }}>Glissez un film vers&nbsp;:</span>
              {otherLists.map(l => <MoveChip key={l.key} list={l} />)}
            </div>
          )}

          {items.length === 0 ? (
            <p style={{ color: 'rgba(243,241,238,.5)', fontSize: 14, padding: '16px 0' }}>Cette liste est vide. Glissez-y un film depuis « À voir » / « Déjà vu » sur la carte-dossier, ou ajoutez-en via le bouton « À voir » d&apos;une fiche.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 18 }}>
              {items.map(item => <DraggableFilm key={item.id} item={item} editMode={editMode} onRemove={handleRemove} />)}
            </div>
          )}

          <DragOverlay>
            {activeItem ? (
              <div style={{ width: 116, aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,.6), 0 0 0 2px var(--accent)', transform: 'rotate(-4deg)', background: '#10131c', position: 'relative' }}>
                {activeItem.poster_path && <Image src={`https://image.tmdb.org/t/p/w342${activeItem.poster_path}`} alt="" fill sizes="116px" className="object-cover" />}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
