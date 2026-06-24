# Drag & Drop — Listes de médias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de réordonner les films/séries dans une liste par glisser-déposer, et de déplacer un item d'une liste à une autre (ex: "À voir" → "Déjà vu") — avec long-press sur mobile.

**Architecture:** `@dnd-kit` (Core + Sortable + Utilities) gère le DnD. L'ordre est persisté en base via une colonne `sort_order INTEGER` sur `user_media_lists`. Un composant `DndMedia.tsx` isole les composants DnD (`SortableMediaItem`, `DroppableMiniGrid`, `GhostPoster`), importé dans `ProfileClient.tsx` qui enveloppe les listes dans un `DndContext`. Mise à jour optimiste locale + Server Action pour persister.

**Tech Stack:** Next.js 16 App Router, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Supabase Admin Client, TypeScript strict, Jest + ts-jest

---

## Carte des fichiers

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/migrations/003_add_sort_order.sql` | CREATE | Ajoute `sort_order INTEGER NOT NULL DEFAULT 0` |
| `app/actions/watchlist.ts` | MODIFY | Ajoute `reorderItems` + `moveToList` |
| `__tests__/actions/watchlist-dnd.test.ts` | CREATE | Tests TDD pour les 2 nouvelles Server Actions |
| `app/profil/DndMedia.tsx` | CREATE | `MediaListItem` type + `SortableMediaItem` + `DroppableMiniGrid` + `GhostPoster` |
| `app/profil/ProfileClient.tsx` | MODIFY | Intègre `DndContext`, `DragOverlay`, `localGrouped` state, handlers DnD |
| `app/profil/page.tsx` | MODIFY | Ajoute `.order('sort_order')` à la requête |

---

## Task 1 — Migration SQL `sort_order`

**Files:**
- Create: `supabase/migrations/003_add_sort_order.sql`

- [ ] **Step 1 : Créer la migration**

Créer le fichier `supabase/migrations/003_add_sort_order.sql` :

```sql
ALTER TABLE user_media_lists
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_media_lists_sort_order
  ON user_media_lists(profile_id, list_type, sort_order);
```

- [ ] **Step 2 : Appliquer en local**

```bash
supabase db push
```

Expected : `Applied migration 003_add_sort_order` (ou équivalent selon la version CLI). Si `supabase` CLI n'est pas dispo, appliquer le SQL via le dashboard Supabase > SQL Editor.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/003_add_sort_order.sql
git commit -m "chore(db): add sort_order column to user_media_lists"
```

---

## Task 2 — Server Actions `reorderItems` + `moveToList`

**Files:**
- Modify: `app/actions/watchlist.ts`
- Create: `__tests__/actions/watchlist-dnd.test.ts`

### Étape TDD

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `__tests__/actions/watchlist-dnd.test.ts` :

```typescript
import { reorderItems, moveToList } from '@/app/actions/watchlist'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/profile', () => ({ getActiveProfileIdFromCookie: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveProfileIdFromCookie } from '@/lib/profile'

const mockCreateClient = createClient as jest.Mock
const mockCreateAdminClient = createAdminClient as jest.Mock
const mockGetProfileId = getActiveProfileIdFromCookie as jest.Mock

function makeAuthMock() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  })
  mockGetProfileId.mockResolvedValue('p1')
}

function makeUnauthMock() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  })
}

describe('reorderItems', () => {
  beforeEach(() => { jest.clearAllMocks(); makeAuthMock() })

  it('should return error when not authenticated', async () => {
    makeUnauthMock()
    const result = await reorderItems('watchlist', ['a', 'b'])
    expect(result).toEqual({ error: 'Non connecté' })
  })

  it('should update sort_order for each id and return {}', async () => {
    const mockEqFinal = jest.fn().mockResolvedValue({ error: null })
    const mockEqId = jest.fn().mockReturnValue({ eq: mockEqFinal })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEqId })
    const mockAdmin = { from: jest.fn().mockReturnValue({ update: mockUpdate }) }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await reorderItems('watchlist', ['id-1', 'id-2'])

    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 0 })
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1 })
    expect(mockEqId).toHaveBeenCalledWith('id', 'id-1')
    expect(mockEqId).toHaveBeenCalledWith('id', 'id-2')
  })

  it('should return error when a DB update fails', async () => {
    const mockEqFinal = jest.fn().mockResolvedValue({ error: { message: 'DB error' } })
    const mockEqId = jest.fn().mockReturnValue({ eq: mockEqFinal })
    const mockAdmin = {
      from: jest.fn().mockReturnValue({ update: jest.fn().mockReturnValue({ eq: mockEqId }) }),
    }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await reorderItems('watchlist', ['id-1'])
    expect(result).toEqual({ error: 'DB error' })
  })
})

describe('moveToList', () => {
  beforeEach(() => { jest.clearAllMocks(); makeAuthMock() })

  it('should return error when not authenticated', async () => {
    makeUnauthMock()
    const result = await moveToList('item-1', 'watched')
    expect(result).toEqual({ error: 'Non connecté' })
  })

  it('should move item to target list at sort_order = max + 1', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { sort_order: 3 }, error: null })
    const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockEqList = jest.fn().mockReturnValue({ order: mockOrder })
    const mockEqProfile = jest.fn().mockReturnValue({ eq: mockEqList })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqProfile })

    const mockEqFinalUpdate = jest.fn().mockResolvedValue({ error: null })
    const mockEqIdUpdate = jest.fn().mockReturnValue({ eq: mockEqFinalUpdate })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEqIdUpdate })

    let callCount = 0
    const mockAdmin = {
      from: jest.fn().mockImplementation(() => {
        callCount++
        return callCount === 1
          ? { select: mockSelect }
          : { update: mockUpdate }
      }),
    }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await moveToList('item-1', 'watched')
    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith({ list_type: 'watched', sort_order: 4 })
  })

  it('should use sort_order 0 when target list is empty', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    const mockLimit = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockEqList = jest.fn().mockReturnValue({ order: mockOrder })
    const mockEqProfile = jest.fn().mockReturnValue({ eq: mockEqList })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqProfile })

    const mockEqFinalUpdate = jest.fn().mockResolvedValue({ error: null })
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ eq: mockEqFinalUpdate }),
    })

    let callCount = 0
    const mockAdmin = {
      from: jest.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? { select: mockSelect } : { update: mockUpdate }
      }),
    }
    mockCreateAdminClient.mockReturnValue(mockAdmin)

    const result = await moveToList('item-1', 'watched')
    expect(result).toEqual({})
    expect(mockUpdate).toHaveBeenCalledWith({ list_type: 'watched', sort_order: 0 })
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx jest __tests__/actions/watchlist-dnd.test.ts --no-coverage
```

Expected : `FAIL` — `reorderItems is not a function` ou `moveToList is not a function`.

### Implémentation

- [ ] **Step 3 : Ajouter les Server Actions dans `app/actions/watchlist.ts`**

Ajouter à la fin du fichier (après la fonction `deleteList`) :

```typescript
export async function reorderItems(
  listType: string,
  orderedIds: string[],
): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()

  const updates = orderedIds.map((id, index) =>
    admin
      .from('user_media_lists')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('profile_id', ctx.profileId)
  )

  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/profil')
  return {}
}

export async function moveToList(
  id: string,
  newListType: string,
): Promise<{ error: string } | Record<string, never>> {
  const ctx = await getAuthContext()
  if (!ctx) return { error: 'Non connecté' }

  const admin = createAdminClient()

  const { data: maxData } = await admin
    .from('user_media_lists')
    .select('sort_order')
    .eq('profile_id', ctx.profileId)
    .eq('list_type', newListType)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxData?.sort_order ?? -1) + 1

  const { error } = await admin
    .from('user_media_lists')
    .update({ list_type: newListType, sort_order: nextOrder })
    .eq('id', id)
    .eq('profile_id', ctx.profileId)

  if (error) return { error: error.message }

  revalidatePath('/profil')
  return {}
}
```

- [ ] **Step 4 : Tests au vert**

```bash
npx jest __tests__/actions/watchlist-dnd.test.ts --no-coverage
```

Expected : `PASS — 6 tests passed`.

- [ ] **Step 5 : Vérifier les types TypeScript**

```bash
npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add app/actions/watchlist.ts __tests__/actions/watchlist-dnd.test.ts
git commit -m "feat(watchlist): add reorderItems and moveToList server actions"
```

---

## Task 3 — Installation @dnd-kit + `DndMedia.tsx`

**Files:**
- Create: `app/profil/DndMedia.tsx`

- [ ] **Step 1 : Installer les dépendances**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected : `added 3 packages` dans la sortie npm.

- [ ] **Step 2 : Créer `app/profil/DndMedia.tsx`**

Ce fichier exporte le type `MediaListItem` (déplacé de `ProfileClient.tsx`) et les trois composants DnD. Créer `app/profil/DndMedia.tsx` :

```typescript
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, rectSortingStrategy, useDroppable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Image from 'next/image'
import Link from 'next/link'

export interface MediaListItem {
  id: string
  tmdb_id: number
  media_type: string
  list_type: string
  rating: number | null
  poster_path: string | null
  title: string | null
  sort_order: number
}

interface SortableMediaItemProps {
  item: MediaListItem
  isEditing: boolean
  onRemove?: (id: string) => void
}

export function SortableMediaItem({ item, isEditing, onRemove }: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { listType: item.list_type },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0" {...attributes} {...listeners}>
      <Link
        href={`/media/${item.media_type}-${item.tmdb_id}`}
        title={item.title ?? undefined}
        className="relative w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors block"
        onClick={isEditing || isDragging ? (e) => e.preventDefault() : undefined}
        draggable={false}
      >
        {item.poster_path ? (
          <Image
            src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
            alt={item.title ?? ''}
            fill
            sizes="(min-width: 640px) 96px, 80px"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
        )}
      </Link>
      {isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); if (item.id) onRemove?.(item.id) }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 transition-colors"
          title={`Retirer ${item.title ?? ''}`}
        >
          ×
        </button>
      )}
    </div>
  )
}

interface DroppableMiniGridProps {
  items: MediaListItem[]
  listType: string
  isDragActive: boolean
  isEditing: boolean
  emptyText: string
  onRemove?: (id: string) => void
}

export function DroppableMiniGrid({
  items,
  listType,
  isDragActive,
  isEditing,
  emptyText,
  onRemove,
}: DroppableMiniGridProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: listType,
    data: { listType },
  })

  const highlight = isDragActive && isOver

  return (
    <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          minHeight: 96,
          borderRadius: 8,
          padding: highlight ? 8 : 2,
          border: highlight ? '2px solid #f97316' : '2px solid transparent',
          background: highlight ? 'rgba(249,115,22,.06)' : 'transparent',
          transition: 'all 0.15s ease',
        }}
      >
        {items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', alignSelf: 'center' }}>
            {emptyText}
          </p>
        ) : (
          items.map(item => (
            <SortableMediaItem
              key={item.id}
              item={item}
              isEditing={isEditing}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </SortableContext>
  )
}

interface GhostPosterProps {
  item: MediaListItem | null
}

export function GhostPoster({ item }: GhostPosterProps) {
  if (!item) return null
  return (
    <div
      className="relative w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--accent)]"
      style={{
        opacity: 0.95,
        transform: 'rotate(3deg) scale(1.05)',
        boxShadow: '0 12px 32px rgba(249,115,22,.45)',
      }}
    >
      {item.poster_path ? (
        <Image
          src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
          alt={item.title ?? ''}
          fill
          sizes="96px"
          className="object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--accent)] text-2xl font-bold">
          {item.title?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add app/profil/DndMedia.tsx package.json package-lock.json
git commit -m "feat(dnd): add DndMedia components and install @dnd-kit"
```

---

## Task 4 — Intégration DnD dans `ProfileClient.tsx` + tri dans `page.tsx`

**Files:**
- Modify: `app/profil/ProfileClient.tsx`
- Modify: `app/profil/page.tsx`

Cette tâche transforme `ProfileClient.tsx` pour utiliser DnD. Lire le fichier entier avant de le modifier.

### Sous-tâche A — Trier par `sort_order` dans `page.tsx`

- [ ] **Step 1 : Ajouter `.order()` à la requête dans `page.tsx`**

Localiser la ligne :
```typescript
admin.from('user_media_lists').select('*').eq('profile_id', profileId),
```

La remplacer par :
```typescript
admin
  .from('user_media_lists')
  .select('*')
  .eq('profile_id', profileId)
  .order('sort_order', { ascending: true })
  .order('created_at', { ascending: true }),
```

### Sous-tâche B — Modifier `ProfileClient.tsx`

**Vue d'ensemble des changements :**
1. Imports : ajouter `useEffect`, DnD imports, `MediaListItem` depuis `DndMedia`, `reorderItems`/`moveToList`
2. Supprimer `interface MediaListItem` (elle est maintenant dans `DndMedia.tsx`)
3. Supprimer la fonction `MediaMiniGrid` en bas du fichier
4. Remplacer `const grouped = ...` par un state `localGrouped`
5. Ajouter `useEffect` de synchronisation
6. Ajouter state `activeItem` + sensors DnD
7. Ajouter `handleDragStart` + `handleDragEnd`
8. Mettre à jour `handleRemoveItem` pour optimistic removal
9. Remplacer les références à `grouped` par `localGrouped`
10. Wrapper les listes avec `DndContext` + `DragOverlay`
11. Remplacer `<MediaMiniGrid>` par `<DroppableMiniGrid>`

- [ ] **Step 2 : Modifier les imports en haut du fichier**

Remplacer :
```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getTitle, type Media } from '@/lib/tmdb'
import Image from 'next/image'
import { removeFromList, deleteList } from '@/app/actions/watchlist'
import { uploadAvatarAction } from '@/app/actions/avatar'
import { changeEmailAction } from '@/app/actions/profile'
import type { Profile } from '@/app/actions/profiles'
```

Par :
```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getTitle, type Media } from '@/lib/tmdb'
import Image from 'next/image'
import { removeFromList, deleteList, reorderItems, moveToList } from '@/app/actions/watchlist'
import { uploadAvatarAction } from '@/app/actions/avatar'
import { changeEmailAction } from '@/app/actions/profile'
import type { Profile } from '@/app/actions/profiles'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { MediaListItem } from './DndMedia'
import { DroppableMiniGrid, GhostPoster } from './DndMedia'
```

- [ ] **Step 3 : Supprimer `interface MediaListItem`**

Supprimer ces lignes (lignes ~15-23 actuellement) :
```typescript
interface MediaListItem {
  id: string
  tmdb_id: number
  media_type: string
  list_type: string
  rating: number | null
  poster_path: string | null
  title: string | null
}
```

Le type est maintenant importé depuis `DndMedia.tsx` (avec `sort_order: number` en plus).

- [ ] **Step 4 : Remplacer `grouped` par `localGrouped` state**

Trouver et remplacer cette ligne dans le corps de `ProfileClient` :
```typescript
  const grouped = lists.reduce((acc, item) => {
    if (!acc[item.list_type]) acc[item.list_type] = []
    acc[item.list_type].push(item)
    return acc
  }, {} as Record<string, MediaListItem[]>)
```

Par :
```typescript
  function buildGrouped(items: MediaListItem[]): Record<string, MediaListItem[]> {
    return items.reduce((acc, item) => {
      if (!acc[item.list_type]) acc[item.list_type] = []
      acc[item.list_type].push(item)
      return acc
    }, {} as Record<string, MediaListItem[]>)
  }

  const [localGrouped, setLocalGrouped] = useState<Record<string, MediaListItem[]>>(
    () => buildGrouped(lists)
  )
  const [activeItem, setActiveItem] = useState<MediaListItem | null>(null)

  useEffect(() => {
    setLocalGrouped(buildGrouped(lists))
  }, [lists])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )
```

- [ ] **Step 5 : Mettre à jour les stats et `customKeys`**

Remplacer les lignes suivantes (elles référencent `grouped`) :
```typescript
  const watchedCount = (grouped['watched'] ?? []).length
  const watchlistCount = (grouped['watchlist'] ?? []).length
  const customKeys = Object.keys(grouped).filter(k => !FIXED_ORDER.includes(k))
```

Par :
```typescript
  const watchedCount = (localGrouped['watched'] ?? []).length
  const watchlistCount = (localGrouped['watchlist'] ?? []).length
  const customKeys = Object.keys(localGrouped).filter(k => !FIXED_ORDER.includes(k))
```

- [ ] **Step 6 : Mettre à jour `handleRemoveItem` avec optimistic removal**

Remplacer :
```typescript
  async function handleRemoveItem(id: string) {
    if (!id) return
    const result = await removeFromList(id)
    if ('error' in result) {
      setActionError((result as { error: string }).error)
      return
    }
    setActionError(null)
    router.refresh()
  }
```

Par :
```typescript
  async function handleRemoveItem(id: string) {
    if (!id) return
    setLocalGrouped(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(i => i.id !== id)
      }
      return next
    })
    const result = await removeFromList(id)
    if ('error' in result) {
      setActionError((result as { error: string }).error)
    } else {
      setActionError(null)
    }
    router.refresh()
  }
```

- [ ] **Step 7 : Ajouter les handlers DnD**

Ajouter après `handleDeleteList` (avant le JSX `return`) :

```typescript
  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    const listType = event.active.data.current?.listType as string
    const item = (localGrouped[listType] ?? []).find(i => i.id === id) ?? null
    setActiveItem(item)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    if (!over) return

    const activeId = active.id as string
    const activeListType = active.data.current?.listType as string
    const overListType = (over.data.current?.listType ?? over.id) as string

    if (activeListType === overListType) {
      const items = localGrouped[activeListType] ?? []
      const oldIndex = items.findIndex(i => i.id === activeId)
      if (oldIndex < 0) return
      const overId = over.id as string
      let newIndex = items.findIndex(i => i.id === overId)
      if (newIndex < 0) newIndex = items.length - 1
      if (oldIndex === newIndex) return

      const reordered = arrayMove(items, oldIndex, newIndex)
      setLocalGrouped(prev => ({ ...prev, [activeListType]: reordered }))
      reorderItems(activeListType, reordered.map(i => i.id)).then(result => {
        if ('error' in result) setActionError((result as { error: string }).error)
      })
    } else {
      const snapshot = { ...localGrouped }
      const movedItem = (localGrouped[activeListType] ?? []).find(i => i.id === activeId)
      if (!movedItem) return

      setLocalGrouped(prev => ({
        ...prev,
        [activeListType]: (prev[activeListType] ?? []).filter(i => i.id !== activeId),
        [overListType]: [...(prev[overListType] ?? []), { ...movedItem, list_type: overListType }],
      }))

      moveToList(activeId, overListType).then(result => {
        if ('error' in result) {
          setActionError((result as { error: string }).error)
          setLocalGrouped(snapshot)
        }
      })
    }
  }
```

- [ ] **Step 8 : Wrapper le contenu principal avec DndContext**

Dans le JSX, localiser la section `{/* Listes fixes */}` et les `{/* Listes custom */}`. Les wraper dans un `<DndContext>` avec `<DragOverlay>`. 

Remplacer le bloc `{/* Contenu principal */}` (depuis `<main className="flex-1 min-w-0">` jusqu'à `</main>`) par :

```tsx
        {/* Contenu principal */}
        <main className="flex-1 min-w-0">
          {actionError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
              {actionError}
            </div>
          )}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Listes fixes */}
            {FIXED_ORDER.map(key => (
              <Section
                key={key}
                title={`${listLabel(key)} (${(localGrouped[key] ?? []).length})`}
                isEditing={editingList === key}
                onToggleEdit={() => {
                  if (editingList === key) {
                    setEditingList(null)
                    setConfirmDelete(null)
                  } else {
                    setEditingList(key)
                  }
                }}
                canDelete={false}
              >
                <DroppableMiniGrid
                  items={localGrouped[key] ?? []}
                  listType={key}
                  isDragActive={activeItem !== null}
                  isEditing={editingList === key}
                  emptyText={
                    key === 'watchlist'
                      ? "Aucun film ou série à voir. Ajoutez des médias depuis la page d'accueil."
                      : 'Aucun média marqué comme déjà vu.'
                  }
                  onRemove={handleRemoveItem}
                />
              </Section>
            ))}

            {/* Listes custom */}
            {customKeys.map(key => (
              <Section
                key={key}
                title={`${listLabel(key)} (${(localGrouped[key] ?? []).length})`}
                isEditing={editingList === key}
                onToggleEdit={() => {
                  if (editingList === key) {
                    setEditingList(null)
                    setConfirmDelete(null)
                  } else {
                    setEditingList(key)
                  }
                }}
                canDelete={true}
                confirmingDelete={confirmDelete === key}
                onRequestDelete={() => setConfirmDelete(key)}
                onCancelDelete={() => setConfirmDelete(null)}
                onConfirmDelete={() => handleDeleteList(key)}
              >
                <DroppableMiniGrid
                  items={localGrouped[key] ?? []}
                  listType={key}
                  isDragActive={activeItem !== null}
                  isEditing={editingList === key}
                  emptyText="Cette liste est vide."
                  onRemove={handleRemoveItem}
                />
              </Section>
            ))}

            <DragOverlay>
              <GhostPoster item={activeItem} />
            </DragOverlay>
          </DndContext>

          {/* Recommandations */}
          <Section
            title="Recommandations"
            isEditing={false}
            onToggleEdit={() => {}}
            canDelete={false}
            showEditButton={false}
          >
            {recommendations.length === 0 ? (
              <p className="text-[var(--text-muted)] text-xs">Marquez des médias comme &quot;Déjà vu&quot; pour recevoir des recommandations.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {recommendations.map(media => (
                  <Link
                    key={media.id}
                    href={`/media/${media.media_type ?? 'movie'}-${media.id}`}
                    className="relative w-20 sm:w-24 aspect-[2/3] rounded overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors shrink-0"
                    title={getTitle(media)}
                  >
                    {media.poster_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w200${media.poster_path}`}
                        alt={getTitle(media)}
                        fill
                        sizes="(min-width: 640px) 96px, 80px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </main>
```

- [ ] **Step 9 : Supprimer `MediaMiniGrid` en bas du fichier**

Supprimer la fonction `MediaMiniGrid` et son interface (lignes ~555-599 dans le fichier actuel) :

```typescript
interface MediaMiniGridProps {
  items: MediaListItem[]
  isEditing?: boolean
  onRemove?: (id: string) => void
}

function MediaMiniGrid({ items, isEditing = false, onRemove }: MediaMiniGridProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map(item => (
        // ... tout le contenu ...
      ))}
    </div>
  )
}
```

- [ ] **Step 10 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected : aucune erreur. Si des erreurs sur `MediaListItem.sort_order` → vérifier que le type dans `DndMedia.tsx` a bien `sort_order: number` et que le cast dans `page.tsx` passe les données correctement.

- [ ] **Step 11 : Lint**

```bash
npm run lint
```

Expected : pas d'erreurs. Si warning ESLint sur `buildGrouped` défini dans le rendu : déplacer la fonction hors du composant (juste au-dessus de la définition du composant).

- [ ] **Step 12 : Build**

```bash
npm run build
```

Expected : `✓ Compiled successfully`.

- [ ] **Step 13 : Commit**

```bash
git add app/profil/ProfileClient.tsx app/profil/page.tsx
git commit -m "feat(profil): integrate drag-and-drop on media lists with sort persistence"
```

---

## Self-review

**Couverture spec → code :**

| Exigence spec | Tâche | OK |
|---|---|---|
| `sort_order INTEGER` en base | Task 1 migration | ✅ |
| `reorderItems` Server Action | Task 2 | ✅ |
| `moveToList` Server Action | Task 2 | ✅ |
| Tests pour les 2 actions | Task 2 | ✅ |
| `SortableMediaItem` avec `useSortable` | Task 3 `DndMedia.tsx` | ✅ |
| `DroppableMiniGrid` avec `useDroppable` + `SortableContext` | Task 3 `DndMedia.tsx` | ✅ |
| `GhostPoster` pour `DragOverlay` | Task 3 `DndMedia.tsx` | ✅ |
| Ghost style : `rotate(3deg) scale(1.05) box-shadow orange` | Task 3 `GhostPoster` | ✅ |
| Drop zone highlight orange sur hover | Task 3 `DroppableMiniGrid` | ✅ |
| Optimistic update intra-liste | Task 4 `handleDragEnd` | ✅ |
| Optimistic update cross-liste avec revert | Task 4 `handleDragEnd` | ✅ |
| Optimistic remove | Task 4 `handleRemoveItem` | ✅ |
| `useEffect` sync quand `lists` prop change | Task 4 | ✅ |
| Long-press mobile (250ms/5px TouchSensor) | Task 4 `useSensors` | ✅ |
| Desktop 5px drag distance (MouseSensor) | Task 4 `useSensors` | ✅ |
| Sort by `sort_order ASC, created_at ASC` | Task 4 `page.tsx` | ✅ |

**Cohérence des types :** `MediaListItem` est défini UNE seule fois dans `DndMedia.tsx`, importé partout ailleurs. `sort_order: number` est présent (migration + select `'*'`).

**Placeholder scan :** aucun TBD ou TODO dans le plan.
