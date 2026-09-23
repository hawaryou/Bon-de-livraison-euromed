const APP_URL = window.GOOGLE_APPS_SCRIPT_URL || '';
const EUROMED_EMAIL = window.EUROMED_EMAIL || '';
const DOCUMENTS = Array.isArray(window.DELIVERY_DOCUMENTS) ? window.DELIVERY_DOCUMENTS : [];

const $ = id => document.getElementById(id);
const today = new Date();
const isoDate = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
const frDate = new Intl.DateTimeFormat('fr-FR').format(today);

$('todayDisplay').textContent = frDate;
$('dateSignature').value = isoDate;

function addRow(values={}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="qty-input" type="number" min="0" step="1" value="${escapeHtml(values.qty||'1')}"></td>
    <td><input class="product-input" type="text" value="${escapeHtml(values.product||'')}" placeholder="Dénomination du produit"></td>
    <td><input class="serial-input" type="text" value="${escapeHtml(values.serial||'')}" placeholder="N° de série / lot"></td>
    <td class="remove-col"><button type="button" class="remove" title="Supprimer">×</button></td>`;
  tr.querySelector('.remove').onclick=()=>{ if(document.querySelectorAll('#itemsBody tr').length>1) tr.remove(); };
  $('itemsBody').appendChild(tr);
}
addRow();
$('addLine').onclick=()=>addRow();

function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function setupSignature(){
  const c=$('signature'),ctx=c.getContext('2d'); let drawing=false,last=null;
  function resize(){
    const ratio=window.devicePixelRatio||1, rect=c.getBoundingClientRect();
    const old=c.toDataURL();
    c.width=Math.max(1,rect.width*ratio); c.height=Math.max(1,rect.height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0); ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round';
    if(old && old!=='data:,'){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,rect.height);img.src=old;}
  }
  resize(); window.addEventListener('resize',resize);
  c.addEventListener('pointerdown',e=>{drawing=true;last=[e.offsetX,e.offsetY];c.setPointerCapture(e.pointerId)});
  c.addEventListener('pointermove',e=>{if(!drawing)return;ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke();last=[e.offsetX,e.offsetY]});
  ['pointerup','pointercancel'].forEach(ev=>c.addEventListener(ev,()=>drawing=false));
  $('clearSignature').onclick=()=>ctx.clearRect(0,0,c.width,c.height);
  return c;
}
const signature=setupSignature();

function hasInk(c){
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  for(let i=3;i<d.length;i+=4) if(d[i]>10) return true;
  return false;
}

function collect(){
  const lines=[...document.querySelectorAll('#itemsBody tr')].map(tr=>({
    quantity:tr.querySelector('.qty-input').value.trim(),
    product:tr.querySelector('.product-input').value.trim(),
    serial:tr.querySelector('.serial-input').value.trim()
  })).filter(x=>x.product||x.serial);
  return {
    date:isoDate, client:$('client').value.trim(), destinataire:$('destinataire').value.trim(),
    adresse:$('adresse').value.trim(), ville:$('ville').value.trim(), emailClient:$('emailClient').value.trim(),
    reference:$('reference').value.trim(), lieuLivraison:$('lieuLivraison').value.trim(),
    lieuSignature:$('lieuSignature').value.trim(), dateSignature:$('dateSignature').value,
    observations:$('observations').value.trim(), lines, signature:signature.toDataURL('image/png')
  };
}

function validateData(){
  const d=collect();
  if(!d.client && !d.destinataire){alert('Renseignez au moins l’établissement / client ou le nom du destinataire.');$('client').focus();return null}
  if(!d.lines.length){alert('Ajoutez au moins un produit livré.');return null}
  if(d.lines.some(x=>!x.product)){alert('Chaque ligne utilisée doit comporter la dénomination du produit livré.');return null}
  if(!hasInk(signature)){alert('La signature du client est nécessaire pour valider le bon.');return null}
  return d;
}

async function imageData(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url})}

async function buildPdf(data){
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const margin=14, pageW=210;
  pdf.setFont('helvetica','normal');
  pdf.setTextColor(31,41,55);
  pdf.setDrawColor(23,59,99);
  pdf.setLineWidth(.8);
  pdf.line(margin,31,pageW-margin,31);
  pdf.setFontSize(22); pdf.setTextColor(23,59,99); pdf.setFont('helvetica','bold');
  pdf.text('BON DE LIVRAISON',margin,20);
  pdf.setFontSize(9); pdf.setTextColor(100,116,139); pdf.setFont('helvetica','normal');
  pdf.text('Document de livraison — EuroMed',margin,26);
  try{const logo=await imageData('euromed-logo.jpeg'); pdf.addImage(logo,'JPEG',151,8,45,16);}catch(e){}
  pdf.setFontSize(8);pdf.setTextColor(51,65,85);
  pdf.text(`Date : ${formatDate(data.date)}`,196,6,{align:'right'});
  pdf.text('+33.327.64.34.99',196,27,{align:'right'});
  pdf.text('www.euromed-materiel-medical.com',196,30,{align:'right'});
  pdf.text('117 rue de Maubeuge F-59620 Aulnoye-Aymeries',196,33,{align:'right'});

  let y=41;
  sectionPdf(pdf,'DESTINATAIRE',margin,y,182); y+=7;
  pdf.setFontSize(9);pdf.setTextColor(51,65,85);pdf.setFont('helvetica','bold');
  pdf.text(`Établissement / client : ${data.client||'—'}`,margin+3,y+5);
  pdf.text(`Destinataire : ${data.destinataire||'—'}`,margin+96,y+5);
  pdf.setFont('helvetica','normal'); pdf.text(`Adresse : ${data.adresse||'—'}`,margin+3,y+11);
  pdf.text(`CP / Ville : ${data.ville||'—'}`,margin+96,y+11);
  pdf.text(`Référence / commande : ${data.reference||'—'}`,margin+3,y+17);
  pdf.text(`E-mail : ${data.emailClient||'—'}`,margin+96,y+17);
  y+=24;

  sectionPdf(pdf,'MARCHANDISES LIVRÉES',margin,y,182); y+=9;
  const col=[margin,margin+24,margin+120,margin+181];
  pdf.setFillColor(233,240,246);pdf.setDrawColor(184,194,204);pdf.setFont('helvetica','bold');pdf.setFontSize(8);
  pdf.rect(margin,y,182,8,'FD');pdf.text('Quantité',margin+12,y+5,{align:'center'});pdf.text('Dénomination du produit livré',margin+27,y+5);pdf.text('N° de série / lot',margin+123,y+5);
  y+=8;pdf.setFont('helvetica','normal');
  data.lines.forEach((line,i)=>{
    const h=9; pdf.rect(margin,y,182,h); pdf.line(col[1],y,col[1],y+h);pdf.line(col[2],y,col[2],y+h);
    pdf.text(String(line.quantity||''),margin+12,y+5,{align:'center'});
    pdf.text(pdf.splitTextToSize(line.product,90).slice(0,2),margin+27,y+5);
    pdf.text(pdf.splitTextToSize(line.serial||'',55).slice(0,2),margin+123,y+5);
    y+=h; if(y>260){pdf.addPage();y=18;}
  });
  y+=8;
  sectionPdf(pdf,'LIVRAISON',margin,y,182); y+=9;
  pdf.setFontSize(9);pdf.text(`Lieu de livraison : ${data.lieuLivraison||'—'}`,margin+3,y+5); y+=12;
  if(data.observations){pdf.setFont('helvetica','bold');pdf.text('Observations :',margin+3,y);pdf.setFont('helvetica','normal');pdf.text(pdf.splitTextToSize(data.observations,175),margin+3,y+5);y+=Math.min(20,pdf.splitTextToSize(data.observations,175).length*4)+8}
  if(y>235){pdf.addPage();y=18;}
  pdf.setDrawColor(23,59,99);pdf.setLineWidth(.5);pdf.line(margin,y,196,y);y+=10;
  pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text('Reçu les marchandises ci-dessus en bon état',105,y,{align:'center'});y+=10;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text(`Lieu de livraison : ${data.lieuSignature||'—'}`,margin,y);pdf.text(`Date : ${formatDate(data.dateSignature)}`,196,y,{align:'right'});y+=8;
  pdf.setFont('helvetica','bold');pdf.text('Signature du client',105,y,{align:'center'});y+=3;
  try{pdf.addImage(data.signature,'PNG',65,y,80,38)}catch(e){}
  pdf.rect(60,y,90,42);y+=48;
  pdf.setFontSize(7);pdf.setTextColor(100,116,139);pdf.text('EuroMed · +33.327.64.34.99 · www.euromed-materiel-medical.com · 117 rue de Maubeuge F-59620 Aulnoye-Aymeries',105,290,{align:'center'});
  return pdf;
}
function sectionPdf(pdf,title,x,y,w){pdf.setFillColor(23,59,99);pdf.setTextColor(255,255,255);pdf.rect(x,y,w,7,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text(title,x+3,y+4.8);}

function formatDate(s){if(!s)return '—';const [y,m,d]=s.split('-');return d&&m&&y?`${d}/${m}/${y}`:s}
function dataUriToBase64(s){return s.split(',')[1]||''}
async function pdfBase64(data){const pdf=await buildPdf(data);return dataUriToBase64(pdf.output('datauristring'))}
function filename(data){return `Bon_de_livraison_${(data.client||'EuroMed').replace(/[^a-z0-9_-]/gi,'_')}_${data.date}.pdf`}

function renderDocuments(){
  const box=$('documentsList'); box.innerHTML='';
  if(!DOCUMENTS.length){box.innerHTML='<div class="no-docs">Aucun document n’est encore configuré. Les notices/protocoles seront ajoutés dans <code>config.js</code>.</div>';return}
  DOCUMENTS.forEach((doc,i)=>{
    const lab=document.createElement('label');
    lab.innerHTML=`<input type="checkbox" class="doc-check" data-index="${i}"> ${escapeHtml(doc.name||`Document ${i+1}`)}`;
    box.appendChild(lab);
  });
}
renderDocuments();

let currentData=null,currentPdfBase64=null;
$('validate').onclick=async()=>{
  const data=validateData(); if(!data)return;
  currentData=data;
  $('modalClientEmail').value=data.emailClient;
  $('sendClient').checked=!!data.emailClient;
  currentPdfBase64=null;
  $('sendStatus').textContent='Génération du bon de livraison…';
  $('sendModal').classList.remove('hidden');
  try{currentPdfBase64=await pdfBase64(data);$('sendStatus').textContent='Bon prêt. Choisissez les options d’envoi.'}
  catch(e){console.error(e);$('sendStatus').textContent='Erreur lors de la génération du PDF.'}
};
$('sendClient').onchange=()=>{$('clientEmailWrap').style.opacity=$('sendClient').checked?'1':'.55'};
$('modalClientEmail').oninput=()=>{};
$('closeModal').onclick=()=>{$('sendModal').classList.add('hidden')};

$('downloadPdf').onclick=async()=>{
  if(!currentData)return;
  try{
    if(!currentPdfBase64)currentPdfBase64=await pdfBase64(currentData);
    const a=document.createElement('a');a.href='data:application/pdf;base64,'+currentPdfBase64;a.download=filename(currentData);a.click();
  }catch(e){$('sendStatus').textContent='Impossible de générer le PDF.'}
};

$('sendNow').onclick=async()=>{
  if(!currentData||!currentPdfBase64)return;
  if(!APP_URL||APP_URL.includes('COLLER_ICI')){ $('sendStatus').innerHTML='<span class="error">Configurez d’abord GOOGLE_APPS_SCRIPT_URL dans config.js.</span>';return; }
  const sendClient=$('sendClient').checked, clientEmail=$('modalClientEmail').value.trim();
  if(sendClient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)){ $('sendStatus').innerHTML='<span class="error">Renseignez une adresse e-mail client valide.</span>';return; }
  const selected=[...document.querySelectorAll('.doc-check:checked')].map(x=>DOCUMENTS[Number(x.dataset.index)]).filter(Boolean);
  $('sendNow').disabled=true;$('sendStatus').textContent='Envoi en cours…';
  try{
    const payload={action:'send_delivery',pdf_base64:currentPdfBase64,filename:filename(currentData),data:JSON.stringify({...currentData,emailClient:clientEmail}),send_client:sendClient?'1':'0',documents:JSON.stringify(selected)};
    const body=new URLSearchParams(payload);
    const res=await fetch(APP_URL,{method:'POST',body});
    const result=await res.json();
    if(!result.ok)throw new Error(result.error||'Erreur serveur');
    $('sendStatus').innerHTML='<span class="success">✓ Bon de livraison envoyé automatiquement à EuroMed'+(sendClient?' et au client.':' .')+'</span>';
    $('status').textContent='Bon validé et envoyé.';
  }catch(e){console.error(e);$('sendStatus').innerHTML='<span class="error">Échec de l’envoi : '+escapeHtml(e.message)+'</span>'}
  finally{$('sendNow').disabled=false}
};
