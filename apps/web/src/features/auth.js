import {firebaseConfig,SDK_VERSION} from '../config/firebase.js';
const $=s=>document.querySelector(s);
const messages={
 'auth/invalid-credential':'E-mail eller adgangskode er forkert.',
 'auth/invalid-login-credentials':'E-mail eller adgangskode er forkert.',
 'auth/wrong-password':'E-mail eller adgangskode er forkert.',
 'auth/user-not-found':'E-mail eller adgangskode er forkert.',
 'auth/email-already-in-use':'Kontoen kan ikke oprettes med denne e-mail. Prøv at logge ind eller nulstille adgangskoden.',
 'auth/weak-password':'Adgangskoden opfylder ikke projektets krav. Vælg en længere og stærkere adgangskode.',
 'auth/password-does-not-meet-requirements':'Adgangskoden opfylder ikke projektets krav.',
 'auth/invalid-email':'Skriv en gyldig e-mailadresse.',
 'auth/too-many-requests':'Der er foretaget for mange forsøg. Vent lidt, og prøv igen.',
 'auth/network-request-failed':'Ingen forbindelse til loginserveren. Kontrollér internettet.',
 'auth/operation-not-allowed':'E-mail/adgangskode er ikke aktiveret i Firebase Authentication endnu.',
 'auth/configuration-not-found':'Firebase Authentication er endnu ikke sat op i projektet.',
 'auth/unauthorized-domain':'Webadressen er ikke godkendt under Firebase Authentication → Settings → Authorized domains.'
};
// Pejlo only uses e-mail and password, so the popup/redirect resolver (which loads Google's apis.google.com script
// and an iframe) is left out. getAuth() would add it automatically.
export function createAuth(authSDK,app){
 try{return authSDK.initializeAuth(app,{persistence:[authSDK.indexedDBLocalPersistence,authSDK.browserLocalPersistence,authSDK.browserSessionPersistence]});}
 catch(error){if(error?.code==='auth/already-initialized')return authSDK.getAuth(app);throw error;}
}
export const authError=e=>messages[e?.code]??'Handlingen kunne ikke gennemføres. Prøv igen.';
export async function startAuthentication(onSession){
 let appSDK,authSDK,dbSDK;
 const message=t=>{$('#auth-message').textContent=t;};
 try{[appSDK,authSDK,dbSDK]=await Promise.all(['app','auth','firestore'].map(name=>import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-${name}.js`)));}
 catch{message('Login kunne ikke indlæses. Kontrollér internetforbindelsen, og genindlæs siden.');$('#auth-retry').hidden=false;return;}
 const app=appSDK.initializeApp(firebaseConfig),auth=createAuth(authSDK,app),db=dbSDK.getFirestore(app);
 auth.languageCode='da';let mode='login';
 const actionSettings={url:window.location.origin+'/',handleCodeInApp:false};
 function setMode(m){mode=m;$('#auth-password-wrap').hidden=m==='reset';$('#auth-confirm-wrap').hidden=m!=='signup';$('#auth-remember-wrap').hidden=m==='reset';$('#auth-password').required=m!=='reset';$('#auth-confirm').required=m==='signup';$('#auth-password').minLength=m==='signup'?10:1;$('#auth-password').autocomplete=m==='signup'?'new-password':'current-password';$('#auth-title').textContent={login:'Velkommen til Pejlo',signup:'Opret din konto',reset:'Glemt adgangskode?'}[m];$('#auth-submit').textContent={login:'Log ind',signup:'Opret konto',reset:'Send nulstillingsmail'}[m];$('#auth-password').value='';$('#auth-confirm').value='';message('');document.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===m));}
 document.querySelectorAll('[data-auth-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.authMode));
 async function run(action){$('#auth-submit').disabled=true;try{await action();}catch(e){message(authError(e));}finally{$('#auth-submit').disabled=false;}}
 $('#auth-form').onsubmit=e=>{e.preventDefault();run(async()=>{
  const email=$('#auth-email').value.trim(),password=$('#auth-password').value;
  if(mode==='reset'){await authSDK.sendPasswordResetEmail(auth,email,actionSettings);message('Hvis e-mailadressen er knyttet til en konto, modtager du en mail med næste trin.');return;}
  if(mode==='signup'&&password!==$('#auth-confirm').value){message('De to adgangskoder er ikke ens.');return;}
  await authSDK.setPersistence(auth,$('#auth-remember').checked?authSDK.browserLocalPersistence:authSDK.browserSessionPersistence);
  if(mode==='signup'){
   const result=await authSDK.createUserWithEmailAndPassword(auth,email,password);$('#auth-password').value='';$('#auth-confirm').value='';
   try{await authSDK.sendEmailVerification(result.user,actionSettings);message('Bekræftelsesmail sendt. Se også i spam.');}catch(e){message('Kontoen er oprettet, men mailen kunne ikke sendes. Brug Send bekræftelsesmail igen.');}
  }else{await authSDK.signInWithEmailAndPassword(auth,email,password);$('#auth-password').value='';}
 });};
 $('#account-logout').onclick=async()=>{try{if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.getRegistration('/');const sub=await registration?.pushManager.getSubscription();if(sub){try{const token=await auth.currentUser.getIdToken();await fetch('/api/push/remove',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()}),signal:AbortSignal.timeout(5000)});}catch{}await sub.unsubscribe();}}await authSDK.signOut(auth);}catch(e){message(authError(e));}};
 $('#verify-resend').onclick=async e=>{e.target.disabled=true;try{await authSDK.sendEmailVerification(auth.currentUser,actionSettings);message('Bekræftelsesmail sendt. Se også i spam.');}catch(error){message(authError(error));}finally{e.target.disabled=false;}};
 $('#verify-check').onclick=async e=>{e.target.disabled=true;try{await authSDK.reload(auth.currentUser);await auth.currentUser.getIdToken(true);await changed(auth.currentUser);if(!auth.currentUser.emailVerified)message('E-mailen er ikke bekræftet endnu. Åbn linket i mailen, og prøv igen.');}catch(error){message(authError(error));}finally{e.target.disabled=false;}};
 async function changed(user){
  $('.app').hidden=true;$('#auth-shell').hidden=false;$('#account-toolbar').hidden=!user;$('#auth-form-area').hidden=!!user;$('#verify-panel').hidden=!user||user.emailVerified;$('#auth-loading').hidden=!user||!user.emailVerified;
  $('#account-email').textContent=user?.email??'';$('#verify-email').textContent=user?.email??'';message('');
  if(!user){$('#auth-password').value='';$('#auth-confirm').value='';setMode('login');}
  await onSession(user,{db,dbSDK,auth});
 }
 $('#cloud-retry').onclick=()=>changed(auth.currentUser);
 authSDK.onAuthStateChanged(auth,user=>changed(user).catch(()=>message('Kontoen kunne ikke indlæses. Prøv igen.')),e=>message(authError(e)));
 $('#auth-boot').hidden=true;setMode('login');
}
