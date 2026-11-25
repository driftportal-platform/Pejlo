// Small local charts: no third-party scripts or extra API requests.
const ns='http://www.w3.org/2000/svg';
const known=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export const chartNumber=value=>known(value)?value.toLocaleString('da-DK',{maximumFractionDigits:2}):'Ukendt';
export const shortDay=day=>day.split('-').slice(1).reverse().join('.');

export function renderHistoryChart(root,{title,labels,values,unit,max,kind='bars',notes=[],tone='green'}){
 if(!root)return;
 const doc=root.ownerDocument;
 const html=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const svg=(tag,attrs={},text)=>{const e=doc.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))e.setAttribute(key,String(value));if(text!==undefined)e.textContent=text;return e;};
 root.replaceChildren();root.className='history-chart '+tone;
 root.append(html('h4',title));
 const count=values.filter(known).length;
 if(!count){root.append(html('p','Ingen målinger i perioden. Ukendt vises ikke som nul.','hint chart-empty'));return;}
 const ceiling=max??Math.max(1,...values.filter(known))*1.1;
 const graph=svg('svg',{viewBox:'0 0 520 180',role:'group','aria-label':title+' i '+unit});
 const x=i=>48+(i+0.5)*456/Math.max(values.length,1),y=v=>145-Math.min(ceiling,v)/ceiling*120;
 for(const value of [0,ceiling/2,ceiling]){
  graph.append(svg('line',{x1:48,x2:504,y1:y(value),y2:y(value),class:'chart-grid'}));
  graph.append(svg('text',{x:42,y:y(value)+4,'text-anchor':'end',class:'chart-axis'},chartNumber(value)));
 }
 graph.append(svg('text',{x:48,y:14,class:'chart-axis'},unit));
 let segment=[];
 const flush=()=>{if(segment.length>1)graph.append(svg('polyline',{points:segment.join(' '),class:'chart-line',fill:'none'}));segment=[];};
 const marks=[];
 values.forEach((value,i)=>{
  const label=labels[i]+': '+(known(value)?chartNumber(value)+' '+unit:'Ukendt')+(notes[i]?' · '+notes[i]:'');
  if(!known(value)){flush();const mark=svg('text',{x:x(i),y:140,'text-anchor':'middle',class:'chart-missing',role:'img','aria-label':label},'–');mark.append(svg('title',{},label));marks.push(mark);return;}
  if(kind==='line')segment.push(x(i)+','+y(value));
  const mark=kind==='line'?svg('circle',{cx:x(i),cy:y(value),r:4,class:notes[i]==='Oplader'?'chart-point charging':'chart-point'}):svg('rect',{x:x(i)-Math.min(25,330/values.length)/2,y:y(value),width:Math.min(25,330/values.length),height:Math.max(2,145-y(value)),rx:2,class:'chart-bar'});
  mark.setAttribute('tabindex','0');mark.setAttribute('role','img');mark.setAttribute('aria-label',label);mark.append(svg('title',{},label));marks.push(mark);
 });
 flush();graph.append(...marks);
 for(const i of [...new Set([0,Math.floor((labels.length-1)/2),labels.length-1])].filter(i=>i>=0))graph.append(svg('text',{x:i===0?48:i===labels.length-1?504:x(i),y:169,'text-anchor':i===0?'start':i===labels.length-1?'end':'middle',class:'chart-axis'},labels[i]));
 root.append(graph,html('p',count+' af '+values.length+' perioder med data. Streg = ukendt. Tryk eller hold på et punkt for værdien.','hint chart-caption'));
 // A single selected reading is readable by touch as well as keyboard.
 const readout=html('p','Vælg et punkt for at se målingen.','chart-readout');readout.setAttribute('aria-live','polite');root.append(readout);
 for(const mark of marks)for(const event of ['click','focus','pointerenter'])mark.addEventListener(event,()=>{readout.textContent=mark.getAttribute('aria-label');});
 graph.addEventListener('click',event=>{
  if(!Number.isFinite(event.clientX)||event.detail===0)return;
  const bounds=graph.getBoundingClientRect(),at=(event.clientX-bounds.left)/bounds.width*520;
  const index=Math.max(0,Math.min(values.length-1,Math.floor((at-48)/456*values.length)));
  readout.textContent=marks[index].getAttribute('aria-label');
 });
}

export function renderActivityOverview(root,rows,goal,today){
 if(!root)return;root.replaceChildren();const doc=root.ownerDocument;
 const row=rows.find(r=>r.day===today)||rows.at(-1),target=row?.day===today?goal:row?.goalKm??null,label=row?.day===today?'I dag':row?'Den '+shortDay(row.day):'Valgt periode';
 const heading=doc.createElement('p');heading.className='overview-day';heading.textContent=label;root.append(heading);
 const grid=doc.createElement('div');grid.className='activity-status-grid';root.append(grid);
 for(const item of [
  {title:'Kilometer',value:row?.km,unit:'km',max:target,note:row?.km==null?'Afventer brugbare data':row.source==='manual'?'Manuelt registreret':'GPS-estimat',tail:target==null?'Intet dagligt mål valgt':(row?.day===today?'Dagligt mål: ':'Mål ved registrering: ')+chartNumber(target)+' km',tone:'green'},
  {title:'Samlet hvile',value:row?.restHours,unit:'timer',max:24,note:row?.restSource==='manual'?'Manuelt registreret / rettet':row?.restSource==='registered'?'Registreret hvile, eventuelt suppleret med estimat':row?.restSource==='estimated'?'Mulig hvile – ikke målt søvn':'Afventer målinger eller registrering',tail:row?.restHours==null?'Ingen hvile registreret':chartNumber(row.restHours)+' af døgnets 24 timer registreret som hvile',tone:'blue'}
 ]){
  const card=doc.createElement('section');card.className='activity-status-card '+item.tone;
  for(const [tag,text] of [['h3',item.title],['strong',known(item.value)?chartNumber(item.value)+' '+item.unit:'Ukendt'],['small',item.note]]){const e=doc.createElement(tag);e.textContent=text;card.append(e);}
  const track=doc.createElement('div');track.className='activity-meter';
  if(known(item.value)&&item.max>0){const meter=doc.createElement('meter');meter.min=0;meter.max=item.max;meter.value=Math.min(item.value,item.max);meter.setAttribute('aria-label',item.title);meter.textContent=chartNumber(item.value)+' / '+chartNumber(item.max);track.append(meter);}
  else{track.className+=' unknown';track.setAttribute('aria-label',item.max==null?'Intet mål valgt':'Ukendt værdi');}
  const caption=doc.createElement('small');caption.textContent=item.tail;card.append(track,caption);grid.append(card);
 }
}
