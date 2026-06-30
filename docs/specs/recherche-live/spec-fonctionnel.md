# Spec Fonctionnelle — recherche-live [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | recherche-live      |
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

Aucun ADR RETRO n'a été créé pour cette feature. Tous les candidats ont été rejetés
par la politique ADR v2.3.0 (voir le rapport de filtrage en fin de document et
`docs/specs/recherche-live/spec-technique.md` pour les décisions documentées).

---

## Contexte et objectif

La feature recherche-live permet à l'utilisateur de trouver un film ou une série
directement depuis la barre de navigation, sans quitter la page courante. La recherche
interroge en temps réel la base TMDB et affiche les résultats dans un dropdown
superposé à la page.

L'objectif est de minimiser la friction : aucun appui sur Entrée, aucune page de
résultats dédiée. Le clic sur un résultat navigue directement vers la fiche détail
du média.

## Règles métier (déduites du code)

1. La recherche ne se déclenche pas si la saisie contient moins de 2 caractères —
   les chaînes courtes produiraient des résultats TMDB trop bruités.
2. La recherche est déclenchée 300 ms après la dernière frappe (debounce), afin
   d'éviter un appel TMDB à chaque caractère tapé.
3. Seuls les films (`media_type = movie`) et les séries (`media_type = tv`) sont
   retournés. Les résultats de type "personne" retournés par TMDB sont filtrés côté
   serveur.
4. Le dropdown affiche au maximum 8 résultats.
5. Chaque résultat affiche : miniature du poster (format w92), titre, type (Film /
   Série), et note moyenne arrondie à 1 décimale (★ X.X).
6. Cliquer sur un résultat navigue vers `/media/<type>-<tmdbId>`, ferme le dropdown
   et vide le champ de saisie.
7. Cliquer en dehors du dropdown (sur n'importe quel élément de la page) le ferme.
8. La recherche est accessible sur desktop (barre centrée dans la Navbar) et sur
   mobile (dans le menu hamburger déroulant).

## Cas d'usage (déduits)

### CU-001 — Recherche d'un film ou d'une série

**Acteur :** utilisateur (authentifié ou non)
**Précondition :** la Navbar est visible (toutes les pages)

**Flux principal :**
1. L'utilisateur clique dans la barre de recherche.
2. Il saisit au moins 2 caractères.
3. Après 300 ms sans nouvelle frappe, la SearchBar appelle `/api/search?q=<saisie>`.
4. Le Route Handler interroge TMDB `/search/multi`, filtre les résultats non-film/série,
   et retourne les 8 premiers.
5. Le dropdown s'affiche avec les résultats.
6. L'utilisateur clique sur un résultat.
7. Il est redirigé vers `/media/<type>-<id>`.

**Variante — saisie < 2 caractères :**
Aucun appel réseau. Le dropdown reste vide ou fermé.

**Variante — aucun résultat TMDB :**
Le dropdown reste vide (fermé car `results.length === 0`).

**Variante — erreur réseau ou TMDB 5xx :**
Le Route Handler retourne un tableau vide avec status 500. Côté client, `res.ok`
est faux, `setResults` n'est pas appelé. Le dropdown ne s'affiche pas. Aucun
message d'erreur visible à l'utilisateur.

### CU-002 — Fermeture du dropdown

**Flux :**
1. L'utilisateur clique en dehors de la zone SearchBar (ref container).
2. Le listener `mousedown` sur `document` détecte un clic hors zone.
3. Le dropdown se ferme (`setOpen(false)`).

## Dépendances

- `lib/tmdb.ts` — fonctions `searchMulti`, `posterUrl`, `getTitle`, type `Media`
- `/api/search` — Route Handler Next.js (proxy TMDB)
- TMDB API v3, endpoint `/search/multi`
- `components/Navbar.tsx` — point d'intégration, gère la visibilité desktop/mobile

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Comportement en cas d'erreur visible** : lorsque TMDB est indisponible, le
  dropdown reste simplement vide. Il n'est pas établi si c'est un choix délibéré
  (UX silencieuse) ou un oubli. Un message "Aucun résultat" ou "Erreur" n'est pas
  implémenté.
- **Accessibilité clavier** : aucun `aria-*`, rôle ARIA, ni navigation clavier
  (flèches, Échap) n'est visible dans le code. Le niveau d'accessibilité cible n'est
  pas documenté.
- **Intention du seuil 300 ms** : la valeur est codée en dur. Il n'est pas établi
  si elle a été choisie pour des raisons de quota TMDB, de confort UX, ou par
  convention.
