// Requested intervals, never a claim about the firmware's active power state.
export function nextBatteryTarget(policy, observation, now) {
 const state={...policy};
 if(state.find_until>now)return {state,seconds:30,reason:'find'};
 if(!state.auto_enabled)return {state,seconds:state.resume_seconds||60,reason:'normal'};
 // Three distinct fresh fingerprints over at least two minutes before slowing down.
 if(observation?.kind==='inside'){
  if(observation.at>Number(state.sample_at||0)){
   const contiguous=state.sample_at&&observation.at-state.sample_at<=180000;
   state.inside_count=contiguous?Number(state.inside_count||0)+1:1;
   state.inside_since=contiguous?state.inside_since:observation.at;
   state.sample_at=observation.at;
  }
  if(state.inside_count>=3&&observation.at-state.inside_since>=120000)return {state,seconds:120,reason:'home'};
  return {state,seconds:60,reason:'learning'};
 }
 state.inside_count=0;state.inside_since=0;state.sample_at=0;
 return {state,seconds:60,reason:observation?.kind==='outside'?'outside':'unknown'};
}
