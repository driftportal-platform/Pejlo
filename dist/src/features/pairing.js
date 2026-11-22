const identifierOK=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{4,100}$/.test(v);
const codeOK=v=>typeof v==='string'&&/^[A-Z0-9-]{16,80}$/i.test(v);
export function pairingLink(identifier,code,origin){
 if(!identifierOK(identifier)||!codeOK(code))throw Error('Ugyldig parringskode.');
 const url=new URL('/',origin);if(!['https:','http:'].includes(url.protocol))throw Error('Ugyldig appadresse.');url.hash=new URLSearchParams({parring:identifier,kode:code}).toString();return url.href;
}
export function parsePairing(value,origin){
 try{if(typeof value!=='string'||value.length>2048)return null;const url=new URL(value,origin);if(url.origin!==new URL(origin).origin)return null;const p=new URLSearchParams(url.hash.slice(1)),identifier=p.get('parring'),code=p.get('kode');return identifierOK(identifier)&&codeOK(code)?{identifier,code}:null;}catch{return null;}
}
export async function drawPairingQR(root,text){
 root.replaceChildren();const {default:QRCode}=await import('../vendor/qrcode.js');new QRCode(root,{text,width:256,height:256,useSVG:true,correctLevel:QRCode.CorrectLevel.M});
 root.removeAttribute('title');root.setAttribute('role','img');root.setAttribute('aria-label','QR-kode med parringslink. Del kun med trackerens ejer.');
}
