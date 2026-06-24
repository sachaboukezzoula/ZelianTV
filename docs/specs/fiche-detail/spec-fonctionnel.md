# Spec Fonctionnelle — fiche-detail [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | fiche-detail        |
| Version    | 0.1.0               |
| Date       | 2026-06-24          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Catégorie | Statut |
|-----|-------|-----------|--------|
| [RETRO-001](../../adr/RETRO-001-tmdb-fetch-cache.md) | Cache TMDB via fetch natif Next.js (revalidate 1h) | DB-STRATEGY | Documenté (rétro) |

> La fiche détail consomme `getMediaDetail`, `getVideos` et `getCredits` — trois fonctions de `lib/tmdb.ts` couvertes par RETRO-001. Aucune décision architecturale propre à cette feature n'a passé les filtres de la politique ADR v2.3.0 (tous les candidats évalués ont été rejetés — voir rapport ADR en fin de documentation).
>
> Pour régénérer ce tableau via adr-linker :
> ```bash
> node "C:/Users/linme/.claude/plugins/cache/zelian-marketplace/zelian-framework/2.5.8/hooks/lib/adr-linker.js" --table fiche-detail
> ```

---

## Contexte et objectif

La fiche détail est la page de consultation d'un média individuel (film ou série) de ZelianTV. Elle est accessible depuis le catalogue, le HeroBanner, la SearchBar ou toute autre surface qui expose un lien vers un média. Elle centralise toutes les informations enrichies d'un titre : visuel, métadonnées, synopsis, trailer et distribution — et constitue le point d'entrée vers l'ajout aux listes personnelles (watchlist).

## Règles métier (déduites du code)

1. **Schéma d'URL dual** : l'URL d'une fiche obéit au format `movie-<tmdbId>` ou `tv-<tmdbId>`. Toute URL ne correspondant pas à ce pattern (`^(movie|tv)-(\d+)$`) déclenche une page 404 (`notFound()`).
2. **Fetch parallèle obligatoire** : les trois appels TMDB — détail du média, vidéos et crédits — sont toujours lancés en parallèle (`Promise.all`). Les erreurs de chacun sont isolées : une absence de vidéos ou de crédits n'empêche pas l'affichage de la fiche.
3. **Priorité sur le premier trailer YouTube** : parmi les vidéos retournées par TMDB, seules les entrées de type `Trailer` hébergées sur `YouTube` sont retenues. Le premier résultat est utilisé comme trailer principal. Il n'y a pas de sélection manuelle ni de fallback sur un autre type de vidéo.
4. **Distribution limitée à 10 acteurs** : le cast est tronqué à 10 membres côté `lib/tmdb.ts` (`data.cast.slice(0, 10)`), pas côté composant.
5. **Durée calculée selon le type** : pour un film (`movie`), la durée est calculée en heures et minutes (`Xh Ymin`) depuis `media.runtime`. Pour une série (`tv`), la durée affichée est celle d'un épisode depuis `media.episode_run_time[0]` au format `~Xmin / ép.`. Si le champ est absent, la durée n'est pas affichée.
6. **Layout adaptatif selon le breakpoint** : deux layouts JSX distincts coexistent dans la même page — mobile (< 1024 px) et desktop (>= 1024 px via `lg:`). Ils sont tous deux rendus côté serveur et différenciés par classes CSS Tailwind (`lg:hidden` / `hidden lg:grid`).
7. **Comportement du trailer selon le layout** :
   - Mobile : le trailer est intégré directement sous le synopsis via `YoutubePlayer` (lecture différée au clic sur le bouton play).
   - Desktop : le poster est rendu via `PosterPlayer`. Lorsqu'un trailer est disponible, le poster devient cliquable et ouvre le trailer dans une modale en overlay. Sans trailer, le poster est non cliquable et un message "Aucun trailer disponible" apparaît sous lui.
8. **Dégradé visuel conditionnel** : un backdrop pleine largeur est affiché si `backdrop_path` est non null. En cas d'absence, un bloc de couleur unie `#1c1c1c` le remplace.
9. **Fallback initiales pour les acteurs sans photo** : si `profile_path` est null pour un membre du cast, ses initiales sont extraites (`prénom[0] + nom[0]`) et affichées dans l'avatar circulaire.
10. **Métadonnées OpenGraph dynamiques** : la page exporte une fonction `generateMetadata` qui effectue un appel `getMediaDetail` indépendant pour générer le titre de page et la description OpenGraph. En cas d'échec ou d'URL invalide, les métadonnées retournent un objet vide (`{}`).
11. **L'ajout aux listes est conditionnel à la connexion** : le `WatchlistButton` est toujours rendu, mais il vérifie lui-même si l'utilisateur est connecté via `getWatchlistData`. Si non connecté, le bouton reste inactif.

## Cas d'usage (déduits)

### CU-001 — Consulter la fiche d'un film
L'utilisateur accède à `/media/movie-12345`. La page parse l'URL, identifie le type `movie` et l'id TMDB `12345`, lance trois appels TMDB en parallèle (détail, vidéos, crédits). Le rendu affiche le backdrop, le poster, le titre, l'année, la durée, les genres, la note TMDB, le synopsis, le trailer (si disponible) et les 10 premiers acteurs, dans un layout adapté au viewport.

### CU-002 — Consulter la fiche d'une série
Identique à CU-001 avec le type `tv`. La durée affichée est `~Xmin / ép.` depuis `episode_run_time`. Le segment d'URL est de la forme `/media/tv-12345`.

### CU-003 — URL invalide
L'utilisateur accède à `/media/film-abc` (format non reconnu). La fonction `parseId` retourne `null`, la page appelle `notFound()` et Next.js rend la page 404.

### CU-004 — Média introuvable sur TMDB
L'URL est valide (`movie-99999999`) mais TMDB retourne une erreur. `getMediaDetail` lance une exception, le catch retourne `null`, la page appelle `notFound()`.

### CU-005 — Voir le trailer sur desktop
L'utilisateur desktop survole le poster : un overlay apparaît avec un bouton play. Il clique, une modale en plein écran s'ouvre avec l'iframe YouTube en autoplay. La fermeture se fait via le bouton "Fermer", le clic en dehors de la modale ou la touche Échap.

### CU-006 — Voir le trailer sur mobile
L'utilisateur mobile voit un bloc `YoutubePlayer` sous le synopsis avec un bouton play. Au clic, l'iframe YouTube se charge en remplacement du bouton (lazy-load), avec autoplay.

### CU-007 — Ajouter le média à une liste
L'utilisateur connecté clique sur `WatchlistButton`. Un dropdown s'ouvre avec ses listes (À voir, Déjà vu, listes custom). Il sélectionne une liste : le statut est mis à jour optimistiquement côté client, la `Server Action` `toggleWatchlist` est appelée en arrière-plan.

## Dépendances

- `lib/tmdb.ts` — `getMediaDetail`, `getVideos`, `getCredits`, `backdropUrl`, `posterUrl`, `getTitle`, `getYear` (type `MediaType`)
- `components/YoutubePlayer.tsx` — rendu du trailer sur mobile (lazy-load)
- `components/PosterPlayer.tsx` — poster cliquable avec modale trailer sur desktop
- `components/WatchlistButton.tsx` — ajout/retrait d'un média dans les listes de l'utilisateur
- TMDB API v3 — endpoints `/movie/{id}`, `/tv/{id}`, `/movie/{id}/videos`, `/tv/{id}/videos`, `/movie/{id}/credits`, `/tv/{id}/credits`
- ADR RETRO-001 — la mise en cache 1h de tous les appels TMDB s'applique à cette feature

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Choix du premier trailer** : le code prend systématiquement `videos[0]`. Il n'est pas clair si TMDB retourne les trailers déjà triés par pertinence, ou s'il faudrait filtrer davantage (ex. préférer le trailer officiel en VF).
- **Note "critique" vs "public"** : le desktop affiche deux blocs de note ("Note critique" et "Note public") qui affichent tous deux `media.vote_average`. Il s'agit probablement d'un placeholder — la distinction entre note presse et note publique n'est pas implémentée.
- **Langue des métadonnées** : `buildUrl` force `language=fr-FR`. Il n'est pas défini si un fallback en anglais est attendu quand TMDB ne dispose pas de données en français pour un média.
- **Comportement sans trailer sur mobile** : si `trailer` est `undefined`, le bloc `YoutubePlayer` n'est pas rendu sur mobile. Il n'y a pas de message d'information à l'utilisateur dans ce cas (contrairement au desktop qui affiche "Aucun trailer disponible").
