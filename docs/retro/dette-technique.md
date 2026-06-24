# Dette Technique — ZelianTV

> Classement par criticité : CRITIQUE > MAJEUR > MINEUR
> Source : rétro-ingénierie du 2026-06-24

---

## CRITIQUE — À corriger immédiatement

| # | Description | Feature | Fichier(s) | Impact |
|---|------------|---------|-----------|--------|
| C-1 | Contrainte `CHECK (list_type IN ('watchlist', 'watched'))` dans la migration `001_init.sql` bloque les upserts de listes custom en production. Le code applicatif (`WatchlistButton`, `toggleWatchlist`) crée librement des listes avec des noms arbitraires, mais la BDD les rejette au niveau contrainte SQL. | listes-personnelles, profil-utilisateur | `supabase/migrations/001_init.sql` (contrainte CHECK sur `list_type`) | Toutes les listes custom sont impossibles à créer ou à modifier si la contrainte est active — la feature la plus différenciante du produit est cassée en production. |
| C-2 | `console.log` en production dans `lib/supabase/admin.ts` (lignes 7-10) : le JWT de la service_role key est partiellement décodé et loggué à chaque instanciation du client admin. Violation de la règle absolue #4 des rules Zelian. | Toutes (via Server Actions) | `lib/supabase/admin.ts` lignes 7-10 | Fuite partielle du rôle du token service_role dans les logs de production. Toute Server Action instancie `createAdminClient()` — c'est donc systématique sur toutes les mutations (watchlist, profil, avatar). |

---

## MAJEUR — À planifier dans les 2 prochains sprints

| # | Description | Feature | Fichier(s) | Impact |
|---|------------|---------|-----------|--------|
| M-1 | Flux de réinitialisation de mot de passe incomplet : `resetPasswordForEmail` est appelé avec `redirectTo: '/profil'`, mais il n'existe pas de page ou de composant sur `/profil` pour saisir le nouveau mot de passe après clic sur le lien email. Le flux de reset est donc cassé fonctionnellement pour l'utilisateur final. | auth | `components/auth/LoginForm.tsx` (appel `resetPasswordForEmail`), `app/profil/page.tsx` (aucune gestion du token de reset dans l'URL) | Un utilisateur qui clique sur le lien de réinitialisation email atterrit sur la page profil sans aucun formulaire pour saisir son nouveau mot de passe. La fonctionnalité "Mot de passe oublié" est non opérationnelle de bout en bout. |
| M-2 | Modification d'email sans re-vérification de l'email actuel : `changeEmailAction` utilise `admin.auth.admin.updateUserById` avec `email_confirm: true`, ce qui valide immédiatement la nouvelle adresse sans demander à l'utilisateur de confirmer qu'il contrôle l'adresse actuelle. | profil-utilisateur, auth | `app/actions/profile.ts` (Server Action `changeEmailAction`) | Un attaquant disposant d'une session active (ex. sur un poste partagé ou via vol de cookie) peut changer l'adresse email du compte et prendre possession du compte de manière irréversible sans aucune validation supplémentaire. |
| M-3 | Pattern N+1 TMDB dans `filterWithContent` : cette fonction vérifie la présence d'un trailer pour chaque média dans les rangées de la home en appelant `getVideos` individuellement sur chaque item. Pour 3 rangées de 40 items chacune, cela représente jusqu'à 120 appels `/videos` au premier rendu (cache froid) ou après expiration du Data Cache. | catalogue-home | `lib/tmdb.ts` (fonction `filterWithContent`), `app/page.tsx` | Risque de saturation du quota TMDB gratuit (40 req/s) au premier rendu ou après tout restart du serveur. Le cache `revalidate: 3600` atténue le problème sur les requêtes suivantes mais ne résout pas le burst initial. |
| M-4 | Pattern N+1 TMDB dans le calcul des recommandations : `getRecommendations` appelle `getMediaDetail` pour chaque média dans la liste `watched` afin de récupérer les genres TMDB. Pour un utilisateur avec N films vus, cela génère N appels TMDB individuels à chaque chargement de `/profil` (même logique de cache mais même problème de burst). RETRO-007 recommande explicitement de stocker les genres en BDD plutôt que de les calculer à la lecture. | recommandations, profil-utilisateur | `lib/recommendations.ts` (fonction `getRecommendations`, appels `getMediaDetail`), `app/profil/page.tsx` | Dégradation progressive des performances et de la consommation de quota TMDB au fur et à mesure que les listes `watched` grossissent. Pour un utilisateur avec 100 films vus, le rendu de `/profil` génère 100 appels TMDB au premier chargement. |
| M-5 | Pattern N+1 TMDB dans l'enrichissement de la watchlist sur le profil : les items en BDD sans `poster_path` ou `title` sont enrichis un par un via `getMediaDetail` TMDB au moment du rendu Server Component. | profil-utilisateur | `app/profil/page.tsx` (boucle d'enrichissement lazy sur les items watchlist) | Mêmes impacts que M-4 — s'additionne à ce pattern si un utilisateur a à la fois une watchlist et des films vus non enrichis. |
| M-6 | `user_preferences` chargé mais inutilisé : la table est lue dans `app/profil/page.tsx` et transmise à `ProfileClient` sous le nom `_preferredGenres` (underscore = inutilisé). Requête Supabase consommée à chaque rendu de la page profil pour des données qui ne sont jamais affichées. | profil-utilisateur | `app/profil/page.tsx`, table `user_preferences` (Supabase) | Requête réseau inutile à chaque rendu, indiquant soit une fonctionnalité abandonnée soit une implémentation incomplète. Ambiguité sur l'état réel de la feature. |
| M-7 | Absence de rollback sur les optimistic updates dans `WatchlistButton` : l'état local est mis à jour immédiatement sans attendre la confirmation du serveur, et aucune logique de rollback n'est implémentée en cas d'échec de la Server Action. | listes-personnelles | `components/WatchlistButton.tsx` | En cas d'erreur réseau ou de rejet serveur (ex. session expirée), l'interface affiche un état incohérent avec la réalité BDD — l'utilisateur croit avoir ajouté un média à une liste alors qu'il ne l'est pas. |
| M-8 | Appel `getTrending()` (toutes catégories) dans la home avec résultat non utilisé : la fonction est appelée dans le `Promise.all` de `app/page.tsx` mais `trendingAll` n'est jamais utilisé dans le rendu. Appel TMDB gratuit gaspillé à chaque rendu. | catalogue-home | `app/page.tsx` (import et appel de `getTrending`), `lib/tmdb.ts` | Consommation inutile de quota TMDB et de temps de rendu serveur. |

---

## MINEUR — À traiter en opportunité

| # | Description | Feature | Fichier(s) | Impact |
|---|------------|---------|-----------|--------|
| m-1 | Colonne `rating` en BDD non utilisée par le code : `user_media_lists` a une colonne `rating (integer, 1-10)` qui n'est ni lue ni écrite par le code applicatif. Fonctionnalité prévue ou abandonnée — aucune documentation. | listes-personnelles | `supabase/migrations/001_init.sql` (colonne `rating`) | Dead weight de schéma. Si la fonctionnalité est abandonnée, une migration de suppression clarifie le schéma et réduit la taille des rows. |
| m-2 | Pas de message d'erreur visible à l'utilisateur lors d'une recherche TMDB en échec : le dropdown reste silencieusement vide, sans distinguer "aucun résultat" d'une erreur réseau ou TMDB 5xx. | recherche-live | `components/SearchBar.tsx` (bloc catch), `app/api/search/route.ts` | Expérience utilisateur dégradée silencieusement — l'utilisateur ne sait pas si TMDB est indisponible ou si son terme de recherche ne donne rien. |
| m-3 | Comportement sans trailer non indiqué à l'utilisateur sur mobile (fiche détail) : sur desktop, "Aucun trailer disponible" est affiché sous le poster. Sur mobile, le bloc `YoutubePlayer` est simplement absent sans message. | fiche-detail | `app/media/[id]/page.tsx` (layout mobile, section trailer conditionnelle) | Incohérence UX entre desktop et mobile — sur mobile, l'utilisateur ne sait pas si le trailer est en cours de chargement ou absent. |
| m-4 | Pas de validation MIME côté serveur sur les uploads d'avatar : seul l'attribut HTML `accept="image/*"` filtre les fichiers, sans vérification de contenu côté serveur dans `uploadAvatarAction`. | upload-avatar | `app/actions/avatar.ts` (Server Action `uploadAvatarAction`), `lib/supabase/admin.ts` | Un fichier non-image renommé avec une extension image peut être uploadé dans le bucket Supabase Storage `avatars`. Impact limité (storage public non critique), mais bonnes pratiques de sécurité. |
| m-5 | Typage faible de `user_metadata` : le code caste explicitement `user.user_metadata.display_name` et `user.user_metadata.avatar_url` en `string | undefined` sans type partagé. Toute faute de frappe sur une clé (`avatar_Url`, `displayName`) est silencieuse. | profil-utilisateur, upload-avatar | `app/profil/ProfileClient.tsx` (lectures `user_metadata`), `app/actions/avatar.ts` (écriture `avatar_url`) | Risque de régressions silencieuses lors de toute modification du code de profil. |
| m-6 | Absence de tests E2E et de tests des Server Components : les 14 tests existants couvrent `lib/tmdb.ts`, `lib/recommendations.ts`, les Server Actions watchlist et un composant UI. Aucun test E2E Playwright/Cypress sur les flux critiques (auth, ajout watchlist, upload avatar). | Toutes | `__tests__/` (4 fichiers existants) | Les flux critiques ne sont pas protégés contre les régressions. La couverture est estimée à < 20% des cas d'usage fonctionnels. |
| m-7 | Pas de granularité du TTL de cache TMDB par type d'endpoint : tendances (haute rotation), fiches détail (quasi-statiques) et genres (très stables) partagent tous le même TTL de 1h. | catalogue-home, fiche-detail, recommandations | `lib/tmdb.ts` (fonction `fetchTMDB`, option `revalidate: 3600`) | Opportunité de réduction de charge TMDB : les fiches détail et genres pourraient avoir un TTL de 24h, les tendances 15min. Pas de bug, optimisation de quota. |
| m-8 | Création du bucket Supabase Storage `avatars` silencieuse et sans vérification : `createBucket` est appelé avec `.catch(() => {})` — une erreur de création du bucket (quota dépassé, permissions insuffisantes) est absorbée et l'upload échoue ensuite avec un message opaque. | upload-avatar | `app/actions/avatar.ts` (appel `createBucket`) | En production, si le bucket n'existe pas et ne peut pas être créé, l'upload produit une erreur cryptique pour l'utilisateur. |
| m-9 | Erreurs GoTrue affichées directement en anglais sans catégorisation : les messages `error.message` de Supabase Auth (ex. "Invalid login credentials", "User already registered") sont affichés tels quels à l'utilisateur. | auth | `components/auth/LoginForm.tsx`, `components/auth/SignupForm.tsx` | UX dégradée — les messages d'erreur sont en anglais dans une interface française. |
| m-10 | Absence d'accessibilité clavier dans la `SearchBar` : aucun attribut `aria-*`, rôle ARIA, ni navigation clavier (flèches haut/bas, Échap) n'est implémenté dans le composant dropdown. | recherche-live | `components/SearchBar.tsx` | Non conforme aux standards WCAG — la recherche est inaccessible au clavier. |

---

## Métriques globales

| Indicateur | Valeur |
|-----------|--------|
| Dette CRITIQUE | 2 items |
| Dette MAJEUR | 8 items |
| Dette MINEUR | 10 items |
| Couverture de tests estimée | < 20% des cas d'usage fonctionnels (~14 tests unitaires/intégration, 0 E2E) |
| Features avec tests | 3 / 8 (catalogue-home/lib, listes-personnelles/actions, recommandations/algo) |
| Features sans aucun test | 5 / 8 (recherche-live, fiche-detail, auth, profil-utilisateur, upload-avatar) |
| ADRs identifiés | 7 (tous validés par la politique v2.3.0) |
| Violations règles Zelian actives | 1 (règle #4 — `console.log` dans `lib/supabase/admin.ts`) |
| Zones d'incertitude documentées | 23 (dans les 8 spec-fonctionnel.md) |
