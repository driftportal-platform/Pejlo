const KEY='pejlo-map-layer';
const supported=['demo','streets','satellite','outdoor'];
export function loadMapLayer(fallback='satellite'){
  try {const saved=localStorage.getItem(KEY);if(supported.includes(saved))return saved;}catch{}
  return supported.includes(fallback)?fallback:'satellite';
}
export function saveMapLayer(layer){
  if(!supported.includes(layer))return;
  try {localStorage.setItem(KEY,layer);}catch{}
}
