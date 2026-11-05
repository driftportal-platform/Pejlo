// All positions are illustrative. Nothing here comes from the real tracker.
export const route = [{lat:56.5495,lon:8.311},{lat:56.5499,lon:8.3118},{lat:56.5505,lon:8.3124},{lat:56.551,lon:8.3132},{lat:56.5514,lon:8.3143},{lat:56.5512,lon:8.3151},{lat:56.5508,lon:8.3156},{lat:56.5506,lon:8.3158}];
const started = Date.now();
export function demoFor(profile) {
  const offset = Array.from(profile.id).reduce((n,c)=>n+c.charCodeAt(0),0) % 8 * .0001;
  const points = route.map(p=>({lat:p.lat+offset,lon:p.lon-offset}));
  return {route:points,position:{...points.at(-1),timestamp:started-90000,valid:true,battery:76},source:'demo'};
}
