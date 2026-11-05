const rad = Math.PI / 180;
export function distance(a, b) {
  const x = (b.lat - a.lat) * rad, y = (b.lon - a.lon) * rad;
  const h = Math.min(1, Math.max(0, Math.sin(x / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(y / 2) ** 2));
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function bearing(a, b) {
  const d = (b.lon - a.lon) * rad;
  return (Math.atan2(Math.sin(d) * Math.cos(b.lat * rad), Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(d)) / rad + 360) % 360;
}
export const relativeBearing = (target, heading) => (target - heading + 360) % 360;
export const formatDistance = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
export const directionName = deg => ['nord', 'nordøst', 'øst', 'sydøst', 'syd', 'sydvest', 'vest', 'nordvest'][Math.round(deg / 45) % 8];
export function searchZoom(meters, accuracy = 0) {
  const z = meters > 1000 ? 14 : meters > 500 ? 15 : meters > 200 ? 16 : meters > 80 ? 17 : meters > 30 ? 18 : 19;
  return Math.min(z, accuracy > 100 ? 15 : accuracy > 50 ? 16 : accuracy > 20 ? 17 : 19);
}
export const validPoint = p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
