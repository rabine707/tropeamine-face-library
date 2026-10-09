
const $=id=>document.getElementById(id),model='https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',sources=[],crops=[];let ready=false,current=0,selection=null,drag=null,editingCrop=null;let cardAssignments=[];
function status(s){$('status').textContent=s}
function characterName(s){return (s||'').trim()||'Unsorted'}
$('cards').addEventListener('change',()=>{cardAssignments=[...$('cards').files].map(f=>({file:f.name,character:$('character').value.trim()}));const root=$('cardAssignments');root.replaceChildren();cardAssignments.forEach((item,i)=>{const label=document.createElement('label');label.textContent=item.file+' — character';const input=document.createElement('input');input.type='text';input.placeholder='Character name (or leave unsorted)';input.value=item.character;input.addEventListener('input',()=>item.character=input.value);label.append(input);root.append(label)})});function safe(s){return (s||'character').trim().replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'character'}
(async()=>{try{if(!window.faceapi)throw Error('face-api.js could not load');await faceapi.nets.ssdMobilenetv1.loadFromUri(model);ready=true;status('Detector ready. Choose card images to begin.');$('scan').disabled=false}catch(e){status('Model failed to load: '+e.message+'. Check your connection and refresh.')}})();
async function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Cannot open '+file.name))};img.src=url})}
function makeCrop(img,box,name){const x=Math.max(0,Math.floor(box.x)),y=Math.max(0,Math.floor(box.y)),w=Math.min(img.naturalWidth-x,Math.ceil(box.width)),h=Math.min(img.naturalHeight-y,Math.ceil(box.height));if(w<8||h<8)return null;const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);return {url:c.toDataURL('image/png'),name:name||'face',width:w,height:h}}
function portraitBox(b,img,padding=0){const aspect=4/5;const cx=b.x+b.width/2,cy=b.y+b.height/2;let w=Math.max(b.width*(1+2*padding),b.height*(1+2*padding)*aspect),h=w/aspect;const factor=Math.min(1,img.naturalWidth/w,img.naturalHeight/h);w*=factor;h*=factor;const unit=Math.floor(Math.min(w/4,h/5));w=unit*4;h=unit*5;const x=Math.max(0,Math.min(img.naturalWidth-w,Math.round(cx-w/2))),y=Math.max(0,Math.min(img.naturalHeight-h,Math.round(cy-h/2)));return {x,y,width:w,height:h}}
function faceBox(b,img){const padding={tight:.08,balanced:.22,loose:.36}[$('tightness').value]??.08;return portraitBox(b,img,padding)}
$('scan').onclick=async()=>{if(!ready)return;const files=[...$('cards').files];if(!files.length){status('Choose at least one card.');return}$('scan').disabled=true;try{for(const file of files){status('Scanning '+file.name+'…');const img=await loadImage(file);const detections=await faceapi.detectAllFaces(img,new faceapi.SsdMobilenetv1Options({minConfidence:.3,maxResults:100}));const character=characterName(cardAssignments.find((a)=>a.file===file.name)?.character);const index=sources.push({img,file,character,boxes:detections.map(d=>faceBox(d.box,img))})-1;for(let i=0;i<detections.length;i++){const crop=makeCrop(img,sources[index].boxes[i],safe($('character').value)+'-'+safe(file.name.replace(/\.[^.]+$/,''))+'-face-'+(i+1));if(crop){crop.character=character;crop.sourceIndex=index;crop.box=sources[index].boxes[i];crops.push(crop)}}status(file.name+': '+detections.length+' faces detected.')}refreshSources();render();$('editorPanel').classList.remove('hidden');$('manual').disabled=false;status('Scan complete. Review crops or add missed faces manually.')}catch(e){status('Scan error: '+e.message)}finally{$('scan').disabled=false}};
function refreshSources(){const sel=$('source');sel.innerHTML='';sources.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=s.file.name;sel.append(o)});current=Math.min(current,sources.length-1);sel.value=current;draw()}
$('source').onchange=e=>{current=+e.target.value;selection=null;draw()};$('manual').onclick=()=>{$('editorPanel').classList.remove('hidden');$('editorPanel').scrollIntoView({behavior:'smooth'});draw()};
function draw(){const s=sources[current];if(!s)return;const c=$('preview'),ctx=c.getContext('2d'),scale=Math.min(1,700/s.img.naturalWidth,520/s.img.naturalHeight);c.width=Math.round(s.img.naturalWidth*scale);c.height=Math.round(s.img.naturalHeight*scale);c.dataset.scale=scale;ctx.drawImage(s.img,0,0,c.width,c.height);ctx.lineWidth=2;ctx.strokeStyle='#ebbc71';s.boxes.forEach(b=>ctx.strokeRect(b.x*scale,b.y*scale,b.width*scale,b.height*scale));if(selection){ctx.strokeStyle='#fa6fb3';ctx.lineWidth=3;ctx.strokeRect(selection.x*scale,selection.y*scale,selection.width*scale,selection.height*scale)}}
function point(e){const c=$('preview'),r=c.getBoundingClientRect(),s=sources[current],x=(e.clientX-r.left)*c.width/r.width/Number(c.dataset.scale),y=(e.clientY-r.top)*c.height/r.height;return {x:Math.max(0,Math.min(s.img.naturalWidth,x)),y:Math.max(0,Math.min(s.img.naturalHeight,y))}}
$('preview').onpointerdown=e=>{if(!sources.length)return;drag=point(e);selection={x:drag.x,y:drag.y,width:0,height:0};e.target.setPointerCapture(e.pointerId)};
$('preview').onpointermove=e=>{if(!drag)return;const p=point(e);selection={x:Math.min(p.x,drag.x),y:Math.min(p.y,drag.y),width:Math.abs(p.x-drag.x),height:Math.abs(p.y-drag.y)};draw()};
$('preview').onpointerup=()=>{drag=null};$('clearSelection').onclick=()=>{selection=null;editingCrop=null;$('saveManual').textContent='Save selected crop';draw()};
$('saveManual').onclick=()=>{if(!selection)return status('Draw a rectangle on the card first.');const s=sources[current],box=portraitBox(selection,s.img,0),crop=makeCrop(s.img,box,safe(s.character)+'-manual-'+(crops.length+1));if(!crop)return status('Crop is too small.');crop.sourceIndex=current;crop.box=box;if(editingCrop!==null&&crops.includes(editingCrop)){const original=editingCrop;cancelEnhancement(original);crop.character=original.character;crop.name=original.name;crops[crops.indexOf(original)]=crop;status('Crop updated at original source resolution.')}else{crop.character=s.character||'Unsorted';crops.push(crop);status('Manual crop added.')}editingCrop=null;selection=null;$('saveManual').textContent='Save selected crop';draw();render()};
function download(c){const a=document.createElement('a');a.href=c.url;a.download=safe(c.name)+'.png';document.body.append(a);a.click();a.remove()}
function render(){const g=$('gallery');g.innerHTML='';$('count').textContent='('+crops.length+')';$('downloadAll').disabled=!crops.length;crops.forEach((c,i)=>{const t=document.createElement('div');t.className='tile';const img=document.createElement('img');img.src=c.url;img.alt='Face crop';const inp=document.createElement('input');inp.type='text';inp.value=c.name;inp.setAttribute('aria-label','Crop filename');inp.onchange=()=>c.name=inp.value;const small=document.createElement('small');small.textContent=c.width+' × '+c.height+' pixels';const groupLabel=document.createElement('label');groupLabel.textContent='Character';const groupInput=document.createElement('input');groupInput.type='text';groupInput.value=c.character||'Unsorted';groupInput.setAttribute('aria-label','Character for crop '+(i+1));groupInput.onchange=()=>{c.character=characterName(groupInput.value)};groupLabel.append(groupInput);const down=document.createElement('button');down.textContent='Download original';down.onclick=()=>download(c);const edit=document.createElement('button');edit.className='secondary';edit.textContent='Edit Crop';edit.onclick=()=>{if(c.sourceIndex===undefined||!sources[c.sourceIndex])return status('Original card is no longer available for editing.');editingCrop=c;current=c.sourceIndex;selection={...c.box};$('editorPanel').classList.remove('hidden');$('source').value=current;$('saveManual').textContent='Replace this crop';draw();$('editorPanel').scrollIntoView({behavior:'smooth'});status('Drag a new selection on the card, then click Replace this crop.')};const del=document.createElement('button');del.className='secondary';del.textContent='Remove';del.onclick=()=>{cancelEnhancement(c);if(editingCrop===c)editingCrop=null;crops.splice(crops.indexOf(c),1);render()};t.append(img,groupLabel,inp,small,document.createElement('br'),edit,down,del);t.append(enhancementControls(c));g.append(t)})}
$('downloadAll').onclick=async()=>{if(!crops.length)return;if(!window.JSZip){status('ZIP library could not load. Check your connection and refresh.');return}const btn=$('downloadAll');btn.disabled=true;try{status('Preparing ZIP with '+crops.length+' face crops…');const zip=new JSZip(),used=new Set(),includeCopies=$('zipEnhanced').checked;for(let i=0;i<crops.length;i++){const c=crops[i],folder=safe(characterName(c.character));let name=safe(c.name)||'face-'+(i+1);let unique=name,n=2;while(used.has((folder+'/'+unique).toLowerCase()))unique=name+'-'+n++;used.add((folder+'/'+unique).toLowerCase());zip.folder(folder).file(unique+'.png',c.url.split(',')[1],{base64:true});if(includeCopies&&c.enhanced){const e=c.enhanced,stem=unique+(e.blend>0?'-enhanced-':'-resized-')+e.scale+'x',copyFolder=folder+(e.blend>0?'/enhanced':'/resized');zip.folder(copyFolder).file(stem+'.png',e.url.split(',')[1],{base64:true});const {url,sourceUrl,...metadata}=e;zip.folder(copyFolder).file(stem+'.json',JSON.stringify({...metadata,original:unique+'.png'},null,2))}}const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Tropeamine-Organized-Faces.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status('ZIP ready: '+crops.length+' faces in one download.')}catch(e){status('ZIP download failed: '+e.message)}finally{btn.disabled=false}};
$('clear').onclick=()=>{if(!crops.length||confirm('Remove all extracted faces from this gallery?')){cancelEnhancement();editingCrop=null;crops.length=0;render()}};

let activeEnhancement = null, comparedCrop = null;
$('enhanceBlend').oninput = () => { $('blendValue').value = $('enhanceBlend').value + '%'; };
$('enhanceMode').onchange = () => { $('enhanceBlend').disabled = $('enhanceMode').value !== 'ai'; render(); };

function cancelEnhancement(crop) {
  if (activeEnhancement && (!crop || activeEnhancement.crop === crop)) {
    activeEnhancement.controller.abort();
  }
  if (!crop || comparedCrop === crop) {
    $('comparison').close();
    comparedCrop = null;
    $('compareOriginal').removeAttribute('src');
    $('compareEnhanced').removeAttribute('src');
  }
}

async function enhanceCrop(crop) {
  if (activeEnhancement) return;
  const scale = Number($('enhanceScale').value), blend = $('enhanceMode').value === 'ai' ? Number($('enhanceBlend').value) : 0;
  try { FaceEnhancement.validate(crop, scale, blend); }
  catch (error) { crop.enhanceMessage = error.message; render(); return; }
  const job = { crop, sourceUrl: crop.url, controller: new AbortController(), progress: 0, message: 'Preparing enhancement…' };
  activeEnhancement = job;
  crop.enhanceMessage = '';
  render();
  try {
    const result = await FaceEnhancement.enhance(crop, {
      scale, blend, signal: job.controller.signal,
      progress: (value, message) => {
        job.progress = value; job.message = message;
        const root = crop.enhanceRoot;
        if (root?.isConnected && !job.controller.signal.aborted) {
          root.querySelector('progress').value = value;
          root.querySelector('[role=status]').textContent = message + ' ' + Math.round(value * 100) + '%';
        }
      },
    });
    // Editing/removing a crop while awaiting inference must never reattach stale pixels.
    if (!job.controller.signal.aborted && crops.includes(crop) && crop.url === job.sourceUrl) {
      crop.enhanced = result;
      crop.enhanceMessage = result.blend > 0 ? `${scale}× AI candidate ready. Compare before using it; character consistency is not validated.` : `${scale}× resized copy ready. No AI detail was added. The original remains your reference master.`;
    }
  } catch (error) {
    if (crops.includes(crop)) crop.enhanceMessage = job.controller.signal.aborted || error.name === 'AbortError'
      ? 'Cancelled. Your original is unchanged.'
      : 'Enhancement failed: ' + error.message + ' Your original is unchanged. You can try again.';
  } finally {
    if (activeEnhancement === job) activeEnhancement = null;
    render();
  }
}

function enhancementControls(crop) {
  const root = document.createElement('div');
  root.className = 'enhanceControls';
  crop.enhanceRoot = root;
  const running = activeEnhancement?.crop === crop;
  const enhance = document.createElement('button');
  enhance.className = 'secondary'; enhance.textContent = $('enhanceMode').value === 'ai' ? (crop.enhanced ? 'Enhance again' : 'Enhance copy') : (crop.enhanced ? 'Resize again' : 'Resize copy');
  enhance.disabled = !!activeEnhancement;
  enhance.onclick = () => enhanceCrop(crop);
  root.append(enhance);
  const progress = document.createElement('progress');
  progress.max = 1; progress.value = running ? activeEnhancement.progress : 0;
  progress.hidden = !running;
  progress.setAttribute('aria-label', 'Crop enhancement progress');
  const message = document.createElement('p');
  message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  message.textContent = running ? activeEnhancement.message : crop.enhanceMessage || 'Optional. Choose resize or AI enhancement above. Originals are exported by default.';
  if (running) {
    const cancel = document.createElement('button');
    cancel.className = 'secondary'; cancel.textContent = 'Cancel enhancement';
    cancel.onclick = () => { cancelEnhancement(crop); cancel.disabled = true; message.textContent = 'Cancelling…'; };
    root.append(cancel);
  }
  root.append(progress, message);
  if (crop.enhanced) {
    const e = crop.enhanced;
    const details = document.createElement('p');
    details.textContent = `${e.width} × ${e.height} pixels · ${e.scale}× · ` + (e.blend > 0 ? `${e.blend}% AI blend · unvalidated candidate` : 'ordinary resize · no AI model');
    const compare = document.createElement('button');
    compare.className = 'secondary'; compare.textContent = 'Compare';
    compare.onclick = () => showComparison(crop);
    const downloadEnhanced = document.createElement('button');
    downloadEnhanced.textContent = e.blend > 0 ? 'Download enhanced' : 'Download resized';
    downloadEnhanced.onclick = () => download({ url: crop.enhanced.url, name: crop.name + (crop.enhanced.blend > 0 ? '-enhanced-' : '-resized-') + crop.enhanced.scale + 'x' });
    const discard = document.createElement('button');
    discard.className = 'secondary'; discard.textContent = e.blend > 0 ? 'Discard enhanced' : 'Discard resized';
    discard.onclick = () => { cancelEnhancement(crop); delete crop.enhanced; crop.enhanceMessage = ''; render(); };
    root.append(details, compare, downloadEnhanced, discard);
  }
  return root;
}

function showComparison(crop) {
  comparedCrop = crop;
  const e = crop.enhanced;
  $('compareOriginal').src = crop.url;
  $('compareEnhanced').src = e.url;
  $('compareCopyLabel').textContent = e.blend > 0 ? 'AI candidate — unvalidated' : 'Resized copy — no AI';
  $('compareInfo').textContent = `${crop.name}: original ${crop.width} × ${crop.height} → ${e.width} × ${e.height} · ${e.scale}× · ${e.blend}% AI blend · ${e.model}`;
  $('compareZoom').checked = false;
  setComparisonZoom();
  $('comparison').showModal();
}
function setComparisonZoom() {
  const width = $('compareZoom').checked && comparedCrop ? comparedCrop.enhanced.width + 'px' : '100%';
  $('compareOriginal').style.width = $('compareEnhanced').style.width = width;
  $('compareOriginal').style.maxHeight = $('compareEnhanced').style.maxHeight = $('compareZoom').checked ? 'none' : '480px';
}
$('compareZoom').onchange = setComparisonZoom;
$('closeCompare').onclick = () => $('comparison').close();
$('comparison').addEventListener('close', () => {
  comparedCrop = null;
  $('compareOriginal').removeAttribute('src');
  $('compareEnhanced').removeAttribute('src');
});
