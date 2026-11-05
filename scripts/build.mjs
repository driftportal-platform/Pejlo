import {cpSync,mkdirSync,rmSync} from 'node:fs';
rmSync('dist/src',{recursive:true,force:true});
mkdirSync('dist',{recursive:true});
cpSync('apps/web/index.html','dist/index.html');
cpSync('apps/web/manifest.webmanifest','dist/manifest.webmanifest');
cpSync('apps/web/src','dist/src',{recursive:true});
cpSync('packages/shared','dist/src/shared',{recursive:true});
cpSync('apps/web/_headers','dist/_headers');
