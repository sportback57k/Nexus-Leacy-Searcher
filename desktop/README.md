# Nexus Legacy pour macOS

Application Electron du site `https://nexussearcher.vercel.app`. Le site est chargé en ligne : son interface, les comptes, les crédits et l’administration restent ceux du service existant. Une connexion Internet est nécessaire et une première connexion au compte est requise dans l’application.

- Nom : **Nexus Legacy**
- Version : **1.0.0**
- Cible : **Mac Intel, macOS Monterey 12 et versions ultérieures**
- Moteur : **Electron 43.8.10**, fixé et vérifié par SHA-256
- Icône : logo du site, désaturé comme l’interface actuelle et adapté au format macOS
- Distribution : `.dmg` avec raccourci Applications

## Installer

Ouvrir le DMG, puis glisser **Nexus Legacy** vers **Applications**. L’application peut ensuite être ajoutée au Dock. Les comptes du site se connectent par le code e-mail habituel.

Le paquet utilise une signature locale ad hoc. Il n’est pas notarisé par Apple : une copie téléchargée depuis Internet sur un autre Mac peut être bloquée par Gatekeeper. Ne pas désactiver les protections macOS globales. Une distribution notarisée nécessiterait un certificat Apple Developer approprié.

## Construire sur Mac

Prérequis : Python 3 et les outils en ligne de commande Xcode. Aucun npm ni module tiers n’est nécessaire :

```sh
python3 desktop/build.py
```

Le script télécharge exclusivement l’archive officielle Electron épinglée dans `electron-runtime.json`, vérifie son empreinte, crée l’icône avec les outils Apple, adapte les identifiants du bundle, signe localement l’application et produit un DMG vérifié. Les sorties sont dans `desktop/build`, `desktop/dist` et sur le Bureau.

Les fichiers de licence Electron/Chromium accompagnent l’application. Les sorties binaires et les données de session ne sont pas ajoutées au dépôt. Le moteur 43 conserve la compatibilité Monterey ; il faudra surveiller sa fin de maintenance et prévoir une mise à niveau du système pour les branches futures.

## Isolation

Le site est chargé en HTTPS dans un moteur avec sandbox, isolation des contextes et intégration Node désactivée. Aucun preload ni accès IPC au système n’est exposé. Les navigations internes restent sur l’origine Nexus ; les liens HTTPS externes s’ouvrent dans le navigateur. Les protocoles `file:`, `javascript:` et autres liens externes ne sont pas transmis au système. Les permissions de caméra, microphone et lecture du presse-papiers sont refusées. L’application ne contient aucune clé Supabase secrète.

## Vérification

Le fichier `app/policy.test.cjs` vérifie les restrictions de navigation. Le test de lancement utilise un profil séparé, charge le vrai site, vérifie l’absence de Node dans la page, les routes, les appels Supabase publics, les restrictions de navigation et le retour après une coupure réseau. Le DMG et la signature locale sont ensuite vérifiés avec les outils Apple.
