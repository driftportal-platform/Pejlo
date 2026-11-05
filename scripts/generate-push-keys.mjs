// Run locally once. Never commit the generated private key.
const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
const jwk=await crypto.subtle.exportKey('jwk',key.privateKey);
console.log('VAPID_PUBLIC_KEY='+Buffer.from(pub).toString('base64url'));
console.log('VAPID_PRIVATE_KEY='+jwk.d);
console.log('VAPID_SUBJECT=mailto:Driftportal.platform@gmail.com');
