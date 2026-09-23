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
    if (!e || !e.parameter) throw new Error('Aucune donnée reçue.');
    const action = e.parameter.action || '';
    if (action !== 'send_delivery') throw new Error('Action inconnue.');

    const filename = sanitizeFilename_(e.parameter.filename || 'Bon_de_livraison_EuroMed.pdf');
    const base64 = e.parameter.pdf_base64 || '';
    if (!base64) throw new Error('PDF manquant.');
    const pdfBlob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', filename);

    const data = JSON.parse(e.parameter.data || '{}');
    const sendClient = e.parameter.send_client === '1';
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
      attachments: [pdfBlob]
    });

    if (sendClient) {
      const clientAttachments = [pdfBlob].concat(docs.map(function(d){ return d.blob; }));
      const clientBody = [
        'Bonjour,',
        '',
        'Veuillez trouver ci-joint votre bon de livraison EuroMed.',
        '',
        'Client : ' + client,
        'Date : ' + (data.dateSignature || data.date || ''),
        'Référence / commande : ' + (data.reference || ''),
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
      documentsSent: docs.map(function(d){ return d.name; })
    });
  } catch (err) {
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
