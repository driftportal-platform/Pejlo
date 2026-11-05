# Kontrol af 0.4

16 tests består ved npm test: geoberegninger, profilvalidering, lokal migrering, tom start, verificeringskrav, kontoskift, serverkrav før åbning og revisionskonflikter.

Ingen live Firebase-konti oprettet. Ingen mail afsendt i udviklingskontrollen. Firestore-reglerne er ikke afprøvet i emulator eller mod det aktive projekt. Mobilkompas, fysisk tracker og geografiske kort med en kundes MapTiler-nøgle er ikke afprøvet.

Se START_HER.md for nødvendige Firebase-indstillinger og manuel afprøvning.

0.4.1: Fælles nøgleindsætning i build, standardlaget gadekort og afvisning af URL som nøgle er testet. Gamle kontonøgler tilsidesætter ikke appkonfigurationen. Login starter i browseren uden appfejl, og kortnøgleformularen er fjernet. Rigtige kortfliser med ejerens nøgle er endnu ikke afprøvet.
