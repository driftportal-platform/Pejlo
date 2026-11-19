// These messages describe why Pejlo is waiting, without inferring radio signal strength.
export function gpsStatus(data, now = Date.now()) {
 const position = data?.position;
 const age = position ? Math.max(0, (now - position.timestamp) / 1000) : null;
 if (data?.positionLookupFailed) return {
  label: 'Positionsopslag fejlede',
  detail: 'Ny position kunne ikke hentes fra Traccar.',
  waiting: true
 };
 if (data?.telemetry?.gpsClockAhead) return {
  label: 'Tidsfejl fra trackeren',
  detail: 'Trackeren melder GPS-tid efter modtagelsestidspunktet.',
  waiting: true
 };
 if (data?.gpsProvisional) return {
  label: 'Afventer bekræftet position',
  detail: 'Første GPS-position afventer en ny måling som bekræftelse.',
  waiting: true
 };
 if (data?.gpsUncertain) return {
  label: age != null && age <= 180 ? 'Afventer stabil position' : 'Usikker GPS-position',
  detail: 'Nyere GPS-data kunne ikke godkendes af positionsfilteret.',
  waiting: true
 };
 return {
  label: age == null ? 'Afventer GPS' : age > 300 ? 'Gammel position' : 'Seneste registrering',
  detail: age == null ? 'Afventer en gyldig GPS-position.' : '',
  waiting: age == null
 };
}
