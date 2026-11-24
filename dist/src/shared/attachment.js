export function cleanAttachment(value,trackerId,now=Date.now()){
 if(!trackerId||!value||value.trackerId!==trackerId||!['worn','removed'].includes(value.state)||!Number.isFinite(value.since)||value.since<=0||value.since>now+60000)return null;
 return {state:value.state,since:value.since,trackerId};
}
export function updateAttachment(previous,state,trackerId,now=Date.now()){
 if(!trackerId||!['worn','removed'].includes(state))return null;
 const old=cleanAttachment(previous,trackerId,now);
 return old?.state===state?old:{state,since:now,trackerId};
}
export function attachmentText(profile){
 const value=cleanAttachment(profile?.attachment,profile?.trackerId);
 if(!value)return 'Det er ikke bekræftet, om trackeren er påsat.';
 return (value.state==='worn'?'Markeret som påsat ':'Markeret som taget af ')+profile.name+' · '+new Date(value.since).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
