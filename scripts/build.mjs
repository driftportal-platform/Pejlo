import {cpSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
rmSync('dist/src',{recursive:true,force:true});
mkdirSync('dist',{recursive:true});
const index=readFileSync('apps/web/index.html','utf8');
const auth=index.match(/<!-- shared-auth:start -->([\s\S]*?)<!-- shared-auth:end -->/)?.[1];
if(!auth)throw new Error('Fælles login mangler i index.html.');
const admin=readFileSync('apps/web/admin.html','utf8').replace('<!-- shared-auth -->',()=>auth);
writeFileSync('dist/index.html',index);
mkdirSync('dist/admin',{recursive:true});
writeFileSync('dist/admin/index.html',admin);
cpSync('apps/web/sw.js','dist/sw.js');
cpSync('apps/web/manifest.webmanifest','dist/manifest.webmanifest');
cpSync('apps/web/src','dist/src',{recursive:true});
cpSync('packages/shared','dist/src/shared',{recursive:true});
cpSync('apps/web/_headers','dist/_headers');

// Public map credentials belong to the application, never to user profiles.
const mapKey=(process.env.MAPTILER_API_KEY??'').trim();
if(mapKey&&!/^[A-Za-z0-9_-]{1,200}$/.test(mapKey))throw new Error('MAPTILER_API_KEY skal indeholde selve kortnøglen, ikke en URL.');
writeFileSync('dist/src/config/maps.js','export const mapConfig = '+JSON.stringify({apiKey:mapKey,defaultLayer:'streets'})+';\n');
if(!mapKey)console.warn('Pejlo: MAPTILER_API_KEY mangler i buildmiljøet. Geografiske kort aktiveres først efter nyt build med nøgle.');
