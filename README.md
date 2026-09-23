# Bon de livraison EuroMed

Cette version remplace le carnet papier par un bon de livraison numérique.

## Fonctionnement
- Date du jour automatique.
- Logo et coordonnées EuroMed.
- Destinataire/client et e-mail.
- Tableau de livraison : quantité, dénomination, n° de série/lot.
- Lignes ajoutables à volonté.
- Lieu de livraison, date et signature client.
- Après validation : fenêtre d'envoi.
- Le bon est toujours envoyé automatiquement à l'adresse EuroMed configurée.
- Si l'envoi client est activé, le bon est envoyé au client.
- Plusieurs notices/protocoles peuvent être cochés et joints au même e-mail.
- L'e-mail interne indique précisément les documents envoyés au client.

## Mise en service
1. Créer un projet Google Apps Script et remplacer son `Code.gs` par celui fourni.
2. Déployer > Nouveau déploiement > Application Web.
3. Exécuter l'application en tant que votre compte et autoriser l'accès demandé.
4. Copier l'URL `/exec` dans `config.js` à la place de `COLLER_ICI_URL_APPS_SCRIPT`.
5. Mettre les notices/protocoles dans Google Drive.
6. Pour chaque document, récupérer son ID Drive et ajouter dans `config.js` :
   `{ id: 'ID_DU_FICHIER', name: 'Nom visible dans l’application' }`
7. Héberger le dossier sur votre hébergement habituel ou utiliser l’URL de votre application web.

### Important
Les fichiers Drive doivent être accessibles au compte Google qui exécute le script Apps Script. Les utilisateurs de l’application n’ont pas besoin d’avoir accès directement aux fichiers Drive : le script les joint à l’e-mail.

L'adresse interne actuelle dans le modèle est `valentineuromed@gmail.com`; remplacez-la dans `config.js` et `Code.gs` si nécessaire.
