const APP_URL = window.GOOGLE_APPS_SCRIPT_URL || '';
const EUROMED_EMAIL = window.EUROMED_EMAIL || '';
let DOCUMENTS = [];

const $ = id => document.getElementById(id);
const today = new Date();
const isoDate = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
const frDate = new Intl.DateTimeFormat('fr-FR').format(today);

$('todayDisplay').textContent = frDate;
$('dateSignature').value = isoDate;

function addRow(values={}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="name-input" type="text" value="${escapeHtml(values.name||'')}" placeholder="Nom"></td>
    <td><input class="qty-input" type="number" min="0" step="1" value="${escapeHtml(values.qty||'1')}" inputmode="numeric"></td>
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
    c.width=Math.max(1,Math.round(rect.width*ratio)); c.height=Math.max(1,Math.round(rect.height*ratio));
    ctx.setTransform(ratio,0,0,ratio,0,0); ctx.lineWidth=2.2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#173b63';
    if(old && old!=='data:,'){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,rect.height);img.src=old;}
  }
  resize(); window.addEventListener('resize',resize);
  c.addEventListener('pointerdown',e=>{drawing=true;last=[e.offsetX,e.offsetY];c.setPointerCapture(e.pointerId)});
  c.addEventListener('pointermove',e=>{if(!drawing)return;ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke();last=[e.offsetX,e.offsetY]});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>c.addEventListener(ev,()=>drawing=false));
  $('clearSignature').onclick=()=>{ctx.clearRect(0,0,c.width,c.height)};
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
    name:tr.querySelector('.name-input').value.trim(),
    quantity:tr.querySelector('.qty-input').value.trim(),
    product:tr.querySelector('.product-input').value.trim(),
    serial:tr.querySelector('.serial-input').value.trim()
  })).filter(x=>x.name||x.product||x.serial);
  return {
    date:isoDate, client:$('client').value.trim(),
    adresse:$('adresse').value.trim(), ville:$('ville').value.trim(), emailClient:$('emailClient').value.trim(),
    reference:$('reference').value.trim(),
    lieuSignature:$('lieuSignature').value.trim(), dateSignature:$('dateSignature').value,
    observations:$('observations').value.trim(), lines, signature:signature.toDataURL('image/png'),
    destinataireAbsent:$('destinataireAbsent').checked, deliveryPhoto:$('deliveryPhoto').dataset.dataUrl||''
  };
}

function validateData(){
  const d=collect();
  if(!d.client){alert('Renseignez l’établissement / client.');$('client').focus();return null}
  if(!d.lieuSignature){alert('Renseignez le lieu de livraison.');$('lieuSignature').focus();return null}
  if(!d.lines.length){alert('Ajoutez au moins un produit livré.');return null}
  if(d.lines.some(x=>!x.product)){alert('Chaque ligne utilisée doit comporter la dénomination du produit livré.');return null}
  if(d.destinataireAbsent){
    if(!d.deliveryPhoto){alert('Si le destinataire est absent, prenez une photo du lieu de livraison.');return null}
  }else if(!hasInk(signature)){
    alert('La signature du client est nécessaire pour valider le bon. Si le destinataire est absent, cochez « Destinataire absent » et prenez une photo.');return null
  }
  return d;
}


let jsPdfPromise=null;
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Impossible de charger '+src));document.head.appendChild(script);});}
async function ensurePdfLibrary(){
  if(window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if(!jsPdfPromise){
    jsPdfPromise=(async()=>{
      const sources=[
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      ];
      let lastError=null;
      for(const src of sources){
        try{await loadScript(src);if(window.jspdf&&window.jspdf.jsPDF)return window.jspdf.jsPDF;}catch(e){lastError=e;}
      }
      throw lastError||new Error("La bibliothèque PDF n'a pas pu être chargée.");
    })();
  }
  return jsPdfPromise;
}

async function imageData(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url})}

function pdfText(pdf,text,x,y,maxWidth,lineHeight=4,opts={}){
  const lines=pdf.splitTextToSize(String(text||''),maxWidth);
  pdf.text(lines,x,y,opts);
  return lines.length*lineHeight;
}

function pdfSection(pdf,title,y){
  const margin=12,w=186;
  pdf.setFillColor(7,87,127); pdf.roundedRect(margin,y,w,7,1.5,1.5,'F');
  pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(255,255,255);
  pdf.text(title,margin+4,y+4.8);
  return y+10;
}

function pdfFooter(pdf,pageNumber){
  pdf.setDrawColor(190,213,222);pdf.setLineWidth(.3);pdf.line(12,286,198,286);
  pdf.setFont('helvetica','normal');pdf.setFontSize(6.8);pdf.setTextColor(96,119,132);
  pdf.text('EuroMed · +33.327.64.34.99 · www.euromed-materiel-medical.com',12,291);
  pdf.text('117 rue de Maubeuge · F-59620 Aulnoye-Aymeries',105,291,{align:'center'});
  pdf.text(`Page ${pageNumber}`,198,291,{align:'right'});
}

async function buildPdf(data){
  const jsPDF=await ensurePdfLibrary();
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  const margin=12, pageW=210, contentW=186;
  const blue=[7,125,181], navy=[18,59,90], pale=[231,244,247], line=[193,215,223], text=[28,52,66], muted=[92,117,130];
  let page=1;

  function newPage(){pdf.addPage();page++;return 16}
  function ensure(y,needed){if(y+needed>278){pdfFooter(pdf,page);return newPage()}return y}

  // Header
  pdf.setFillColor(...pale);pdf.roundedRect(10,9,190,34,3,3,'F');
  pdf.setFillColor(...blue);pdf.roundedRect(10,9,5,34,2,2,'F');
  pdf.setFont('helvetica','bold');pdf.setFontSize(23);pdf.setTextColor(...navy);pdf.text('BON DE LIVRAISON',20,22);
  pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(...muted);pdf.text('Document de livraison · EuroMed',20,28);
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(...navy);pdf.text('DATE DU JOUR',20,36);
  pdf.setFontSize(10);pdf.text(formatDate(data.date),52,36);
  try{const logo=await imageData('euromed-logo.jpeg');pdf.addImage(logo,'JPEG',135,12,61,16);}catch(e){}
  pdf.setFont('helvetica','normal');pdf.setFontSize(7.2);pdf.setTextColor(...muted);
  pdf.text('+33.327.64.34.99',198,31,{align:'right'});pdf.text('www.euromed-materiel-medical.com',198,35,{align:'right'});pdf.text('117 rue de Maubeuge · F-59620 Aulnoye-Aymeries',198,39,{align:'right'});

  let y=49;
  y=pdfSection(pdf,'DESTINATAIRE',y);
  pdf.setDrawColor(...line);pdf.setFillColor(250,253,254);pdf.roundedRect(margin,y,contentW,30,2,2,'FD');
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(...navy);
  pdf.text('ÉTABLISSEMENT / CLIENT',17,y+7);pdf.text('ADRESSE',17,y+16);pdf.text('CP / VILLE',113,y+16);pdf.text('RÉFÉRENCE / COMMANDE',17,y+25);pdf.text('E-MAIL',113,y+25);
  pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(...text);
  pdf.text(pdf.splitTextToSize(data.client||'—',90).slice(0,1),17,y+11);pdf.text(pdf.splitTextToSize(data.adresse||'—',90).slice(0,1),17,y+20);pdf.text(pdf.splitTextToSize(data.ville||'—',80).slice(0,1),113,y+20);pdf.text(pdf.splitTextToSize(data.reference||'—',90).slice(0,1),17,y+29);pdf.text(pdf.splitTextToSize(data.emailClient||'—',80).slice(0,1),113,y+29);
  y+=38;

  y=pdfSection(pdf,'MARCHANDISES LIVRÉES',y);
  const cols=[12,45,63,128,198], headers=['Nom','Quantité','Dénomination du produit livré','N° de série / lot'];
  const headerH=9;pdf.setFillColor(...pale);pdf.setDrawColor(...line);pdf.rect(12,y,186,headerH,'FD');
  pdf.setFont('helvetica','bold');pdf.setFontSize(7.5);pdf.setTextColor(...navy);
  pdf.text(headers[0],14,y+5.7);pdf.text(headers[1],54,y+5.7,{align:'center'});pdf.text(headers[2],66,y+5.7);pdf.text(headers[3],132,y+5.7);
  y+=headerH;pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(...text);
  data.lines.forEach((line,idx)=>{
    const name=pdf.splitTextToSize(line.name||'—',29).slice(0,2), prod=pdf.splitTextToSize(line.product||'—',61).slice(0,2), serial=pdf.splitTextToSize(line.serial||'—',65).slice(0,2);
    const maxLines=Math.max(name.length,prod.length,serial.length,1), h=Math.max(9,maxLines*4+5);
    if(y+h>275){pdfFooter(pdf,page);y=newPage();y=pdfSection(pdf,'MARCHANDISES LIVRÉES · SUITE',y);pdf.setFillColor(...pale);pdf.rect(12,y,186,headerH,'FD');pdf.setFont('helvetica','bold');pdf.setFontSize(7.5);pdf.setTextColor(...navy);pdf.text(headers[0],14,y+5.7);pdf.text(headers[1],54,y+5.7,{align:'center'});pdf.text(headers[2],66,y+5.7);pdf.text(headers[3],132,y+5.7);y+=headerH;pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(...text)}
    if(idx%2===1){pdf.setFillColor(249,252,253);pdf.rect(12,y,186,h,'F')}
    pdf.setDrawColor(...line);pdf.rect(12,y,186,h);[45,63,128].forEach(x=>pdf.line(x,y,x,y+h));
    pdf.text(name,14,y+5);pdf.text(String(line.quantity||''),54,y+5,{align:'center'});pdf.text(prod,66,y+5);pdf.text(serial,131,y+5);y+=h;
  });

  y+=7;y=ensure(y,38);y=pdfSection(pdf,'OBSERVATIONS',y);
  pdf.setFillColor(250,253,254);pdf.setDrawColor(...line);const obsLines=pdf.splitTextToSize(data.observations||'Aucune observation',178);const obsH=Math.max(18,obsLines.length*4+8);pdf.roundedRect(12,y,186,obsH,2,2,'FD');pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(...text);pdf.text(obsLines,16,y+7);y+=obsH+8;

  y=ensure(y,78);y=pdfSection(pdf,'RÉCEPTION DE LA LIVRAISON',y);
  pdf.setFillColor(...pale);pdf.roundedRect(12,y,186,13,2,2,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(10.5);pdf.setTextColor(...navy);pdf.text('Reçu les marchandises ci-dessus en bon état',105,y+8.3,{align:'center'});y+=18;
  pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(...navy);pdf.text('LIEU DE LIVRAISON',14,y);pdf.text('DATE',150,y);pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(...text);pdf.text(data.lieuSignature||'—',14,y+6);pdf.text(formatDate(data.dateSignature),150,y+6);y+=12;

  if(data.destinataireAbsent){
    pdf.setFillColor(255,247,232);pdf.setDrawColor(236,174,74);pdf.roundedRect(12,y,186,10,2,2,'FD');pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(142,87,12);pdf.text('DESTINATAIRE ABSENT · PHOTO DU LIEU DE LIVRAISON JOINTE',105,y+6.5,{align:'center'});y+=14;
    const boxH=58;pdf.setDrawColor(...line);pdf.rect(53,y,104,boxH);try{pdf.addImage(data.deliveryPhoto,'JPEG',55,y+2,100,54,{compression:'MEDIUM'});}catch(e){}y+=boxH+7;
  }else{
    pdf.setFillColor(248,251,252);pdf.setDrawColor(...line);pdf.roundedRect(12,y,186,48,2,2,'FD');pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(...navy);pdf.text('SIGNATURE DU CLIENT',105,y+7,{align:'center'});pdf.rect(58,y+11,94,32);try{pdf.addImage(data.signature,'PNG',60,y+12,90,30);}catch(e){}y+=54;
  }

  pdfFooter(pdf,page);
  return pdf;
}

function formatDate(s){if(!s)return '—';const [y,m,d]=s.split('-');return d&&m&&y?`${d}/${m}/${y}`:s}
function dataUriToBase64(s){return s.split(',')[1]||''}
async function pdfBase64(data){const pdf=await buildPdf(data);return dataUriToBase64(pdf.output('datauristring'))}
function filename(data){return `Bon_de_livraison_${(data.client||'EuroMed').replace(/[^a-z0-9_-]/gi,'_')}_${data.date}.pdf`}

function githubApiUrl(){
  const owner=window.GITHUB_OWNER, repo=window.GITHUB_REPO, path=window.GITHUB_DOCUMENTS_PATH||'documents';
  const branch=window.GITHUB_BRANCH||'main';
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
}

async function loadGithubDocuments(){
  const box=$('documentsList');box.innerHTML='<div class="no-docs">Chargement des notices et protocoles…</div>';
  if(!window.GITHUB_OWNER || window.GITHUB_OWNER==='A_REMPLACER' || !window.GITHUB_REPO){box.innerHTML='<div class="no-docs">Configurez le dépôt GitHub dans <code>config.js</code>.</div>';return}
  try{
    const res=await fetch(githubApiUrl(),{headers:{Accept:'application/vnd.github+json'}});if(!res.ok)throw new Error(`GitHub (${res.status})`);const files=await res.json();
    DOCUMENTS=files.filter(f=>f.type==='file'&&/\.pdf$/i.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(f=>({name:f.name.replace(/\.pdf$/i,''),path:f.path,url:`https://raw.githubusercontent.com/${window.GITHUB_OWNER}/${window.GITHUB_REPO}/${window.GITHUB_BRANCH}/${f.path.split('/').map(encodeURIComponent).join('/')}`}));
    box.innerHTML='';if(!DOCUMENTS.length){box.innerHTML='<div class="no-docs">Aucun PDF trouvé dans le dossier GitHub configuré.</div>';return}
    DOCUMENTS.forEach((doc,i)=>{const lab=document.createElement('label');lab.innerHTML=`<input type="checkbox" class="doc-check" data-index="${i}"> ${escapeHtml(doc.name)}`;box.appendChild(lab)});
  }catch(e){console.error(e);box.innerHTML=`<div class="no-docs error">Impossible de charger les documents GitHub : ${escapeHtml(e.message)}.</div>`}
}
loadGithubDocuments();

async function compressPhoto(file){
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const img=await imageData(dataUrl);const max=1600,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));const canvas=document.createElement('canvas');canvas.width=Math.round((img.naturalWidth||img.width)*scale);canvas.height=Math.round((img.naturalHeight||img.height)*scale);const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.78);
}
$('destinataireAbsent').onchange=async()=>{if(!$('destinataireAbsent').checked){$('deliveryPhoto').value='';delete $('deliveryPhoto').dataset.dataUrl;$('photoPreview').classList.add('hidden');$('photoStatus').textContent='';return}$('photoStatus').textContent='Ouverture de l’appareil photo…';$('deliveryPhoto').click()};
$('deliveryPhoto').onchange=async()=>{const file=$('deliveryPhoto').files&&$('deliveryPhoto').files[0];if(!file)return;try{const dataUrl=await compressPhoto(file);$('deliveryPhoto').dataset.dataUrl=dataUrl;$('photoPreview').src=dataUrl;$('photoPreview').classList.remove('hidden');$('photoStatus').textContent='✓ Photo enregistrée et ajoutée au bon de livraison.'}catch(e){console.error(e);$('photoStatus').textContent='Impossible de traiter la photo.'}};

let currentData=null,currentPdfBase64=null;
$('validate').onclick=async()=>{const data=validateData();if(!data)return;currentData=data;$('modalClientEmail').value=data.emailClient;$('sendClient').checked=!!data.emailClient;currentPdfBase64=null;$('sendStatus').textContent='Génération du bon de livraison…';$('sendModal').classList.remove('hidden');try{currentPdfBase64=await pdfBase64(data);$('sendStatus').textContent='✓ Bon prêt. Choisissez les options d’envoi.'}catch(e){console.error('PDF:',e);$('sendStatus').innerHTML='<span class="error">Erreur lors de la génération du PDF : '+escapeHtml(e&&e.message?e.message:String(e))+'</span>'}};
$('sendClient').onchange=()=>{$('clientEmailWrap').style.opacity=$('sendClient').checked?'1':'.55'};$('clientEmailWrap').style.opacity=$('sendClient').checked?'1':'.55';$('closeModal').onclick=()=>{$('sendModal').classList.add('hidden')};
$('downloadPdf').onclick=async()=>{if(!currentData)return;try{if(!currentPdfBase64)currentPdfBase64=await pdfBase64(currentData);const a=document.createElement('a');a.href='data:application/pdf;base64,'+currentPdfBase64;a.download=filename(currentData);a.click()}catch(e){console.error('PDF:',e);$('sendStatus').innerHTML='<span class="error">Impossible de générer le PDF : '+escapeHtml(e&&e.message?e.message:String(e))+'</span>'}};
$('sendNow').onclick=async()=>{if(!currentData||!currentPdfBase64)return;if(!APP_URL||APP_URL.includes('COLLER_ICI')){$('sendStatus').innerHTML='<span class="error">Configurez d’abord GOOGLE_APPS_SCRIPT_URL dans config.js.</span>';return}const sendClient=$('sendClient').checked,clientEmail=$('modalClientEmail').value.trim();if(sendClient&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)){$('sendStatus').innerHTML='<span class="error">Renseignez une adresse e-mail client valide.</span>';return}const selected=[...document.querySelectorAll('.doc-check:checked')].map(x=>DOCUMENTS[Number(x.dataset.index)]).filter(Boolean);$('sendNow').disabled=true;$('sendStatus').textContent='Envoi en cours…';try{const payload={action:'send_delivery',pdf_base64:currentPdfBase64,filename:filename(currentData),data:JSON.stringify({...currentData,emailClient:clientEmail}),send_client:sendClient?'1':'0',documents:JSON.stringify(selected),photo_base64:dataUriToBase64(currentData.deliveryPhoto||''),photo_filename:currentData.destinataireAbsent?'Photo_lieu_livraison_'+currentData.date+'.jpg':''};const body=new URLSearchParams(payload);const res=await fetch(APP_URL,{method:'POST',body});const result=await res.json();if(!result.ok)throw new Error(result.error||'Erreur serveur');$('sendStatus').innerHTML='<span class="success">✓ Bon envoyé automatiquement à EuroMed'+(sendClient?' et au client.':'.')+'</span>';$('status').textContent='Bon validé et envoyé.'}catch(e){console.error(e);$('sendStatus').innerHTML='<span class="error">Échec de l’envoi : '+escapeHtml(e.message)+'</span>'}finally{$('sendNow').disabled=false}};
