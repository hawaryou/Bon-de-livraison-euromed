# Bon de livraison EuroMed — version GitHub

Cette version remplace le carnet papier par un bon de livraison numérique et utilise **GitHub pour stocker les notices/protocoles**.

## Fonctionnement
- Date du jour automatique.
- Logo et coordonnées EuroMed.
- Destinataire/client et e-mail.
- Tableau : quantité, dénomination, n° de série/lot.
- Lignes ajoutables à volonté.
- Lieu de livraison, date et signature client.
- Après validation : fenêtre d'envoi.
- Le bon est toujours envoyé automatiquement à l'adresse EuroMed configurée.
- Si l'envoi client est activé, le bon est envoyé au client.
- Plusieurs notices/protocoles peuvent être cochés et joints au même e-mail.
- L'e-mail interne indique précisément les documents envoyés au client.
- **La liste des PDF est récupérée automatiquement depuis GitHub** : ajouter/remplacer un PDF dans le dépôt met à jour la liste de l'application.

## 1. Créer le dépôt GitHub

Créer un dépôt **public** (les PDF sont téléchargés par Google Apps Script via leurs URLs `raw.githubusercontent.com`).

Structure recommandée :

```text
bon-livraison-documents/
└── documents/
    ├── Fiches-infos-FMP_V1_190626.pdf
    ├── Protocole_coupure-electricite_Nausiflow_V1-260326.pdf
    ├── Protocole_utilisation_Nausiflow2S_V1_071025.pdf
    ├── Protocole_utilisation_NausiflowQuattro_V1_071025.pdf
    ├── Protocole_utilisation-compresseurP100_Euromed_V1-280824.pdf
    ├── Protocole-recharge_batteries_CLIENTS_euromed_V2-251024.pdf
    └── utilisation-lit-medical-euromed_V2-011025.pdf
```

Les noms des PDF deviennent automatiquement les intitulés affichés dans l'application (sans `.pdf`).

## 2. Configurer l'application

Dans `config.js`, remplacer :

```js
window.GITHUB_OWNER = 'A_REMPLACER';
window.GITHUB_REPO = 'bon-livraison-documents';
window.GITHUB_BRANCH = 'main';
window.GITHUB_DOCUMENTS_PATH = 'documents';
```

Par les informations réelles de votre dépôt.

Exemple pour `https://github.com/EuroMed/bon-livraison-documents` :

```js
window.GITHUB_OWNER = 'EuroMed';
window.GITHUB_REPO = 'bon-livraison-documents';
window.GITHUB_BRANCH = 'main';
window.GITHUB_DOCUMENTS_PATH = 'documents';
```

Il n'est **pas nécessaire d'inscrire les 7 fichiers un par un dans `config.js`**.

## 3. Configurer l'envoi des e-mails

Le fichier `Code.gs` est déployé en tant qu'application Web Google Apps Script.

1. Créer un projet Google Apps Script.
2. Remplacer son `Code.gs` par celui fourni.
3. Déployer > Nouveau déploiement > Application Web.
4. Exécuter l'application en tant que votre compte.
5. Autoriser l'accès demandé.
6. Copier l'URL `/exec` dans `config.js` à la place de `COLLER_ICI_URL_APPS_SCRIPT`.

Le script utilise `UrlFetchApp` pour récupérer les PDF GitHub et `MailApp` pour les joindre aux e-mails.

## 4. Ajouter ou remplacer une notice

Pour ajouter une nouvelle notice, déposer simplement son PDF dans `documents/` puis attendre quelques instants et actualiser l'application.

Pour remplacer une notice, remplacer le PDF dans GitHub en conservant le même nom.

Pour retirer une notice, supprimer son PDF du dossier GitHub.

## Sécurité / confidentialité

Cette version suppose que les documents GitHub sont **publics**. Ne mettez pas de données personnelles, dossiers patients ou documents confidentiels dans ce dépôt.

Les fichiers ne sont pas exposés directement par l'application au client : ils sont récupérés côté Apps Script puis joints à l'e-mail. En revanche, un PDF public GitHub peut être consulté par toute personne qui connaît son URL.
