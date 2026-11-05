export function createLocation(onPosition, onError, onHeading) {
  let watcher = null, listening = false;
  const compass = e => {
    if (Number.isFinite(e.webkitCompassHeading) && (!Number.isFinite(e.webkitCompassAccuracy) || (e.webkitCompassAccuracy >= 0 && e.webkitCompassAccuracy <= 35))) onHeading(e.webkitCompassHeading);
    else if (e.absolute === true && Number.isFinite(e.alpha)) onHeading((360-e.alpha)%360);
  };
  function stop() {
    if (watcher !== null) navigator.geolocation?.clearWatch(watcher);
    watcher = null;
    window.removeEventListener('deviceorientation', compass);
    window.removeEventListener('deviceorientationabsolute', compass);
    listening = false;
  }
  return {
    start() {
      if (!navigator.geolocation || !window.isSecureContext) return onError('Placering kræver HTTPS og en browser med GPS-adgang.');
      stop();
      watcher = navigator.geolocation.watchPosition(p=>onPosition({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>onError(e.code===1?'Placering er afvist. Tillad placering i browserens indstillinger.':'Placeringen kunne ikke hentes. Prøv igen med frit udsyn.'),{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
    },
    async compass() {
      const Event = window.DeviceOrientationEvent;
      if (!Event) return onError('Kompas er ikke tilgængeligt. Retningen vises med nord op.');
      try {
        if (typeof Event.requestPermission === 'function' && await Event.requestPermission() !== 'granted') return onError('Kompas er ikke tilladt. Retningen vises med nord op.');
        if (!listening) {window.addEventListener('deviceorientation',compass);window.addEventListener('deviceorientationabsolute',compass);listening=true;}
        return true;
      } catch {onError('Kompas kunne ikke startes. Retningen vises med nord op.');}
    }, stop
  };
}
