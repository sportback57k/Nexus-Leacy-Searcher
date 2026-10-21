# NEXUS — Vercel + Supabase

Version statique compatible Vercel, avec authentification Supabase, recherche côté navigateur, journal des recherches, modération BAVUR/BLOCUS et console admin.

## Interface NEXUS — V46

- Palette fixe : violet, bleu et noir, avec des textes clairs pour la lisibilité. Aucun réglage de couleur admin ni chargement du thème Supabase.
- Asset `assets/nexus-logo.png` intégré à l’accueil, au moteur, aux pages de compte et de communauté, au pied de page et au favicon. Sa teinte est harmonisée en CSS.
- Recherche : validation des dates, protection contre les doubles clics, délai maximal de 25 secondes pour la source et de 20 secondes pour les opérations de crédit. Un appel à la source en échec ne déclenche pas de débit. Le crédit est validé après réception de fiches au format attendu ; un résultat vide valide consomme un crédit.
- Le moteur continue d’appeler directement `NEXUS_CONFIG.endpoint` : la source doit autoriser le domaine du site via CORS. Aucun proxy `/api/search` n’est fourni.
- Les résultats restent visibles si l’enregistrement final dans l’historique échoue.
- Vérification locale sur macOS : `python3 tests/verify_search.py` (JavaScriptCore système, aucune dépendance à installer).

## Présentation commune

- Direction visuelle NEXUS : fond noir, accents violets et bleus, grand titre central, aperçu du moteur et cartes compactes.
- Accueil avec compteurs de critères et de catégories calculés depuis le formulaire, sans statistiques d’index ou d’utilisateurs inventées.
- Mise en page de recherche à deux panneaux sur ordinateur, empilés sur mobile.
- Boutons de catégorie pour isoler un groupe de critères ; le bouton « Tous » rétablit la vue complète.
- Recherche de critères avec le raccourci `/`, compteurs par catégorie et pastilles pour retirer les valeurs saisies. `Échap` efface le filtre de critères ; `Entrée` dans un champ lance la recherche.
- Fiches de résultats avec initiales, icônes et informations hiérarchisées, affichage liste/grille et filtre local sur les résultats déjà reçus.
- Contenu visible immédiatement, transitions de survol discrètes ; la préférence système de réduction des animations est respectée.
- `css/interface.css` regroupe la nouvelle présentation commune. `js/interface.js` gère les interactions locales ; `js/app.js` conserve la recherche, les comptes, les crédits et l’administration.
- Les huit fichiers `index.html` partagent la même structure : répercuter les changements de balisage sur chaque route.

Pour prévisualiser depuis la racine : `python3 -m http.server 8000`, puis ouvrir `http://localhost:8000/`. Aucun build ni installation de dépendances n’est nécessaire.

## Configuration

1. Dans `js/config.js`, renseigne :
   - `supabaseUrl` : l'URL du projet Supabase (sans `/rest/v1/`)
   - `supabaseAnonKey` : la clé **Publishable / anon**
   - `endpoint` : l'endpoint de recherche autorisé que tu utilises
2. N'utilise jamais une clé `sb_secret_...` ou `service_role` dans le navigateur.
3. Dans Supabase > SQL Editor, exécute les migrations dans cet ordre :
   - `supabase_schema.sql` si la base initiale n'existe pas encore
   - `supabase_search_fix.sql`
   - `supabase_admin_media_fix.sql`
4. Dans Authentication > Sign In / Providers, active Email si nécessaire.
5. Crée ton compte, puis passe `is_admin` à `true` dans `nexus_profiles` pour le compte administrateur.
6. Déploie le dossier sur Vercel.

## Console admin

Le panneau admin permet désormais :

- de charger tous les pseudos dans un menu déroulant ;
- de définir directement le nombre de crédits d'un compte ;
- de voir l'activité d'un utilisateur ;
- de voir les critères exacts enregistrés dans les journaux de recherche ;
- de modérer les vidéos BAVUR et BLOCUS ;
- d'approuver ou refuser une vidéo.

## Vidéos BAVUR / BLOCUS

Les utilisateurs connectés peuvent envoyer un MP4 jusqu'à 500 Mo avec un titre et une description.

Une vidéo reste en attente jusqu'à validation d'un admin. Lorsqu'elle est approuvée, elle devient visible dans :

- la page BAVUR ou BLOCUS ;
- la section **Avant-première** située en bas de l'accueil.

La migration crée les buckets Supabase Storage nécessaires et leurs règles RLS.


## Correctif console admin

Exécute `supabase_admin_media_fix.sql` en entier dans Supabase > SQL Editor. Cette migration inclut aussi les colonnes `username` et `criteria` du journal `nexus_search_logs`, afin que la console admin puisse afficher les critères exacts.


### Suppression des vidéos
Dans la console administrateur, la section BAVUR & BLOCUS permet désormais de supprimer définitivement une vidéo en attente ou déjà publiée. La suppression retire le fichier du stockage et la ligne correspondante de `nexus_videos`.


### Si Supabase affiche `Could not find the function public.nexus_start_search(...) in the schema cache`

Exécute entièrement `supabase_admin_media_fix.sql` dans Supabase > SQL Editor. La migration recharge automatiquement le cache de schéma PostgREST à la fin.


## V11 — recherche legacy conservée
- La recherche utilise directement `NEXUS_CONFIG.endpoint`, comme la version legacy qui fonctionnait.
- Aucun proxy `/api/search` n'est utilisé.
- Les fonctions admin, crédits, historique, critères et vidéos restent conservées.
- Les erreurs JSON reçues comme objets sont maintenant converties proprement en texte afin d'éviter l'affichage `[object Object]`.

## V32 — présence réelle + crédits quotidiens

- Le compteur « en ligne » utilise Supabase Realtime Presence et compte uniquement les présences actuellement actives.
- Les comptes utilisateurs reçoivent 5 crédits par jour.
- Le renouvellement se fait automatiquement à minuit (Europe/Paris), avec un reset côté serveur.
- Le bouton « Crédits » dans la barre du haut ouvre une fenêtre indiquant le solde et le temps restant avant le prochain renouvellement.
- Le renouvellement quotidien nécessite le RPC `nexus_get_credit_status` côté Supabase. La migration quotidienne n’est pas incluse dans ce dépôt ; sans ce RPC, le site utilise le solde du profil sans promettre un renouvellement automatique.
- Les administrateurs gardent des crédits illimités.


## Navigation multipage
Les routes Vercel sont disponibles via `/accueil/`, `/recherche/`, `/connexion/`, `/bavur/`, `/blocus/`, `/discord/` et `/admin/`. Chaque route utilise le même cœur Supabase et la même interface, avec une transition d'entrée dédiée.

## V43 — icônes et boutons violets
- L'interface adopte un thème violet par défaut, plus lisible sur ordinateur et mobile.
- Les anciennes préférences de thème rouge sont converties à l'affichage en violet.
- Les animations ambiantes rouges sont supprimées et les pages principales ont une nouvelle composition.
- Les boutons ont un style violet uniforme et les emojis de l'onglet Recherche sont remplacés par des icônes SVG.
- Les fonctions Supabase, la recherche et son endpoint restent inchangés.
- L'administrateur conserve le choix du thème et des couleurs personnalisées. Exécute `supabase_site_theme.sql` pour appliquer le nouveau violet par défaut aux installations qui utilisaient encore le thème rouge initial.
