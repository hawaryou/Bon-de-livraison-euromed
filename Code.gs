/**
 * BON DE LIVRAISON — EuroMed
 * Déployer comme application Web Google Apps Script.
 *
 * IMPORTANT :
 * 1. Remplacez DESTINATAIRE par l'adresse interne EuroMed qui doit recevoir
 *    tous les bons de livraison.
 * 2. Dans config.js, renseignez l'URL /exec de ce script.
 * 3. Les notices/protocoles sont stockés dans Google Drive. Leurs IDs sont
 *    déclarés dans config.js et sont transmis au script uniquement lorsque
 *    le client est sélectionné.
 */
const DESTINATAIRE = 'valentineuromed@gmail.com';
const NOM_EXPEDITEUR = 'EuroMed - Bons de livraison';
const ENTREPRISE = 'EuroMed';
// Optionnel : limiter les pièces jointes GitHub à ce dépôt.
const GITHUB_ALLOWED_HOST = 'raw.githubusercontent.com';

function doGet() {
  return ContentService.createTextOutput('EuroMed — service Bon de livraison actif')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    euromedAuthorizeMail_(e);
    if (!e || !e.parameter) throw new Error('Aucune donnée reçue.');
    const action = e.parameter.action || '';
    if (action !== 'send_delivery') throw new Error('Action inconnue.');

    const filename = sanitizeFilename_(e.parameter.filename || 'Bon_de_livraison_EuroMed.pdf');
    const base64 = e.parameter.pdf_base64 || '';
    if (!base64) throw new Error('PDF manquant.');
    const pdfBlob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', filename);

    const data = JSON.parse(e.parameter.data || '{}');
    const sendClient = e.parameter.send_client === '1';
    const photoBase64 = e.parameter.photo_base64 || '';
    const photoName = sanitizeFilename_(e.parameter.photo_filename || 'Photo_lieu_livraison.jpg');
    let photoBlob = null;
    if (photoBase64) {
      photoBlob = Utilities.newBlob(Utilities.base64Decode(photoBase64), 'image/jpeg', photoName.replace(/\.pdf$/i, '.jpg'));
    }
    const requestedDocs = JSON.parse(e.parameter.documents || '[]');

    let docs = [];
    if (sendClient) {
      docs = requestedDocs.map(function(doc) {
        return getGithubAttachment_(doc);
      });
    }

    const client = data.client || data.destinataire || 'Destinataire non renseigné';
    const internalSubject = 'Bon de livraison EuroMed' + (data.reference ? ' — ' + data.reference : '');
    const docsList = docs.length
      ? docs.map(function(d){ return '• ' + d.name; }).join('\n')
      : '• Aucun document complémentaire envoyé au client';

    const internalBody = [
      'Bonjour,',
      '',
      'Veuillez trouver ci-joint le bon de livraison généré depuis l’application EuroMed.',
      '',
      'Client : ' + client,
      'Destinataire : ' + (data.destinataire || ''),
      'Date : ' + (data.dateSignature || data.date || ''),
      'Lieu de livraison : ' + (data.lieuSignature || data.lieuLivraison || ''),
      'Référence / commande : ' + (data.reference || ''),
      'E-mail client : ' + (data.emailClient || ''),
      'Destinataire absent : ' + (data.destinataireAbsent ? 'Oui' : 'Non'),
      'Photo du lieu jointe : ' + (photoBlob ? 'Oui' : 'Non'),
      '',
      'Documents envoyés au client :',
      docsList,
      '',
      'Cordialement,',
      'EuroMed'
    ].join('\n');

    MailApp.sendEmail({
      to: DESTINATAIRE,
      subject: internalSubject,
      body: internalBody,
      name: NOM_EXPEDITEUR,
      attachments: photoBlob ? [pdfBlob, photoBlob] : [pdfBlob]
    });

    if (sendClient) {
      const clientAttachments = [pdfBlob].concat(photoBlob ? [photoBlob] : []).concat(docs.map(function(d){ return d.blob; }));
      const clientBody = [
        'Bonjour,',
        '',
        'Veuillez trouver ci-joint votre bon de livraison EuroMed.',
        '',
        'Client : ' + client,
        'Date : ' + (data.dateSignature || data.date || ''),
        'Référence / commande : ' + (data.reference || ''),
        'Destinataire absent : ' + (data.destinataireAbsent ? 'Oui' : 'Non'),
        'Photo du lieu jointe : ' + (photoBlob ? 'Oui' : 'Non'),
        '',
        docs.length ? 'Documents complémentaires joints :' : 'Aucun document complémentaire joint.',
        docs.length ? docs.map(function(d){ return '• ' + d.name; }).join('\n') : '',
        '',
        'Cordialement,',
        'EuroMed',
        '+33.327.64.34.99',
        'www.euromed-materiel-medical.com',
        '117 rue de Maubeuge F-59620 Aulnoye-Aymeries'
      ].join('\n');

      MailApp.sendEmail({
        to: data.emailClient,
        subject: 'EuroMed — Bon de livraison' + (data.reference ? ' — ' + data.reference : ''),
        body: clientBody,
        name: NOM_EXPEDITEUR,
        attachments: clientAttachments
      });
    }

    return json_({
      ok: true,
      internalSentTo: DESTINATAIRE,
      clientSent: sendClient,
      clientEmail: sendClient ? data.emailClient : '',
      documentsSent: docs.map(function(d){ euromedLogMailEvent_(e, EUROMED_APP_KEY, 'accepted');
    return d.name; }),
      deliveryPhotoSent: !!photoBlob
    });
  } catch (err) {
    euromedLogMailEvent_(e, EUROMED_APP_KEY, 'failed', err && err.name ? err.name : 'error');
    console.error(err);
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function getGithubAttachment_(doc) {
  if (!doc || !doc.url) throw new Error('Un document sélectionné ne possède pas d’URL GitHub.');
  const url = String(doc.url);
  if (!/^https:\/\/raw\.githubusercontent\.com\//i.test(url)) {
    throw new Error('URL de document GitHub non autorisée.');
  }
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true});
  const code = response.getResponseCode();
  if (code !== 200) throw new Error('Impossible de récupérer le document GitHub (' + code + ').');
  const name = String(doc.name || url.split('/').pop() || 'document.pdf').replace(/[^a-zA-Z0-9._ -]/g,'_');
  const blob = response.getBlob().setName(/\.pdf$/i.test(name) ? name : name + '.pdf');
  return {name: blob.getName(), blob: blob};
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeFilename_(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'Bon_de_livraison_EuroMed.pdf';
}

/**
 * EuroMed — vérification serveur avant tout envoi d'e-mail.
 * À copier dans CHAQUE projet Google Apps Script qui appelle MailApp/GmailApp.
 * Ne jamais journaliser ni enregistrer le jeton reçu.
 */
const EUROMED_AUTH_URL = 'https://nrtrraawiqfbajccfmzc.supabase.co';
const EUROMED_AUTH_PUBLIC_KEY = 'sb_publishable_mI8nBWjKRxTgn2b8ppAyoA_BaxQI4zx';
// À personnaliser différemment dans chaque projet Apps Script.
const EUROMED_APP_KEY = 'bon-livraison';

function euromedAuthorizeMail_(event) {
  const params = {};
  if (event && event.parameter) {
    Object.keys(event.parameter).forEach(function (key) {
      params[key] = event.parameter[key];
    });
  }

  const raw = event && event.postData && event.postData.contents
    ? String(event.postData.contents) : '';
  if (raw) {
    try {
      const object = JSON.parse(raw);
      if (object && typeof object === 'object' && !Array.isArray(object)) {
        Object.keys(object).forEach(function (key) { params[key] = object[key]; });
      }
    } catch (ignore) {
      raw.split('&').forEach(function (part) {
        const index = part.indexOf('=');
        if (index < 0) return;
        const key = decodeURIComponent(part.slice(0, index).replace(/\+/g, ' '));
        const value = decodeURIComponent(part.slice(index + 1).replace(/\+/g, ' '));
        if (!(key in params)) params[key] = value;
      });
    }
  }

  const accessToken = String(params.euromed_access_token || '').trim();
  if (!accessToken) throw new Error('Connexion EuroMed requise pour envoyer un e-mail.');

  const headers = {
    apikey: EUROMED_AUTH_PUBLIC_KEY,
    Authorization: 'Bearer ' + accessToken
  };
  const userResponse = UrlFetchApp.fetch(EUROMED_AUTH_URL + '/auth/v1/user', {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  if (userResponse.getResponseCode() !== 200) {
    throw new Error('Session EuroMed invalide ou expirée. Reconnectez-vous.');
  }
  const user = JSON.parse(userResponse.getContentText() || '{}');
  if (!user.id || !user.email) throw new Error('Compte EuroMed introuvable.');

  const profileUrl = EUROMED_AUTH_URL + '/rest/v1/euromed_profiles' +
    '?select=approved,role,active,session_revoked_at&id=eq.' + encodeURIComponent(user.id);
  const profileResponse = UrlFetchApp.fetch(profileUrl, {
    method: 'get', headers: headers, muteHttpExceptions: true
  });
  if (profileResponse.getResponseCode() !== 200) {
    throw new Error('Impossible de vérifier l’autorisation EuroMed.');
  }
  const profiles = JSON.parse(profileResponse.getContentText() || '[]');
  if (!profiles.length || profiles[0].approved !== true || profiles[0].active !== true) {
    euromedLogMailEvent_(event, EUROMED_APP_KEY, 'blocked', profiles.length && profiles[0].active === false ? 'account-suspended' : 'account-not-approved');
    throw new Error('Compte EuroMed en attente de validation : envoi refusé.');
  }
  const issuedAt = euromedTokenIssuedAt_(accessToken);
  const revokedAt = profiles[0].session_revoked_at ? Math.floor(new Date(profiles[0].session_revoked_at).getTime() / 1000) : 0;
  if (!issuedAt || (revokedAt && issuedAt <= revokedAt)) {
    euromedLogMailEvent_(event, EUROMED_APP_KEY, 'blocked', 'session-revoked');
    throw new Error('Session révoquée. Reconnectez-vous avec votre nouveau lien d’accès.');
  }

  const policyResponse = UrlFetchApp.fetch(EUROMED_AUTH_URL + '/rest/v1/rpc/euromed_get_mail_policy', {
    method: 'post', headers: headers, contentType: 'application/json', payload: '{}', muteHttpExceptions: true
  });
  if (policyResponse.getResponseCode() !== 200 || policyResponse.getContentText() !== 'true') {
    euromedLogMailEvent_(event, EUROMED_APP_KEY, 'blocked', 'mail-paused');
    throw new Error('Les envois e-mail sont temporairement suspendus par l’administrateur EuroMed.');
  }
  return { id: user.id, email: user.email, role: profiles[0].role };
}

function euromedTokenIssuedAt_(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return 0;
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString();
    return Number(JSON.parse(decoded).iat || 0);
  } catch (ignore) { return 0; }
}

/**
 * Ajoute un événement minimal au suivi administrateur (sans destinataire ni contenu).
 * Appeler après l'envoi MailApp réussi, puis dans catch en cas d'échec.
 */
function euromedLogMailEvent_(event, appKey, status, errorCode) {
  try {
    const params = {};
    if (event && event.parameter) Object.keys(event.parameter).forEach(function (key) { params[key] = event.parameter[key]; });
    const raw = event && event.postData && event.postData.contents ? String(event.postData.contents) : '';
    if (raw) {
      try { Object.assign(params, JSON.parse(raw)); } catch (ignore) {
        raw.split('&').forEach(function (part) {
          const i = part.indexOf('='); if (i < 0) return;
          params[decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '))] = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
        });
      }
    }
    const token = String(params.euromed_access_token || '').trim();
    if (!token) return;
    UrlFetchApp.fetch(EUROMED_AUTH_URL + '/rest/v1/rpc/euromed_log_mail_event', {
      method: 'post',
      headers: { apikey: EUROMED_AUTH_PUBLIC_KEY, Authorization: 'Bearer ' + token },
      contentType: 'application/json',
      payload: JSON.stringify({ p_app_key: String(appKey || 'inconnu').slice(0, 80), p_status: status, p_error_code: status === 'failed' ? String(errorCode || 'erreur').slice(0, 80) : null }),
      muteHttpExceptions: true
    });
  } catch (ignore) { /* Les journaux ne doivent jamais empêcher un envoi ou son traitement. */ }
}

