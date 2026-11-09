import {firebaseConfig} from '../web/src/config/firebase.js';

const googleTokenUrl = 'https://oauth2.googleapis.com/token';

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function googleAccessToken(secret, fetcher, scope, now = new Date()) {
  const credentials = JSON.parse(secret);
  if (!credentials.client_email || credentials.project_id !== firebaseConfig.projectId) {
    throw new Error('Google-kontoen passer ikke til Pejlos Firebase-projekt.');
  }
  const pem = credentials.private_key.replace(/-----[A-Z ]+-----|\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), char => char.charCodeAt(0)),
    {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign']
  );
  const encode = value => base64Url(new TextEncoder().encode(JSON.stringify(value)));
  const iat = Math.floor(now.getTime() / 1000);
  const assertion = encode({alg: 'RS256', typ: 'JWT'}) + '.' + encode({
    iss: credentials.client_email, scope,
    aud: googleTokenUrl, iat, exp: iat + 600
  });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(assertion));
  const response = await fetcher(googleTokenUrl, {
    redirect: 'error', signal: AbortSignal.timeout(8000),
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion + '.' + base64Url(new Uint8Array(signature))
    })
  });
  if (!response.ok) throw new Error('Google-adgang mangler.');
  const result = await response.json();
  if (!result.access_token) throw new Error('Google-adgang mangler.');
  return result.access_token;
}
