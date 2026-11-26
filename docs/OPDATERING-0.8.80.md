# Pejlo 0.8.80 – Wi-Fi og inde/ude-opsætning

Wi-Fi-opsætningen har et tydeligt trinforløb: mål inde, bekræft hjemmets punkter og mål ude. Allerede bekræftede punkter genbruges. En signalvisning viser trackerens rapporterede dBm, alder, antal fundne punkter og hvor mange der matcher hjemmet. Styrkeordene er vejledende, ikke en måling af afstand eller en garanti for dækning.

Efter gemning kan inde- og udemålingernes gennemsnit sammenlignes. Hvert gennemsnit bruger det stærkeste valgte punkt i hver mærket rapport. Den eksisterende vurdering af, om mønstrene kan skelnes, bruges fortsat; forskellen mellem to gennemsnit alene afgør ikke inde eller ude.

Appen genfinder også Wi-Fi i den positionshistorik, som allerede hentes fra Traccar. En Wi-Fi-rapport kan således bruges, selv om en GPS-rapport uden Wi-Fi har overtaget som seneste position mellem appens opslag. Det seneste kendte signal bevares med sit rapporterede tidspunkt.

Opsætning og indsamling behandler forskellige rapporter i tidsrækkefølge. Gentagne opslag tæller ikke som nye målinger. Der kræves fortsat tre friske rapporter pr. trin med mindst 20 sekunders mellemrum. Kun rapporter fra det aktuelle trin bruges til dets inde/ude-mærkning. To minutter er fortsat friskhedsgrænsen. Gamle og offline data bruges ikke til indlæring. Hvis deviceTime mangler, bruges fixTime før modtagelsestid, så et forsinket upload ikke bliver frisk alene ved modtagelsen.

Trackeren skal selv sende Wi-Fi-oplysninger. Denne ændring øger ikke radioens følsomhed eller scanningshyppighed, og der tilføjes ingen kommandoer til trackeren. En Wi-Fi-rapport har ikke nødvendigvis et særskilt tidspunkt for den fysiske radioscanning; appen viser rapportens tilgængelige tidsstempel. Telefonens signal er ikke trackerens måling. Nye punkter gemmes først, når brugeren bekræfter dem.

Pakken kan uploades oven på 0.8.77, 0.8.78 eller 0.8.79. Den indeholder også de seneste kortlayout- og hvilerettelser. Miljøvariabler og eksisterende kortnøgle bevares.

Validering: 371 tests bestået, herunder genfinding af Wi-Fi fra historik, tidspunkter, gentagne opslag, enhedsafgrænsning, indlæringens trin og signalvisningens datagrundlag. Den færdige skærm er ikke visuelt kontrolleret i en interaktiv browser i denne arbejdssession.
