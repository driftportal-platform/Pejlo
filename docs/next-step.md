# Arkitektur og næste trin · 0.4

Firebase Authentication håndterer personligt login. Firestore gemmer én privat profiltilstand pr. verificeret UID med revisionsbaserede transaktioner. Sikkerhedsregler ligger i firestore.rules og skal udgives særskilt.

Appen har en injicerbar cloud-adapter, så kontoskift og samtidighed kan testes uden live konti. Gamle browserprofiler importeres kun ved aktivt valg. Der er ingen automatisk lokal fallback ved cloudfejl.

Næste trin er serververificeret tracker-ejerskab og tilknytning, en Traccar-adapter og dernæst familiedeling med serverkontrollerede medlemsrettigheder. Del ikke kontoens adgangskode for at efterligne familiedeling.

Alle målpositioner er stadig lokale eksempeldata. Mobilens egen position sendes ikke til Firestore af denne app. Profilens valgte hjemmeområde gemmes på kontoen.
