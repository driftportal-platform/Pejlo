// Bars are a guide to reported RSSI / satellite count, never a GPS accuracy estimate.
export function signalStatus(data,now=Date.now()){
 const t=data?.telemetry;
 const fresh=Number.isFinite(t?.receivedAt)&&t.receivedAt<=now+60000&&now-t.receivedAt<=300000;
 const offline=data?.device?.status==='offline';
 const sat=Number.isInteger(t?.satellites)&&t.satellites>=0&&t.satellites<=255?t.satellites:null;
 const rssi=Number.isInteger(t?.rssi)&&t.rssi>=0?t.rssi:null;
 const mobileKnown=t?.rssiMax===31&&rssi!=null&&rssi<=31;
 const mobileLevel=mobileKnown?(rssi===0?0:rssi<10?1:rssi<15?2:rssi<20?3:4):0;
 const satLevel=sat==null?0:sat===0?0:sat<4?1:sat<6?2:sat<9?3:4;
 const mobile={level:mobileLevel,tone:mobileKnown?(mobileLevel<=1?'poor':mobileLevel===2?'warning':'good'):'unknown',
  value:mobileKnown?['Meget svagt','Svagt','Middel','Godt','Stærkt'][mobileLevel]:(rssi==null?'Ikke oplyst':'Ukendt skala'),
  note:rssi==null?'Afventer signaldata':'RSSI '+rssi+(mobileKnown?' / 31 · vejledende':'')};
 const satellite={level:satLevel,tone:sat==null?'unknown':satLevel<=1?'poor':satLevel===2?'warning':'good',
  value:sat==null?'Ikke oplyst':sat+' satellitter',note:'Rapporteret antal · ikke præcision'};
 if(t?.gpsClockAhead){satellite.tone='warning';satellite.note='Tidsfejl · GPS-tid skal kontrolleres';}
 if(offline||!fresh){
  for(const card of [mobile,satellite]){card.level=0;card.tone='unknown';}
  mobile.note+=(offline?' · offline':' · ældre/udateret måling');
  satellite.note+=(offline?' · offline':' · ældre/udateret måling');
 }
 return {mobile,satellite,receivedAt:t?.receivedAt??null};
}
export function renderSignalBar(data,ageText){
 const status=signalStatus(data);
 for(const name of ['mobile','satellite']){
  const root=document.getElementById('signal-'+name),card=status[name];
  root.dataset.tone=card.tone;
  root.querySelector('[data-signal-value]').textContent=card.value;
  root.querySelector('[data-signal-note]').textContent=card.note;
  root.querySelectorAll('.signal-bars i').forEach((bar,i)=>bar.classList.toggle('is-filled',i<card.level));
 }
 document.getElementById('tracker-signal-updated').textContent=status.receivedAt!=null
  ?'Signaldata modtaget '+ageText(status.receivedAt)+'.'
  :'Afventer daterede signaldata fra trackeren.';
}
