// Configuration de l'application Bon de livraison EuroMed.
// L'URL doit être celle de votre application Web Google Apps Script.
window.GOOGLE_APPS_SCRIPT_URL = 'COLLER_ICI_URL_APPS_SCRIPT';

// Adresse EuroMed qui reçoit TOUS les bons de livraison.
window.EUROMED_EMAIL = 'valentineuromed@gmail.com';

// Documents proposés dans la fenêtre d'envoi.
// Les IDs correspondent aux fichiers placés dans Google Drive et accessibles
// par le compte qui exécute le script Apps Script.
// Exemple : { id: '1AbC...', name: 'Notice lit HMS Euro 1000.pdf' }
window.DELIVERY_DOCUMENTS = [
  // { id: 'ID_GOOGLE_DRIVE', name: 'Notice d’utilisation — HMS Euro 1000.pdf' },
  // { id: 'ID_GOOGLE_DRIVE', name: 'Protocole de nettoyage — lit médicalisé.pdf' },
  // { id: 'ID_GOOGLE_DRIVE', name: 'Protocole de nettoyage — soulève-personne.pdf' },
];
