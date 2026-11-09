const requestLabel = {renew: 'Forlængelse', cancel: 'Opsigelse'};
const statusLabel = {active: 'Aktivt', trial: 'Prøveperiode', paused: 'Sat på pause', expired: 'Udløbet', none: 'Intet abonnement'};
const dateFormat = new Intl.DateTimeFormat('da-DK', {dateStyle: 'medium', timeZone: 'Europe/Copenhagen'});
const $ = id => document.getElementById(id);

export function createMySubscription({request}) {
 const open = $('open-my-subscription');
 const dialog = $('my-subscription');
 const summary = $('my-subscription-summary');
 const status = $('my-subscription-status');
 const renew = $('my-subscription-renew');
 const cancel = $('my-subscription-cancel');
 const retry = $('my-subscription-retry');
 let generation = 0, busy = false;

 function enable(allowed) {
  open.hidden = !allowed;
  if (!allowed) {
   generation++;
   busy = false;
   dialog.close();
   summary.textContent = status.textContent = '';
  }
 }

 function render(data) {
  const {subscription, request: latest} = data;
  const parts = [subscription.plan, statusLabel[subscription.status]].filter(Boolean);
  if (subscription.stage !== 'none') {
   const days = subscription.daysToExpiry;
   if (subscription.expiresOn) parts.push('Udløbsdato: ' + dateFormat.format(new Date(subscription.expiresOn)));
   if (days === 0) parts.push('Udløber i dag');
   if (days > 0) parts.push(days + (days === 1 ? ' dag tilbage' : ' dage tilbage'));
   if (!subscription.expiresOn) parts.push('Ingen udløbsdato registreret');
  }
  summary.textContent = parts.join(' · ');
  const pending = latest?.handledAt === null;
  status.textContent = latest
   ? requestLabel[latest.kind] + (pending ? ' · afventer behandling' : ' · behandlet')
   : '';
  renew.hidden = pending || subscription.stage === 'none';
  cancel.hidden = renew.hidden || subscription.daysToExpiry < 0;
 }

 async function load(kind) {
  if (open.hidden || busy) return;
  const current = ++generation;
  busy = true;
  status.textContent = kind ? 'Sender anmodning…' : 'Henter abonnement…';
  renew.hidden = cancel.hidden = retry.hidden = true;
  try {
   const data = await request('subscription', kind ? {kind} : undefined);
   if (current === generation) render(data);
  } catch (error) {
   if (current === generation) {
    status.textContent = error.message;
    retry.hidden = false;
   }
  } finally {
   if (current === generation) busy = false;
  }
 }

 open.onclick = () => {summary.textContent = '';dialog.showModal();load();};
 retry.onclick = () => load();
 renew.onclick = () => load('renew');
 cancel.onclick = () => {
  if (window.confirm('Vil du sende en anmodning om at opsige dit abonnement?')) load('cancel');
 };
 return {enable};
}

export function createSubscriptionQueue({request, openCustomer}) {
 const reload = $('reload-subscription-requests');
 const list = $('admin-subscription-requests');
 const status = $('admin-subscription-request-status');
 let generation = 0, allowed = false, busy = false;

 function enable(value) {
  allowed = value;
  if (!value) {
   generation++;
   busy = false;
   reload.disabled = false;
   list.replaceChildren();
   status.textContent = '';
  }
 }

 function render({requests, hasMore}) {
  list.replaceChildren();
  status.textContent = requests.length
   ? (hasMore ? 'Viser de 30 ældste anmodninger.' : requests.length + ' afventer behandling.')
   : 'Ingen anmodninger afventer behandling.';
  for (const item of requests) {
   const row = document.createElement('p');
   const description = document.createElement('span');
   description.textContent = requestLabel[item.kind] + ' · ' + (item.email || item.uid) + ' · ' + dateFormat.format(new Date(item.createdAt));
   const actions = document.createElement('span');
   actions.className = 'button-row';
   if (item.email) {
    const customer = document.createElement('button');
    customer.type = 'button';
    customer.className = 'text-button';
    customer.textContent = 'Åbn kunde';
    customer.onclick = () => openCustomer(item.email);
    actions.append(customer);
   }
   const handled = document.createElement('button');
   handled.type = 'button';
   handled.className = 'outline-button';
   handled.textContent = 'Markér behandlet';
   handled.onclick = () => load({id: item.id, uid: item.uid});
   actions.append(handled);
   row.append(description, actions);
   list.append(row);
  }
 }

 async function load(resolution) {
  if (!allowed || busy) return;
  const current = ++generation;
  busy = reload.disabled = true;
  status.textContent = 'Henter anmodninger…';
  try {
   if (resolution) await request('admin/subscription-requests', resolution);
   if (current !== generation) return;
   const data = await request('admin/subscription-requests');
   if (current === generation) render(data);
  } catch (error) {
   if (current === generation) status.textContent = error.message;
  } finally {
   if (current === generation) busy = reload.disabled = false;
  }
 }

 reload.onclick = () => load();
 return {enable};
}
