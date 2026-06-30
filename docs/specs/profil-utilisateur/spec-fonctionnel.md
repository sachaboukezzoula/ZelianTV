# Spec Fonctionnelle — Profil Utilisateur [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | profil-utilisateur  |
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

| ADR | Titre | Catégorie | Impact sur cette feature |
|-----|-------|-----------|--------------------------|
| [RETRO-001](../../adr/RETRO-001-tmdb-fetch-cache.md) | Cache TMDB via fetch natif Next.js (revalidate 1h) | DB-STRATEGY | L'enrichissement lazy des items watchlist (items sans poster_path) et le calcul des recommandations passent par ce mécanisme de cache |
| [RETRO-002](../../adr/RETRO-002-rls-user-media-lists.md) | RLS et isolation utilisateur sur user_media_lists | SECURITY | Les actions `removeFromList` et `deleteList` suivent le pattern getAuthUser() + admin client imposé par cet ADR |
| [RETRO-003](../../adr/RETRO-003-unicite-media-par-liste.md) | Unicité d'un média par utilisateur (une liste à la fois) | DATA-MODEL | L'affichage groupé des listes dans ProfileClient et la suppression par item reposent sur cet invariant (1 ligne par média) |
| [RETRO-004](../../adr/RETRO-004-auth-supabase-gotrue.md) | Authentification via Supabase GoTrue (email/password + session SSR) | AUTH | Guard d'accès à la page profil, modification d'email via admin, modification de mot de passe via client navigateur |
| [RETRO-005](../../adr/RETRO-005-user-metadata-pseudo-avatar.md) | Stockage du pseudo et de l'avatar en user_metadata Supabase Auth | DATA-MODEL | Le pseudo (display_name) et l'URL d'avatar sont lus et écrits depuis user_metadata — pas de table BDD dédiée |

---

## Contexte et objectif

La page `/profil` est l'espace personnel de l'utilisateur connecté dans ZelianTV. Elle remplit trois rôles distincts :

1. **Vitrine des données personnelles** : affichage du pseudo, de l'email, de l'avatar et de stats de visionnage (films vus, à voir, nombre de listes custom).
2. **Gestion des listes de médias** : visualisation et modification des listes "À voir", "Déjà vu" et des listes personnalisées (suppression d'items ou de listes entières).
3. **Édition du compte** : modification du pseudo, de l'email et du mot de passe.

Si l'utilisateur n'est pas connecté, la page affiche les formulaires d'authentification (`AuthTabs`) au lieu du profil.

## Règles métier (déduites du code)

1. L'accès à la page `/profil` ne redirige pas l'utilisateur non connecté — il voit les formulaires de connexion/inscription inline (rendu conditionnel Server Component, pas de HTTP 302).
2. Les listes "À voir" (`watchlist`) et "Déjà vu" (`watched`) sont fixes et ne peuvent pas être supprimées (la propriété `canDelete` vaut `false` pour ces deux listes dans `ProfileClient`).
3. Les listes personnalisées peuvent être supprimées. La suppression d'une liste entraîne la suppression de tous ses items (la Server Action `deleteList` supprime toutes les lignes de `user_media_lists` correspondant au `list_type` de l'utilisateur).
4. La suppression d'une liste custom nécessite une confirmation explicite (double clic : "Supprimer la liste" puis "Confirmer") — pas de suppression directe.
5. La suppression d'un item individuel dans une liste est possible en mode "Modifier" (bouton rouge apparaissant sur chaque poster). Elle appelle `removeFromList` par identifiant UUID de la ligne BDD, pas par `tmdb_id`.
6. Le pseudo est stocké dans `user_metadata.display_name` de Supabase Auth. Si aucun pseudo n'est défini, l'affichage par défaut est `'Mon profil'`.
7. La modification du pseudo se fait directement via le client Supabase navigateur (`supabase.auth.updateUser`) sans Server Action intermédiaire.
8. La modification de l'email passe par une Server Action (`changeEmailAction`) qui utilise le client admin (`updateUserById`) avec `email_confirm: true`. Cela valide la nouvelle adresse immédiatement sans envoyer d'email de confirmation.
9. La modification du mot de passe requiert la saisie et la confirmation du nouveau mot de passe. La validation côté client impose un minimum de 6 caractères. L'appel se fait via le client navigateur (`supabase.auth.updateUser({ password })`).
10. Les stats affichées (films vus, à voir, listes perso) sont calculées à la volée depuis la liste des items chargée au moment du rendu serveur — il n'y a pas de compteur dénormalisé en BDD.
11. Les items sans `poster_path` ou sans `title` en BDD sont enrichis au moment du rendu serveur via un appel `getMediaDetail` TMDB individuel par item.
12. La section Recommandations affiche au maximum 12 médias, calculés côté serveur depuis les genres des items marqués "Déjà vu". Si aucun item n'est marqué "Déjà vu", la section affiche un message d'invitation.

## Cas d'usage (déduits)

### CU-001 — Consultation du profil (utilisateur connecté)

L'utilisateur connecté accède à `/profil`. Le Server Component charge ses listes depuis `user_media_lists`, enrichit les items incomplets via TMDB, puis calcule les recommandations. `ProfileClient` reçoit toutes les données hydratées et affiche la sidebar (avatar, pseudo, email, stats, boutons d'action) et le contenu principal (listes + recommandations).

### CU-002 — Modification du pseudo

L'utilisateur clique sur l'icône crayon à côté de son pseudo. Une modale s'ouvre avec un champ pré-rempli. Il saisit le nouveau pseudo et confirme. `supabase.auth.updateUser({ data: { display_name: value } })` est appelé côté client. En cas de succès, `router.refresh()` déclenche un nouveau rendu Server Component qui recharge les données de l'utilisateur.

### CU-003 — Modification de l'adresse email

L'utilisateur clique sur l'icône crayon à côté de son email. Il saisit la nouvelle adresse et confirme. La Server Action `changeEmailAction` est appelée avec la nouvelle adresse. Elle vérifie que l'utilisateur est connecté, valide le format de l'email (présence de `@`), puis appelle `admin.auth.admin.updateUserById` avec `email_confirm: true`. La modification est immédiate, sans email de validation.

### CU-004 — Changement de mot de passe

L'utilisateur clique sur "Changer le mot de passe". La modale s'ouvre avec deux champs (nouveau mot de passe + confirmation). Si les deux valeurs correspondent et font au moins 6 caractères, `supabase.auth.updateUser({ password })` est appelé côté client.

### CU-005 — Suppression d'un item dans une liste

L'utilisateur clique sur "Modifier" en regard d'une liste. Les posters affichent un bouton rouge "×". L'utilisateur clique sur "×" sur un poster. `removeFromList(id)` est appelé avec l'UUID de la ligne, qui supprime la ligne dans `user_media_lists` (contrainte `eq('user_id', user.id)` pour la sécurité). `router.refresh()` actualise l'affichage.

### CU-006 — Suppression d'une liste personnalisée

L'utilisateur clique sur "Modifier" sur une liste custom, puis sur "Supprimer la liste". Un bandeau de confirmation apparaît. Il clique "Confirmer". `deleteList(listType)` supprime toutes les lignes de `user_media_lists` pour ce `list_type` et cet utilisateur. La liste disparaît de l'affichage après `router.refresh()`.

### CU-007 — Accès sans connexion

L'utilisateur non connecté accède à `/profil`. Le Server Component détecte `user === null` et retourne `<AuthTabs />` — les formulaires de connexion et d'inscription sont affichés directement dans la page, sans redirection.

## Dépendances

- **Supabase Auth (GoTrue)** — identité utilisateur, lecture/écriture de `user_metadata` (voir RETRO-004)
- **`user_media_lists` (Supabase BDD)** — listes de médias de l'utilisateur (voir RETRO-002, RETRO-003)
- **`user_preferences` (Supabase BDD)** — genres préférés (chargés mais non affichés directement dans le profil v1)
- **TMDB API** — enrichissement des items sans poster/titre, calcul des recommandations (voir RETRO-001)
- **`app/actions/watchlist.ts`** — Server Actions `removeFromList`, `deleteList`
- **`app/actions/profile.ts`** — Server Action `changeEmailAction`
- **`app/actions/avatar.ts`** — Server Action `uploadAvatarAction`
- **`lib/recommendations.ts`** — algorithme de recommandation par genres
- **`components/auth/AuthTabs.tsx`** — composant affiché si l'utilisateur n'est pas connecté

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Comportement attendu si `changeEmailAction` est appelé avec l'email actuel de l'utilisateur** : le code ne vérifie pas que le nouvel email est différent de l'ancien. Le comportement de Supabase Admin dans ce cas (erreur silencieuse ou succès no-op) n'est pas documenté.
- **Confirmation de suppression de liste** : le message de confirmation est "Supprimer cette liste et tous ses films ?" — le terme "films" est-il intentionnel (les séries sont-elles exclues ?) ou générique ? La Server Action supprime bien tous les items sans distinction de `media_type`.
- **`user_preferences` non affiché** : la table `user_preferences` est chargée dans `app/profil/page.tsx` mais `preferredGenres` est passé à `ProfileClient` avec un underscore préfixe (`_preferredGenres`), indiquant qu'il n'est pas utilisé. Est-ce une fonctionnalité prévue mais non implémentée ?
- **Limite de taille des listes** : aucune pagination n'est implémentée. Pour un utilisateur avec des centaines d'items, la page charge toutes les lignes de `user_media_lists` en une seule requête. La limite acceptable n'est pas documentée.
