// Runs a schema step at most once per database binding (per Worker isolate).
// A failed step is retried on the next call.
const done=new WeakMap();
export function once(db,key,work){
 let steps=done.get(db);if(!steps){steps=new Map();done.set(db,steps);}
 if(!steps.has(key))steps.set(key,Promise.resolve().then(work).catch(error=>{steps.delete(key);throw error;}));
 return steps.get(key);
}
