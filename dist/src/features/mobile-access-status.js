export function mobileAccessText({enabled=null,error=false}={}){
 const known=typeof enabled==='boolean';
 if(!known)return error?'Kontostatus kunne ikke hentes. Prøv Opdatér kontostatus.':'Henter kontostatus…';
 const status=enabled?'Slået til for din konto.':'Slået fra for din konto. Kontakt administratoren, hvis det skal ændres.';
 return error?'Senest kendte status: '+status+' Den aktuelle status kunne ikke hentes.':status;
}
