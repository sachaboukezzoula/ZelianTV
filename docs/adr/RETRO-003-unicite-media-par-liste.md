# RETRO-003 — Unicité d'un média par utilisateur (une liste à la fois)

| Champ      | Valeur                  |
|------------|-------------------------|
| Statut     | Documenté (rétro)       |
| Date       | 2026-06-24              |
| Source     | Rétro-ingénierie        |
| Features   | listes-personnelles, profil, fiche-detail |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — autoriser un même média dans plusieurs listes simultanées imposerait : remplacer `maybeSingle()` par `select()` dans `getWatchlistData` (retour d'un tableau au lieu d'un scalaire), refaire toute la logique d'affichage du `WatchlistButton` (qui affiche "Ajouté — [une seule liste]"), réviser l'upsert `toggleWatchlist` en logique multi-lignes, et modifier l'affichage groupé dans `ProfileClient` |
| Q2 — Non-déductible du code ? | OUI — la contrainte UNIQUE `(user_id, tmdb_id, media_type)` est visible dans la migration SQL, mais l'intention métier "un média ne peut être que dans une liste à la fois, le changement de liste est un déplacement et non un ajout" n'est pas déductible de `package.json` ni des fichiers de configuration ; elle explique pourquoi `toggleWatchlist` utilise `upsert + onConflict` plutôt que `delete + insert` |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — listes-personnelles (logique `WatchlistButton`, `toggleWatchlist`), profil (groupement des items par `list_type`, affichage de la liste active), fiche-detail (`WatchlistButton` intégré dans `components/WatchlistButton.tsx` utilisé sur la page fiche) |
| Q4 — Casse un invariant si ignoré ? | OUI — supprimer la contrainte UNIQUE rendrait l'upsert `onConflict: 'user_id,tmdb_id,media_type'` silencieusement incorrect (Supabase ne lèverait pas d'erreur mais le comportement « changement de liste » deviendrait un « ajout dans une nouvelle liste », créant des doublons) ; `maybeSingle()` retournerait une erreur si plusieurs lignes existent pour le même triplet |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

Le `WatchlistButton` présente un état binaire pour chaque média : soit le média est dans une liste (avec son nom affiché), soit il n'y est pas. L'UI ne prévoit pas de présenter un média comme appartenant à plusieurs listes simultanément. Ce choix d'expérience utilisateur se répercute directement dans le modèle de données : la contrainte UNIQUE `(user_id, tmdb_id, media_type)` est l'invariant en base qui garantit que l'état applicatif (un média = une liste ou aucune) reste cohérent.

## Décision identifiée

La table `user_media_lists` porte la contrainte `UNIQUE (user_id, tmdb_id, media_type)`. Cette contrainte garantit qu'un utilisateur ne peut avoir qu'une seule entrée par couple (média, type de média). En conséquence :
- **Ajouter un média à une liste** alors qu'il est déjà dans une autre liste effectue un `upsert` qui met à jour la colonne `list_type` (le média "change de liste").
- **Retirer un média** supprime la ligne (le média n'est plus dans aucune liste).
- **Lire la liste active** utilise `maybeSingle()` (retourne `null` ou une seule ligne, jamais un tableau).

L'implémentation dans `toggleWatchlist` :
```ts
admin.from('user_media_lists').upsert(
  { user_id, tmdb_id, media_type, list_type: target },
  { onConflict: 'user_id,tmdb_id,media_type' }
)
```

## Conséquences observées

### Positives

- Modèle de données simple et prédictible : un média = zéro ou une ligne dans `user_media_lists`
- L'upsert avec `onConflict` offre un "changement de liste" atomique sans transaction explicite
- Le `WatchlistButton` peut afficher un état simple ("dans quelle liste ?") sans logique multi-états complexe

### Négatives / Dette

- **Pas de multi-liste possible** : l'utilisateur ne peut pas mettre un film dans "À voir" ET dans une liste custom "Comédie". Si cette fonctionnalité est souhaitée ultérieurement, le modèle doit changer (supprimer la contrainte UNIQUE, modifier `getWatchlistData`, refaire le `WatchlistButton`).
- **Couplage fort UI ↔ BDD** : la contrainte UNIQUE n'est pas documentée dans le code applicatif. Un dev qui modifie `toggleWatchlist` sans connaître la contrainte pourrait remplacer l'upsert par un insert et obtenir des erreurs de contrainte en production.

## Recommandation

Garder — ce modèle est cohérent avec l'UI actuelle et les besoins d'une v1. Si une future itération souhaite permettre le multi-listage, planifier un ADR de BREAKING-CHANGE avec migration de la contrainte UNIQUE et refonte du `WatchlistButton`.
