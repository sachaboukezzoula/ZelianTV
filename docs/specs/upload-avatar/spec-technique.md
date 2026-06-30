# Spec Technique — upload-avatar

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | upload-avatar       |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

La feature est découpée en deux couches distinctes :

**Couche cliente (`ProfileClient.tsx`)** : compression de l'image via Canvas API, déclenchement de l'`<input type="file">`, appel de la Server Action, gestion de l'état de chargement et affichage des erreurs. La compression est faite entièrement dans le navigateur avant tout appel réseau.

**Couche serveur (`app/actions/avatar.ts`)** : Server Action Next.js (`'use server'`) qui reçoit le `FormData` avec le fichier déjà compressé. Elle vérifie la session (client anon), crée le bucket si nécessaire (client admin), uploade dans Supabase Storage (client admin, bypass RLS), récupère l'URL publique, ajoute le paramètre de cache-busting, puis persiste l'URL dans `user_metadata` (client anon via `supabase.auth.updateUser`).

La page `/profil` (Server Component) est invalidée par `revalidatePath('/profil')` à la fin de la Server Action, puis rechargée côté client via `router.refresh()` dans le composant.

```
[Utilisateur clique avatar]
       |
       v
ProfileClient.tsx
  ├── compressImage(file, 400, 0.85)  — Canvas API, renvoie Blob JPEG
  ├── FormData.append('file', compressedBlob)
  └── uploadAvatarAction(formData)  — Server Action
              |
              v
        avatar.ts ('use server')
          ├── createClient() → getUser()     [client anon — vérif session]
          ├── createAdminClient()            [client service_role]
          ├── admin.storage.createBucket()   [crée 'avatars' public si absent]
          ├── admin.storage.upload()         [upsert: true, '<user_id>.jpg']
          ├── getPublicUrl() + ?t=<timestamp>
          ├── supabase.auth.updateUser({ data: { avatar_url } })
          └── revalidatePath('/profil')
```

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `app/actions/avatar.ts` | Server Action unique de la feature — vérification session, upload Storage, mise à jour metadata | ~39 |
| `app/profil/ProfileClient.tsx` | Client Component — fonction `compressImage`, handler `handleAvatarChange`, UI avatar (overlay hover, spinner, `<input>` caché, affichage via `<Image>` ou fallback lettre) | ~593 (feature avatar : lignes 41-66, 82-86, 134-151, 204-231) |
| `lib/supabase/admin.ts` | Client Supabase service_role utilisé par la Server Action pour l'upload et la création du bucket | ~15 |
| `lib/supabase/server.ts` | Client Supabase anon utilisé pour la vérification de session dans la Server Action | ~27 |

## Schéma BDD (si applicable)

Aucune table BDD impliquée directement par cette feature.

Les données persistées sont :
- **Supabase Storage** : fichier `avatars/<user_id>.jpg` (bucket `avatars`, visibilité publique). Un seul fichier par utilisateur, upsert systématique.
- **Supabase Auth (user_metadata)** : clé `avatar_url` de type `string` — URL publique Supabase Storage avec paramètre `?t=<timestamp>`. Voir RETRO-005 pour la décision de stockage en metadata.

## API / Endpoints (si applicable)

La feature n'expose pas d'endpoint REST. Elle utilise le mécanisme de Server Actions Next.js.

| Fonction | Type | Description | Auth |
|----------|------|-------------|------|
| `uploadAvatarAction(formData)` | Server Action | Reçoit un `FormData` avec `file` (Blob JPEG déjà compressé). Retourne `{ url: string }` ou `{ error: string }`. | Session Supabase obligatoire — retourne `{ error: 'Non connecté' }` si absente |

## Patterns identifiés

- **Compression cliente avant upload** : la compression Canvas est faite dans le navigateur (`compressImage` dans `ProfileClient.tsx`) avant d'appeler la Server Action. La Server Action reçoit un fichier déjà compressé et ne fait aucune transformation d'image.
- **Double client Supabase dans la Server Action** : le client anon (`createClient`) est utilisé uniquement pour `supabase.auth.getUser()` (vérification de session) et `supabase.auth.updateUser()` (écriture en metadata via le token utilisateur). Le client admin (`createAdminClient`) est utilisé exclusivement pour les opérations Storage (création bucket, upload) qui nécessitent le bypass du RLS. Ce pattern est cohérent avec la convention établie dans RETRO-002.
- **Upsert sur clé fixe** : le nom de fichier `<user_id>.jpg` est déterministe. L'option `{ upsert: true }` dans l'appel Storage permet de remplacer silencieusement le fichier existant. Voir RETRO-006 pour la décision et ses conséquences.
- **Cache-busting par timestamp en metadata** : l'URL publique Supabase Storage de la forme `https://<project>.supabase.co/storage/v1/object/public/avatars/<user_id>.jpg` est identique entre deux uploads (même clé). Le paramètre `?t=<timestamp>` est ajouté à l'URL avant stockage pour forcer un `Cache-Control: no-cache` implicite côté navigateur via un URL différent. Le timestamp est recalculé à chaque upload (`Date.now()`). Décision documentée en spec-technique (AP-4 — workaround local).

## Configuration Canvas (paramètres de compression)

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `maxDim` | 400 px | Dimension maximale (largeur ou hauteur). Le redimensionnement est proportionnel — si l'image fait 800×600, elle devient 400×300. |
| `quality` | 0.85 | Qualité JPEG passée à `canvas.toBlob(blob, 'image/jpeg', 0.85)`. Valeur entre 0 (minimum) et 1 (maximum). |
| Format de sortie | `image/jpeg` | Toute image en entrée (PNG, WebP, GIF, etc.) est convertie en JPEG. |

## Comportement en cas d'erreur

| Étape | Erreur possible | Comportement |
|-------|-----------------|--------------|
| Sélection fichier | Annulation de la dialog native | `e.target.files?.[0]` est `undefined` — handler retourne immédiatement, aucun effet |
| Compression Canvas | Canvas non supporté | `reject(new Error('Canvas non supporté'))` — propagé vers `setActionError` |
| Compression Canvas | Image illisible | `reject(new Error('Impossible de lire l\'image'))` — propagé vers `setActionError` |
| Upload Storage | Échec Supabase | `return { error: \`Upload échoué : ${uploadError.message}\` }` — affiché en bandeau rouge |
| Update metadata | Échec Supabase Auth | `return { error: metaError.message }` — affiché en bandeau rouge |
| Création bucket | Toute erreur | `.catch(() => {})` — erreur silencieuse. Si le bucket n'existe pas et ne peut être créé, l'upload Storage échoue avec une erreur opaque. |

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| — | Aucun test pour `uploadAvatarAction` ni pour `compressImage` | Absent |

Aucun fichier de test ne couvre cette feature. Les fonctions `compressImage` (Canvas API, difficile à tester en jsdom) et `uploadAvatarAction` (Server Action avec dépendances Supabase) sont non couvertes.
