import {PROFILE_PHOTO_LIMIT} from '../shared/profiles.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function photoCrop(width,height,zoom,x,y){
 const size=Math.min(width,height)/zoom,half=size/2;
 return {
  size,
  x:clamp(x,half,width-half)-half,
  y:clamp(y,half,height-half)-half
 };
}

function drawCrop(canvas,image,crop,size){
 const context=canvas.getContext('2d');
 context.imageSmoothingQuality='high';
 context.fillStyle='#fff';
 context.fillRect(0,0,size,size);
 context.drawImage(image,crop.x,crop.y,crop.size,crop.size,0,0,size,size);
}

function encodePhoto(image,crop){
 const canvas=document.createElement('canvas');
 for(const resolution of [384,320,256,192,128]){
  const size=Math.min(resolution,Math.max(1,Math.floor(crop.size)));
  canvas.width=canvas.height=size;
  drawCrop(canvas,image,crop,size);
  for(const quality of [.9,.8,.7,.6]){
   const photo=canvas.toDataURL('image/jpeg',quality);
   if(photo.length<=PROFILE_PHOTO_LIMIT)return photo;
  }
 }
 throw Error('Billedet kunne ikke komprimeres. Prøv et andet billede.');
}

export function createPhotoEditor(dialog){
 const canvas=dialog.querySelector('canvas');
 const zoom=dialog.querySelector('input');
 const status=dialog.querySelector('[role="status"]');
 let draft,request=0;

 function draw(){
  const {image,x,y}=draft;
  const crop=photoCrop(image.naturalWidth,image.naturalHeight,Number(zoom.value),x,y);
  draft.crop=crop;
  draft.x=crop.x+crop.size/2;
  draft.y=crop.y+crop.size/2;
  drawCrop(canvas,image,crop,canvas.width);
 }
 function move(dx,dy){
  draft.x-=dx*draft.crop.size;
  draft.y-=dy*draft.crop.size;
  draw();
 }

 zoom.addEventListener('input',()=>{if(draft)draw();});
 canvas.addEventListener('pointerdown',event=>{
  if(!draft||!event.isPrimary||event.button!==0)return;
  canvas.setPointerCapture(event.pointerId);
  draft.pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
 });
 canvas.addEventListener('pointermove',event=>{
  const pointer=draft?.pointer;
  if(pointer?.id!==event.pointerId)return;
  const width=canvas.getBoundingClientRect().width;
  if(!width)return;
  move((event.clientX-pointer.x)/width,(event.clientY-pointer.y)/width);
  pointer.x=event.clientX;
  pointer.y=event.clientY;
 });
 canvas.addEventListener('lostpointercapture',event=>{
  if(draft?.pointer?.id===event.pointerId)draft.pointer=null;
 });
 canvas.addEventListener('keydown',event=>{
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(!draft||!direction)return;
  event.preventDefault();
  move(direction[0]*.025,direction[1]*.025);
 });
 dialog.querySelector('[data-photo-cancel]').addEventListener('click',()=>dialog.close());
 dialog.querySelector('[data-photo-save]').addEventListener('click',()=>{
  if(!draft)return;
  try{
   draft.photo=encodePhoto(draft.image,draft.crop);
   dialog.close();
  }catch(error){status.textContent=error.message;}
 });
 dialog.addEventListener('close',()=>{
  const finished=draft;
  draft=null;
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  finished?.resolve(finished.photo??null);
 });

 async function open(file,isCurrent){
  const id=++request;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Vælg et JPG-, PNG- eller WebP-billede.');
  if(file.size>10*1024*1024)throw Error('Billedet må højst fylde 10 MB.');
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;
   try{await image.decode();}
   catch{throw Error('Billedet kunne ikke åbnes. Prøv et andet billede.');}
   if(id!==request||!isCurrent()||dialog.open||draft)return null;
   zoom.value='1';
   status.textContent='';
   return await new Promise(resolve=>{
    draft={image,x:image.naturalWidth/2,y:image.naturalHeight/2,resolve};
    draw();
    dialog.showModal();
   });
  }finally{URL.revokeObjectURL(url);}
 }

 return {open,close(){request++;if(dialog.open)dialog.close();}};
}
