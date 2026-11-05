export async function profilePhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Vælg et JPG-, PNG- eller WebP-billede.');
 if(file.size>10*1024*1024)throw Error('Billedet må højst fylde 10 MB.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,128);
  const size=Math.min(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,128,128);
  for(const quality of [.8,.6,.4,.25]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=12000)return result;}
  throw Error('Billedet kunne ikke komprimeres. Prøv et andet billede.');
 }finally{URL.revokeObjectURL(url);}
}
