# Drag & Drop — Listes de médias (ProfileClient) Design Spec

**Goal:** Permettre à l'utilisateur de réordonner les films au sein d'une liste et de les déplacer entre listes (ex: "À voir" → "Déjà vu") par glisser-déposer, sur desktop et mobile.

**Architecture:** Ghost drag via `@dnd-kit`, `sort_order` persisté en base. Mise à jour optimiste côté client, Server Action en arrière-plan.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, Next.js Server Actions, Supabase PostgreSQL.

---

## 1. Base de données

### Nouvelle colonne `sort_order`

```sql
-- supabase/migrations/003_add_sort_order.sql
ALTER TABLE user_media_lists
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
```

Pas de backfill nécessaire : `DEFAULT 0` convient pour les lignes existantes (elles seront toutes au même niveau, l'ordre sera déterminé par `created_at` au premier chargement).

### Tri des items

Dans `app/profil/page.tsx`, les listes sont récupérées et triées :

```sql
SELECT * FROM user_media_lists
WHERE profile_id = $profileId
ORDER BY sort_order ASC, created_at ASC
```

Le double tri `sort_order, created_at` garantit un ordre stable pour les items à `sort_order = 0`.

---

## 2. Server Actions

Deux nouvelles fonctions dans `app/actions/watchlist.ts` :

### `reorderItems(listType, orderedIds)`

Met à jour `sort_order` pour tous les items d'une liste après un réordonnement intra-liste. Reçoit un tableau d'IDs dans le nouvel ordre.

```typescript
export async function reorderItems(
  listType: string,
  orderedIds: string[]   // IDs dans le nouvel ordre
): Promise<{ error: string } | {}>
```

Implémentation : boucle sur `orderedIds`, met à jour chaque item avec `sort_order = index`.

### `moveToList(id, newListType)`

Déplace un item vers une autre liste. Change `list_type` et remet `sort_order` à la fin de la liste cible (MAX + 1).

```typescript
export async function moveToList(
  id: string,
  newListType: string
): Promise<{ error: string } | {}>
```

Les deux fonctions vérifient l'appartenance du profil via `getAuthContext()` avant toute mutation.

---

## 3. Composant — ProfileClient.tsx

### Bibliothèque

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Stratégie de tri

Utiliser `rectSortingStrategy` (de `@dnd-kit/sortable`) au lieu de la stratégie par défaut. C'est la stratégie conçue pour les grilles `flex-wrap` : elle calcule les positions à partir des rectangles réels des éléments plutôt que d'un axe linéaire.

### Structure DnD

```
<DndContext sensors={[mouse, touch]} onDragStart onDragEnd>
  <DragOverlay>
    <GhostPoster />   ← image semi-transparente qui suit le doigt
  </DragOverlay>

  <Section listType="watchlist">          ← useDroppable (highlight orange quand survolé)
    <SortableContext items={ids}>
      <SortableMediaItem />               ← useSortable sur chaque affiche
    </SortableContext>
  </Section>

  <Section listType="watched">
    ...
  </Section>
</DndContext>
```

### Sensors

- `PointerSensor` : délai 250ms + tolérance 5px — active le drag sur mobile (long press) sans bloquer les taps
- `MouseSensor` : distance 5px — active sur desktop sans bloquer les clics normaux

### États visuels pendant le drag

| Élément | Style |
|---------|-------|
| Item original (en cours de drag) | `opacity: 0.3` |
| Ghost (DragOverlay) | `opacity: 0.95`, `rotate(3deg)`, `scale(1.05)`, ombre orange |
| Slot de dépôt intra-liste | bordure dashed `#f97316`, fond `rgba(249,115,22,.08)` |
| Section cible (cross-list) | bordure `2px solid #f97316`, fond `rgba(249,115,22,.06)`, label "Déposer ici" |

### Logique `onDragEnd`

```
si activeContainer === overContainer :
  → réordonnement intra-liste
  → mise à jour optimiste du state local (arrayMove)
  → appel reorderItems(listType, newOrderedIds)

si activeContainer !== overContainer :
  → déplacement cross-liste
  → mise à jour optimiste du state local (retirer de l'ancienne liste, ajouter à la fin de la nouvelle)
  → appel moveToList(id, newListType)

si erreur Server Action :
  → revert du state local à l'état précédent
  → affichage de l'erreur existante (actionError)
```

### Disponibilité du drag

Le drag est **toujours disponible** (pas besoin d'activer le mode "Modifier"). Les boutons "Modifier" existants (mode suppression d'items) restent indépendants. La distance d'activation (5px mouse / 250ms touch) empêche les drags accidentels lors d'un simple tap ou clic.

---

## 4. Tri initial

Au premier chargement, les items ont tous `sort_order = 0`. L'ordre affiché est déterminé par `created_at ASC` (double clé de tri côté Supabase). Le premier drag-and-drop persiste un ordre explicite.

---

## 5. Périmètre

**Inclus :**
- Réordonnement intra-liste (watchlist, watched, listes custom)
- Déplacement cross-liste entre n'importe quelles listes
- Persistance via `sort_order` en base
- Support mobile (long press 250ms) et desktop
- Ghost drag + slot de dépôt + surbrillance section cible
- Mise à jour optimiste + revert en cas d'erreur

**Exclu :**
- Drag vers une liste qui n'est pas encore visible à l'écran (scroll automatique non requis)
- Création d'une nouvelle liste par drag
- Drag depuis la page d'accueil vers le profil
