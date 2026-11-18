export function traccarOrigin(env) {
 try {
  const url = new URL(env.TRACCAR_URL || 'https://demo3.traccar.org');
  if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
   return url.origin;
  }
 } catch {
  // An invalid runtime configuration must never receive the access token.
 }
 return null;
}
