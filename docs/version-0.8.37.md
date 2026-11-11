# Pejlo 0.8.37

Ved kundesletning skal Firestore først bekræfte sletning af kundens profildokument. Ved fejl bliver kontoen stående på pause, og Systemadmin viser en fejlbesked. Kontrollér, at tjenestekontoen må slette profildokumentet i Firestore, og prøv igen. Derefter slettes data i Pejlos database og til sidst kundens Firebase-login.

Ved en entydig afvisning fra Traccar kan ejeren prøve trackerkommandoen igen med det samme. Timeout, serverfejl og svar om kø beholder den normale ventetid. Trackeren kan allerede have fået kommandoen i de tilfælde.

GitHub-pakken indeholder også .firebaserc og .gitignore fra 0.8.35.
