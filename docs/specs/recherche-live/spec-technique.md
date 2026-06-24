# Spec Technique — recherche-live

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | recherche-live      |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

La feature est composée de trois couches distinctes :

1. **Composant client `SearchBar`** — gère l'état local (saisie, résultats, dropdown),
   le debounce, et le rendu du dropdown. Client Component (`'use client'`).
2. **Route Handler `/api/search`** — proxy serveur vers TMDB. Reçoit le paramètre
   `q`, délègue à `searchMulti`, plafonne à 8 résultats, et absorbe les erreurs TMDB.
3. **Client TMDB `lib/tmdb.ts`** — fonction `searchMulti` qui appelle TMDB
   `/search/multi` et filtre les résultats non-film/série.

La `Navbar` orchestre la visibilité de `SearchBar` : positionnement centré sur
desktop (`hidden md:flex`), dans le menu hamburger sur mobile.

**Flux de données :**
```
[Utilisateur frappe] → [SearchBar debounce 300ms] → [fetch /api/search?q=]
  → [Route Handler] → [searchMulti TMDB /search/multi]
  → [filtrage movie|tv] → [slice 0..7]
  → [JSON → SearchBar] → [dropdown rendu]
```

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `components/SearchBar.tsx` | Client Component — debounce, fetch, rendu dropdown | ~83 |
| `app/api/search/route.ts` | Route Handler GET `/api/search?q=` — proxy TMDB | ~13 |
| `lib/tmdb.ts` | Fonction `searchMulti`, type `Media`, helpers `posterUrl`, `getTitle` | 150-153 (searchMulti) ; 1-66 (types et helpers) |
| `components/Navbar.tsx` | Intégration `SearchBar`, layout responsive | ~87 |

## Schéma BDD

Non applicable. Cette feature ne lit ni n'écrit en base de données. Tous les
résultats proviennent de l'API TMDB externe.

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/search?q=<string>` | Recherche TMDB multi (films + séries), max 8 résultats | Aucune — endpoint public |

**Paramètres :**
- `q` (string) — terme de recherche. Si absent ou longueur < 2, retourne `[]` immédiatement.

**Réponse :**
- 200 : `Media[]` (0 à 8 items), `Content-Type: application/json`
- 500 : `[]` (tableau vide, l'erreur TMDB est swallowed)

**Appel TMDB sous-jacent :**
`GET https://api.themoviedb.org/3/search/multi?api_key=...&language=fr-FR&query=<q>`

## Patterns identifiés

### Debounce maison (inline dans SearchBar)

La fonction `debounce` est définie localement dans `SearchBar.tsx` (lignes 8-13),
non importée d'une lib externe. Elle prend `fn` et `delay`, utilise `setTimeout` /
`clearTimeout`. Le résultat est mémoïsé via `useCallback` avec un tableau de
dépendances vide pour éviter la recréation à chaque rendu.

**Note technique** : le debounce est recréé si le composant est démonté/remonté
(ex. ouverture/fermeture du menu hamburger mobile), mais cela n'a pas de conséquence
visible car la saisie est aussi réinitialisée.

### Fermeture au clic extérieur via ref + document listener

`useRef` sur le container principal. Un listener `mousedown` sur `document` compare
`ref.current.contains(e.target)` pour détecter les clics hors zone et fermer le
dropdown. Le listener est enregistré/désenregistré via `useEffect` avec cleanup.

### Proxy Route Handler pour isolation de la clé TMDB_API_KEY

`TMDB_API_KEY` est une variable d'environnement serveur uniquement (non préfixée
`NEXT_PUBLIC_`). La SearchBar ne peut pas appeler TMDB directement depuis le
navigateur sans exposer la clé. Le Route Handler `/api/search` joue le rôle de
proxy : il reçoit la saisie, appelle TMDB côté serveur, et retourne les résultats
filtrés. Ce pattern est le seul moyen d'utiliser `TMDB_API_KEY` dans un contexte
déclenché par un Client Component.

### Filtre media_type côté serveur

TMDB `/search/multi` retourne des résultats de type `movie`, `tv`, et `person`.
La fonction `searchMulti` filtre pour ne conserver que `movie` et `tv`. Ce filtre
est appliqué côté serveur (dans le Route Handler) avant la sérialisation JSON.

### Cache TMDB non applicable sur la recherche

La fonction `fetchTMDB` générique applique `{ next: { revalidate: 3600 } }` sur
tous les appels. `searchMulti` utilise `fetchTMDB`, donc la recherche est
techniquement mise en cache 1h par Next.js Data Cache — mais avec une clé de cache
incluant le terme de recherche. En pratique, la diversité infinie des termes rend
ce cache inefficace pour la recherche (faible taux de hit). Aucune configuration
`cache: 'no-store'` n'a été ajoutée pour désactiver explicitement le cache sur cet
endpoint, ce qui est une légère anomalie.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `__tests__/lib/tmdb.test.ts` | `posterUrl`, `backdropUrl`, `getTitle`, `getYear` — helpers utilisés par SearchBar | Existant |
| — | `searchMulti` (la fonction centrale de la feature) | Absent |
| — | Composant `SearchBar` (debounce, fetch, rendu dropdown) | Absent |
| — | Route Handler `/api/search` (paramètres, filtrage, plafond 8) | Absent |

La feature ne dispose d'aucun test propre. Les helpers TMDB utilisés par le dropdown
(`posterUrl`, `getTitle`) sont couverts indirectement par `tmdb.test.ts`, mais ni
la logique de debounce, ni le filtrage serveur, ni le comportement du dropdown ne
sont testés.
