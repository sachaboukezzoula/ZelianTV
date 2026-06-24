# Spec Fonctionnelle — listes-personnelles [DRAFT — à valider par le dev]

| Champ      | Valeur                  |
|------------|-------------------------|
| Module     | listes-personnelles     |
| Version    | 0.1.0                   |
| Date       | 2026-06-24              |
| Auteur     | retro-documenter        |
| Statut     | DRAFT                   |
| Source     | Rétro-ingénierie        |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-002](../../adr/RETRO-002-rls-user-media-lists.md) | RLS et isolation utilisateur sur user_media_lists | Documenté (rétro) |
| [RETRO-003](../../adr/RETRO-003-unicite-media-par-liste.md) | Unicité d'un média par utilisateur (une liste à la fois) | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module de listes personnelles permet à chaque utilisateur authentifié de cataloguer les médias (films et séries) qu'il consulte sur ZelianTV. L'objectif est de fournir un suivi personnel : savoir ce qu'on a vu, ce qu'on veut voir, et organiser ses envies dans des listes nommées librement.

Ce module est le point de persistance de l'engagement utilisateur sur la plateforme.

## Règles métier (déduites du code)

1. **Deux listes fixes par utilisateur** : `watchlist` (labellisée "À voir") et `watched` (labellisée "Déjà vu"). Ces listes ne peuvent pas être supprimées.

2. **Listes custom** : un utilisateur peut créer autant de listes nommées librement qu'il le souhaite. Le nom est saisi directement dans le dropdown au moment de l'ajout, sans étape de création préalable.

3. **Un média dans une seule liste à la fois** : la contrainte UNIQUE `(user_id, tmdb_id, media_type)` en base de données garantit qu'un même média ne peut pas être dans plusieurs listes simultanément. Ajouter un média déjà présent dans une liste le déplace vers la nouvelle liste (comportement upsert).

4. **Retrait d'un média** : si l'utilisateur sélectionne la liste dans laquelle le média est déjà présent, le média est retiré de toutes les listes (suppression de la ligne).

5. **Accès réservé aux utilisateurs connectés** : un utilisateur non authentifié voit à la place du bouton un lien vers `/profil` pour se connecter.

6. **Mise à jour optimiste** : l'interface reflète immédiatement l'action de l'utilisateur sans attendre la confirmation du serveur. Aucun rollback n'est effectué en cas d'échec de la Server Action.

7. **Synchronisation des noms de listes** : le `ListsProvider` charge la liste complète des noms de listes de l'utilisateur au montage, et met à jour la liste locale lors de la création d'une nouvelle liste custom. Cela évite les appels serveur répétés entre composants `WatchlistButton` sur une même page.

8. **Suppression d'une liste custom** : une liste custom peut être supprimée depuis la page profil. La suppression supprime également tous les médias de cette liste. Les listes fixes (`watchlist`, `watched`) ne peuvent pas être supprimées depuis le profil.

9. **Note de compatibilité BDD** : la migration `001_init.sql` pose une contrainte `CHECK (list_type IN ('watchlist', 'watched'))` sur la colonne `list_type`. Cette contrainte est incompatible avec les listes custom — les upserts sur des noms personnalisés échoueraient en production si la contrainte est active. La résolution de cette dette est documentée en spec-technique.md.

## Cas d'usage (déduits)

### CU-001 — Ajouter un média à une liste
**Acteur** : utilisateur authentifié
**Précondition** : l'utilisateur est sur une page affichant un `WatchlistButton` (page d'accueil, fiche détail)
**Flux** :
1. L'utilisateur clique sur le bouton "Ajouter à ma liste"
2. Un dropdown s'ouvre avec les deux listes fixes et les éventuelles listes custom de l'utilisateur
3. L'utilisateur sélectionne une liste
4. L'état local du bouton se met à jour immédiatement (optimistic update) : le bouton passe à l'état "Ajouté — [nom de la liste]"
5. La Server Action `toggleWatchlist` est appelée en arrière-plan et persiste l'entrée dans Supabase

### CU-002 — Retirer un média d'une liste
**Flux** :
1. L'utilisateur clique sur le bouton "Ajouté — [nom de la liste]" (état actif)
2. Le dropdown s'ouvre avec la liste actuelle cochée
3. L'utilisateur clique sur "Retirer de la liste" ou re-sélectionne la liste active
4. Le média est retiré immédiatement côté client
5. La Server Action supprime la ligne dans `user_media_lists`

### CU-003 — Créer une liste custom et y ajouter un média
**Flux** :
1. L'utilisateur ouvre le dropdown d'un `WatchlistButton`
2. Il clique sur "Créer une liste"
3. Un champ de saisie inline apparaît avec focus automatique
4. L'utilisateur saisit un nom et valide (touche Entrée ou bouton "OK")
5. La nouvelle liste est créée et le média y est ajouté simultanément (un seul appel `toggleWatchlist`)
6. Le nom de la nouvelle liste est propagé dans le `ListsProvider` pour être disponible dans les autres `WatchlistButton` de la page

### CU-004 — Consulter et gérer ses listes sur le profil
**Acteur** : utilisateur authentifié sur `/profil`
**Flux** :
1. La page profil (Server Component) charge toutes les entrées de `user_media_lists` pour l'utilisateur
2. Les médias sont groupés par `list_type` et affichés en sections
3. Chaque section affiche une grille de posters miniatures cliquables
4. L'utilisateur peut passer en mode "Modifier" pour retirer des médias individuellement (croix rouge sur les posters)
5. Pour une liste custom en mode "Modifier", l'utilisateur peut supprimer toute la liste

### CU-005 — Supprimer une liste custom depuis le profil
**Flux** :
1. L'utilisateur clique "Modifier" sur une section de liste custom
2. Le bouton "Supprimer la liste" apparaît
3. L'utilisateur clique, une confirmation inline s'affiche
4. Après confirmation, `deleteList(listType)` est appelée — supprime toutes les lignes de cette liste

## Dépendances

- `ListsProvider` (Context) — doit englober tous les composants `WatchlistButton` dans le layout (ou la page)
- `app/actions/watchlist.ts` — Server Actions pour la persistance
- `lib/supabase/admin.ts` — client service_role pour bypasser le RLS dans les Server Actions
- `lib/supabase/server.ts` — client anon pour la vérification d'identité
- Table `user_media_lists` (Supabase/PostgreSQL) — stockage des entrées
- Page profil (`app/profil/page.tsx` + `ProfileClient.tsx`) — affichage et gestion des listes

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Comportement en cas d'erreur serveur lors d'un optimistic update** : le code ne rollback pas l'état local. Est-ce un choix délibéré de l'UX (fluidité > cohérence) ou une dette à corriger ?
- **Contrainte BDD `CHECK (list_type IN ('watchlist', 'watched'))` vs listes custom** : les upserts de listes custom échoueraient si cette contrainte est active dans l'instance Supabase de production. Valider si la migration a été modifiée manuellement en production ou si la contrainte est désactivée.
- **Champ `rating` dans `user_media_lists`** : la colonne `rating` (note de 1 à 10) existe en BDD mais n'est ni lue ni écrite par le code applicatif. Fonctionnalité prévue ou abandonnée ?
- **Portée du `ListsProvider`** : le provider doit englober tous les `WatchlistButton`. Valider où il est monté dans le layout pour confirmer qu'aucun `WatchlistButton` ne s'exécute hors de son contexte.
