import {validPoint} from '../shared/geo.js';

export function directionsURL(position) {
  return validPoint(position) ? 'https://www.google.com/maps/dir/?' + new URLSearchParams({
    api: '1', destination: position.lat + ',' + position.lon, travelmode: 'walking'
  }) : '';
}

export function createHandoff({request, identifier, position, notice}) {
  const panel = document.querySelector('#shared-handoff');
  const status = document.querySelector('#shared-handoff-status');
  const mapStatus = document.querySelector('#map-handoff-status');
  const start = document.querySelector('#shared-handoff-start');
  const stop = document.querySelector('#shared-handoff-stop');
  let tracker, value, offset = 0, generation = 0, pending = false, errorMessage = '';

  const paused = () => (value?.handoff?.until ?? 0) > Date.now() + offset;
  function render() {
    panel.hidden = !tracker;
    const isPaused = paused();
    const message = isPaused
      ? value.handoff.name + ' henter. Beskeder for profilen er på pause i ' +
        Math.ceil((value.handoff.until - Date.now() - offset) / 60000) + ' min.'
      : errorMessage || (value ? 'Ingen fælles pause er aktiv.' : 'Henter fælles status…');
    if (status.textContent !== message) status.textContent = message;
    mapStatus.hidden = !isPaused;
    const mapMessage = isPaused ? message : '';
    if (mapStatus.textContent !== mapMessage) mapStatus.textContent = mapMessage;
    start.hidden = !value?.canStart || isPaused;
    stop.hidden = !isPaused || !value.handoff.canStop;
    start.disabled = stop.disabled = pending;
  }
  function clear() {
    generation++;
    tracker = value = null;
    pending = false;
    errorMessage = '';
    render();
  }
  async function load(force = false, action) {
    const next = identifier();
    if (next !== tracker) clear();
    if (!next || pending || (!force && tracker === next)) return;
    tracker = next;
    const current = ++generation;
    pending = true;
    render();
    try {
      const result = await request(action ? 'handoff' : 'handoff?identifier=' + encodeURIComponent(next),
        action ? {identifier: next, ...action} : undefined);
      if (current !== generation) return;
      errorMessage = '';
      value = result;
      offset = result.serverTime - Date.now();
    } catch (error) {
      if (current !== generation) return;
      if (action) notice(error.message);
      else errorMessage = error.message;
    } finally {
      if (current === generation && pending) {pending = false; render();}
    }
  }
  start.onclick = () => {
    if (window.confirm('Sæt beskeder for denne profil på pause for alle i én time?')) {
      load(true, {action: 'start', position: position()});
    }
  };
  stop.onclick = () => {if (paused()) load(true, {action: 'stop', id: value.handoff.id});};
  return {load, clear, paused, tick: render};
}
