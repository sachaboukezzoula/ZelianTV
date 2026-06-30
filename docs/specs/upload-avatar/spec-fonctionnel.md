# Spec Fonctionnelle — upload-avatar [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | upload-avatar       |
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

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-005](../../adr/RETRO-005-user-metadata-pseudo-avatar.md) | Stockage du pseudo et de l'avatar en user_metadata Supabase Auth | Documenté (rétro) |
| [RETRO-006](../../adr/RETRO-006-avatar-storage-upsert-fixed-key.md) | Fichier avatar nommé par user_id avec upsert (un fichier par utilisateur) | Documenté (rétro) |

---

## Contexte et objectif

La feature upload-avatar permet à un utilisateur connecté de personnaliser son profil en définissant une photo d'identité (avatar). L'objectif est d'offrir une expérience fluide : l'utilisateur clique sur son avatar dans la sidebar du profil, sélectionne un fichier image depuis son appareil, et voit son avatar mis à jour immédiatement après le rechargement de la page.

La feature gère deux contraintes techniques : (1) réduire la taille du fichier envoyé au serveur pour limiter la bande passante et la consommation Storage, (2) forcer les navigateurs à recharger l'image après un changement, malgré un nom de fichier identique entre deux uploads successifs.

## Règles métier (déduites du code)

1. L'upload d'avatar est réservé aux utilisateurs authentifiés. Toute tentative sans session valide retourne une erreur `'Non connecté'` sans procéder à l'upload.
2. Un fichier vide ou absent est rejeté avec l'erreur `'Fichier manquant'`. Le format accepté est `image/*` (contrôle côté attribut HTML, pas de vérification MIME côté serveur).
3. Avant envoi au serveur, l'image est compressée côté client : redimensionnement proportionnel à 400px maximum (largeur ou hauteur selon le plus grand côté), conversion en JPEG avec une qualité de 0.85.
4. Chaque utilisateur dispose d'un unique fichier avatar dans Supabase Storage. Un nouvel upload remplace systématiquement le précédent (upsert) — il n'y a pas d'historique d'avatars.
5. Le nom du fichier en Storage est fixé à `<user_id>.jpg`, quel que soit le nom du fichier original sélectionné par l'utilisateur.
6. L'URL publique de l'avatar est complétée d'un paramètre de cache-busting `?t=<timestamp>` avant d'être stockée dans `user_metadata.avatar_url`. Ce paramètre est recalculé à chaque upload pour forcer le rechargement de l'image par les navigateurs.
7. En cas d'échec de l'upload Storage, la Server Action retourne une erreur sans modifier les metadata utilisateur.
8. En cas de succès, la page `/profil` est invalidée côté serveur (`revalidatePath`) et la navigation est rafraîchie côté client (`router.refresh()`).

## Cas d'usage (déduits)

### CU-001 — Changer son avatar

**Acteur** : utilisateur connecté

**Préconditions** : l'utilisateur est sur la page `/profil` et dispose d'une session Supabase valide.

**Flux principal** :
1. L'utilisateur survole l'avatar dans la sidebar — une icône caméra apparaît en overlay.
2. L'utilisateur clique sur l'avatar — un `<input type="file" accept="image/*">` caché est déclenché programmatiquement.
3. L'utilisateur sélectionne un fichier image depuis son système de fichiers.
4. Le navigateur compresse l'image côté client via Canvas API (max 400px, JPEG 0.85).
5. L'image compressée est envoyée à la Server Action `uploadAvatarAction` via un `FormData`.
6. La Server Action vérifie la session, s'assure que le bucket `avatars` existe, et uploade le fichier nommé `<user_id>.jpg` avec upsert.
7. L'URL publique avec `?t=<timestamp>` est stockée dans `user_metadata.avatar_url`.
8. La page est revalidée et rechargée — le nouvel avatar apparaît.

**Pendant l'opération** : un spinner est affiché en overlay de l'avatar (`avatarLoading = true`).

**Flux alternatif — erreur upload** :
- Si l'upload échoue (Supabase Storage indisponible ou quota dépassé), la Server Action retourne `{ error: string }`.
- Le composant affiche le message d'erreur en bandeau rouge en haut du contenu principal.

**Flux alternatif — fichier invalide** :
- Si aucun fichier n'est sélectionné (annulation de la dialog), le handler `handleAvatarChange` retourne immédiatement sans appeler la Server Action.
- Si Canvas n'est pas supporté par le navigateur, une erreur `'Canvas non supporté'` est propagée et affichée.

### CU-002 — Affichage de l'avatar courant

**Acteur** : utilisateur connecté avec un avatar défini

**Flux** :
1. La page `/profil` est rendue côté serveur avec l'objet `User` Supabase.
2. `ProfileClient` lit `user.user_metadata?.avatar_url`.
3. Si `avatar_url` est définie, un composant `<Image>` Next.js l'affiche en cercle (64px mobile, 96px desktop).
4. Si `avatar_url` est absente, un fallback affiche la première lettre de l'email de l'utilisateur sur fond orange.

## Dépendances

- `app/actions/avatar.ts` — Server Action `uploadAvatarAction`
- `lib/supabase/server.ts` — vérification de session (client anon)
- `lib/supabase/admin.ts` — upload Storage et update metadata (client service_role)
- Supabase Storage — bucket `avatars` (créé automatiquement si absent)
- Canvas API (navigateur) — compression côté client dans `ProfileClient.tsx`
- `next/navigation` (`revalidatePath`, `router.refresh()`) — invalidation du cache après upload

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Limite de taille du fichier brut** : aucune vérification de taille n'est présente côté client avant la compression, ni côté serveur avant l'upload. La taille maximale acceptée par Supabase Storage (par défaut 50 Mo) n'est pas explicitement configurée ni documentée dans le code.
- **Comportement sur mobile** : l'overlay hover (icône caméra) est déclenché par `onMouseEnter`. Sur mobile (pas de survol), il est possible que l'overlay ne s'affiche pas avant le clic — le clic déclenche tout de même l'upload mais sans retour visuel anticipé. À valider.
- **Gestion des formats non-JPEG à l'entrée** : l'attribut `accept="image/*"` accepte PNG, WebP, GIF, etc. La compression Canvas convertit tout en JPEG. Le comportement sur des images avec transparence (PNG avec alpha) n'est pas documenté — le fond transparent est probablement rendu noir sur le canvas.
- **Création du bucket en production** : la création automatique du bucket avec `createBucket(...).catch(() => {})` supprime silencieusement toute erreur. Si le bucket ne peut pas être créé (quota Supabase dépassé, permissions service_role insuffisantes), l'upload échoue ensuite avec une erreur opaque. À valider si le bucket est pré-créé dans l'environnement de production.
