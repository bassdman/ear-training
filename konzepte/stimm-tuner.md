# Konzept: Stimm-Tuner mit Tonhöhenverlauf

## Ziel

Ein eigenständiges Hilfsmittel zeigt beim Singen die erkannte Tonhöhe als
Linie über die Zeit. Anders als die bestehende Tuner-Anzeige mit Nadel soll
das Werkzeug sichtbar machen, wie sich die Stimme bewegt und wie konstant
ein Ton gehalten wird. In der ersten Ausbaustufe gibt es keinen
vorgegebenen Zielton und keine Bewertung oder Übungsaufgabe.

Der Tuner wird als wiederverwendbare Komponente geplant: Zunächst erhält er
Tonhöhen aus dem Mikrofon, mittelfristig soll er auch den Verlauf einer
MP3-Datei darstellen können.

Die erste Live-Version ist umgesetzt. MP3-Auswertung, Referenzvergleich und
Audioexport bleiben mittelfristige Erweiterungen.

## Einbindung und Bedienung

- Auf der Startseite wird der Tuner beim Hauptgrid verlinkt. Er erhält eine eigene Seite, 
  `/tuner`, mit Rückweg zur Startseite.
- Die Intonationsübungen werden entfernt (/intonation-exercises)
- Ein deutlich beschrifteter Button **Mikrofon starten** fordert erst nach
  einem bewussten Klick den Zugriff an. Danach lautet er **Mikrofon
  stoppen**.
- Während das Mikrofon aktiv ist, läuft die Anzeige ohne Zielton,
  Haltezeit oder automatischen Abbruch bei Stille. Ein sichtbarer Zustand
  unterscheidet Zuhören, erkannten Ton und fehlendes verwertbares Signal.
- Beim Stoppen bleibt der bisherige sichtbare Verlauf zur Betrachtung
  stehen; ein erneuter Start beginnt einen neuen Verlauf. Ein zusätzlicher
  Button **Verlauf löschen** leert das Diagramm, ohne das Mikrofon zu
  stoppen.
- Als ergänzende Momentaufnahme stehen oberhalb des Diagramms der nächste
  Notenname mit Oktave, die Abweichung in Cent und die Frequenz in Hz.
  Ohne verlässliche Messung erscheinen keine veralteten Messwerte als
  aktuelle Tonhöhe.
- In der ersten Version sind Zeitfenster und angezeigter Tonumfang nicht
  manuell einstellbar. Ein Export ist zunächst nicht vorgesehen.

## Diagramm

### Achsen und Raster

- Die Zeit verläuft von links nach rechts: rechts ist der aktuelle
  Zeitpunkt, links die Vergangenheit. Das rollende Fenster zeigt
  **5 Sekunden** mit Zeitmarken im Abstand von einer Sekunde.
- Die Tonhöhe steigt nach oben. Jede waagerechte Rasterlinie entspricht
  einem Halbton und trägt ihren Notennamen **mit Oktave**, etwa C4, Cis4,
  D4, Dis4. Die App verwendet die deutsche Folge C, Cis, D, Dis, E, F,
  Fis, G, Gis, A, Ais, H; danach folgt C der nächsten Oktave.
- Die vertikale Skala ist logarithmisch in der Frequenz: Ein Halbton hat
  überall den gleichen Abstand, eine Oktave umfasst zwölf Halbtöne.
  C-Linien können zur Orientierung stärker hervorgehoben werden.
- Die Linie zeigt die gemessene Tonhöhe **stufenlos** zwischen den
  Rasterlinien, nicht nur den gerundeten Notennamen. Ein Punkt auf der
  Linie C4 entspricht dem gestimmten C4; 50 Cent darüber liegen auf halbem
  Weg zur Cis4-Linie. So sind auch Vibrato und kleine Abweichungen sichtbar.
- Zur Einordnung gilt zunächst die in der App verwendete gleichstufige
  Stimmung mit A4 = 440 Hz. Ein alternatives Kammerton-a ist nicht Teil des
  ersten Umfangs.

### Darstellungsbereich und Verlauf

- Die Anwendung ist für Smartphones ausgelegt. Auf einem iPhone sind
  **1,5 Oktaven** (18 Halbtöne) sichtbar. Bei einer Fensterbreite über
  600 Pixel werden zwei Oktaven angezeigt.
- Erreicht der aktive Ton die oberen oder unteren 15 % des Diagramms,
  führt der sichtbare Bereich automatisch nach. Das Scrollen soll sanft
  wirken; bei großen Tonsprüngen wird es bei Bedarf beschleunigt, damit der
  aktive Ton sichtbar bleibt.
- Das Zeitfenster läuft auch während Stille weiter. Bei Stille,
  unzuverlässiger Erkennung oder unterbrochener Analyse entsteht eine
  **Lücke**; die Linie verbindet die beiden Seiten der Lücke nicht. Der
  Verlauf suggeriert dadurch keinen gehaltenen oder gleitenden Ton, der
  nicht gemessen wurde.
- Beim Löschen startet das leere Zeitfenster neu. Beim Stoppen friert es
  ein; es läuft nicht weiter aus dem Bild.

Schematisch, nicht maßstabsgetreu:

```text
höher
D4   ────────────────────────────────────────
Cis4 ───────────────────╭──╮─────────────────
C4   ────────╭─────────╯    ╰────   ──╮─────
H3   ────╭───╯                         ╰─────
        älter             Lücke          jetzt →
```

### Darstellung und Zugänglichkeit

- Der Hintergrund ist dunkel, die Spur/Linie des Tons ist hellblau, die Tonlinien haben einen hellen grauton.
- Das Raster bleibt auch ohne Farbe lesbar; die Verlaufslinie hebt sich
  durch Kontrast und Strichstärke ab. Notennamen und aktuelle Messwerte
  bleiben auf schmalen Displays gut lesbar, ohne das Diagramm in eine
  Nadelanzeige umzuwandeln.
- Die Bedienung ist mit Tastatur und Screenreader möglich. Mikrofonzustand,
  Fehler und der aktuelle Ton sind als Text verfügbar; Messwerte werden
  nicht bei jedem Analyseframe als Live-Meldung angesagt.
- Das Diagramm passt sich der verfügbaren Breite an. Auf kleinen
  Bildschirmen bleiben Zeitrichtung und Notenraster erhalten; Abstände und
  Beschriftungsdichte können angepasst werden.

## Technischer Ansatz

### Festlegung: Pitchy und Web Audio

Für die Umsetzung verwenden wir **[Pitchy 4.1.0](https://github.com/ianprime0509/pitchy/tree/v4.1.0)**
für die Tonhöhenerkennung und die browserseitige **Web Audio API** für die
Mikrofonaufnahme. Pitchy ist für Echtzeit-Tuner gedacht, verwendet die
McLeod Pitch Method und liefert für einen Abschnitt von Audiosamples sowohl
die Frequenz in Hz als auch einen Klarheitswert. Es bringt
TypeScript-Typdefinitionen mit und ist als ES-Modul für das React-/Vite-Projekt
geeignet. Die veröffentlichte Version 4.1.0 steht unter der
[MIT-Lizenz](https://github.com/ianprime0509/pitchy/blob/v4.1.0/LICENSE).

Pitchy öffnet **nicht selbst das Mikrofon** und dekodiert auch keine
MP3-Dateien. Es verarbeitet Audiosamples unabhängig von deren Herkunft.
Gerade diese Trennung passt hier: Dieselbe Erkennung lässt sich für
Mikrofon und später für eine Datei verwenden; das Diagramm bleibt ebenfalls
unabhängig von der Quelle. Die vorhandene eigene `detectPitch`-Funktion
wird für den neuen Tuner nicht als Erkennungsalgorithmus übernommen.

Die Erkennungsqualität und geeignete Einstellungen werden mit
Testaufnahmen, Stimmen verschiedener Tonlagen und Geräten praktisch
geprüft. Die Bibliothek ist als Abhängigkeit eingebunden.

Ziel sind möglichst alle üblichen Singstimmen von Bass bis Sopran. Die
Erkennung soll einen guten Kompromiss zwischen schneller Reaktion und
ruhiger Linie bieten. Für die Abnahme sind iPhone/Safari, Android/Chrome
und Android/Firefox sowie Chrome, Firefox und Edge auf dem Desktop
vorgesehen. Quantitative Grenzwerte für Genauigkeit und Reaktionszeit
werden nach praktischen Tests festgelegt.

### Konkreter Datenfluss

1. **Start:** Nach einem Klick per `getUserMedia` den Mikrofonstream
   anfordern. Einen `AudioContext` und einen `AnalyserNode` erstellen;
   den Stream als Quelle mit dem Analyser verbinden. Der Stream wird nicht
   an die Lautsprecherausgabe angeschlossen. Falls erforderlich, den
   AudioContext nach Nutzeraktion fortsetzen.
2. **Samples und Erkennung:** Ein `Float32Array` fester Länge mit
   `getFloatTimeDomainData` befüllen. `PitchDetector.forFloat32Array(...)`
   einmal mit derselben Länge erstellen und wiederverwenden. Bei jedem
   Analyseintervall liefert `findPitch(samples, audioContext.sampleRate)`
   Frequenz und Klarheit. Abtastrate, Pufferlänge und tatsächliche
   Aktualisierungsrate nicht fest auf einen Gerätetyp annehmen.
3. **Gültigkeit und Zeit:** Zeitstempel zuordnen und für zu leise,
   nichtperiodische oder anderweitig unzuverlässige Abschnitte eine Lücke
   ausgeben. Klarheits- und Pegelschwellen sowie Puffergröße und
   Analyseintervall werden mit Stimmen verschiedener Tonlagen erprobt:
   längere Fenster helfen bei tiefen Tönen, können aber Reaktionszeit und
   Verschmierung erhöhen. Tonwechsel und Vibrato dürfen nicht durch
   übermäßige Glättung verschwinden.
4. **Gemeinsames Ergebnisformat:** Jeder Analysepunkt enthält einen
   Zeitstempel und entweder eine gültige Frequenz oder eine explizite
   Lücke. Für die Darstellung kann die Frequenz als gebrochene
   MIDI-Position `69 + 12 * log2(frequenz / 440)` umgerechnet werden;
   daraus folgen Rasterlage, nächster Notenname und Cent-Abweichung.
   Live-Zeit ist relativ zum Start, Datei-Zeit relativ zum Dateianfang.
5. **Tuner-Komponente:** Die Darstellung und ihre Bedienung konsumieren
   diese Analysepunkte, ohne Mikrofon, Pitchy oder ein dauerhaft rollendes
   Zeitfenster vorauszusetzen. Der Live-Controller hält nur das sichtbare
   Zeitfenster und höchstens einen für den Fensterrand benötigten
   vorherigen Punkt im Speicher. Die spätere Dateiansicht braucht eine
   eigene Strategie für längere Verläufe. Canvas oder SVG und die
   Zeichenrate werden bei der Umsetzung hinsichtlich Leistung geprüft.
6. **Stop und Fehler:** Mikrofonspuren, AudioContext und laufende
   Animationen beim Stoppen, Seitenwechsel und bei Fehlern zuverlässig
   freigeben. Ein verspätet bestätigter Berechtigungsdialog darf nach Stop
   oder Seitenwechsel keine Aufnahme unbemerkt starten. Zieltongebundene
   Halteprüfungen und Zeitlimits gelten hier nicht.

   Die ersten technischen Startwerte sind ein Analysefenster von 4096 Samples,
   ein Analyseintervall von 50 ms, mindestens 0,008 RMS und 0,85 Klarheit
   sowie ein zulässiger Frequenzbereich von 55 bis 1200 Hz. Diese Werte sind
   keine garantierten Genauigkeitsgrenzen und müssen mit echten Stimmen und
   den vorgesehenen Geräten überprüft werden.

Das [offizielle Pitchy-Beispiel](https://github.com/ianprime0509/pitchy/blob/v4.1.0/docs/index.html)
zeigt die Kombination aus Mikrofon, `AnalyserNode` und `findPitch`.
Ergänzende Referenzen: [Mikrofonzugriff mit `getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
und [Dateidekodierung mit `decodeAudioData`](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData).

Die bestehende Tuner-Anzeige im Intonationstraining bleibt unverändert.
Gemeinsame Logik sollte nur so ausgegliedert werden, dass deren bisheriges
Verhalten erhalten bleibt.

## Architektur und Feature-Schnitt

### Einschätzung

Für den Tuner sind Ziel, grobe Bedienung, Pitchy und die spätere
MP3-Perspektive ausreichend beschrieben, um die Architektur zu planen.
Für die Erprobung fehlen noch messbare Grenzwerte für Genauigkeit und
Latenz sowie die konkreten Regeln für andere Bildschirmgrößen. Diese stehen
unten bei den offenen Entscheidungen.

**Empfehlung: ein neues fachliches Feature `tuner` für die erste Version.**
Mikrofonaufnahme, Analyse und Diagramm sind darin getrennte Bausteine,
aber noch keine eigenen fachlichen Features. Es gibt derzeit keinen
zweiten gesicherten Anwendungsfall, der separate allgemeine
Audio-Features rechtfertigt. Das reduziert sowohl Kopplung als auch
vorzeitige Abstraktion.

### Verantwortlichkeiten und Abhängigkeiten

| Baustein | Verantwortung | Darf nicht voraussetzen |
| --- | --- | --- |
| Tuner-Seite | Route, Startseiten-Einstieg und Zusammensetzen der Bausteine | Details von Pitchy oder Diagrammberechnungen |
| Mikrofon-Controller | Berechtigung, AudioContext, Sample-Erfassung, Start/Stop, Fehler und Aufräumen | Notenraster, Darstellung oder Übungslogik |
| Pitch-Analyse | Audiofenster mit Pitchy auswerten, Gültigkeit beurteilen und Messpunkte erzeugen | React, Mikrofon, Dateiauswahl oder Canvas |
| Verlaufskomponente | Messpunkte im Zeit-/Notenraster zeichnen; sichtbaren Ausschnitt darstellen | Pitchy, AudioContext, Mikrofon oder MP3 |
| Live-Verlaufssteuerung | Rollendes Zeitfenster, Löschen, Einfrieren und vertikales Nachführen | Konkrete Zeichenmethode oder Details der Tonhöhenerkennung |

Die Seite verbindet die Bausteine. Die Analyse verarbeitet Samples, nicht
Browser-Streams; die Darstellung verarbeitet Messpunkte, nicht Samples.
Die Start-/Stop-Bedienung des Mikrofons gehört zur Live-Ansicht und nicht
in die quellunabhängige Verlaufskomponente. Eine gemeinsame Tuner-Hülle
kann die Momentanwerte und das Diagramm zusammenfassen, ohne die
Audioquelle selbst zu öffnen.

Als Orientierung für die bestehende Projektstruktur:

```text
src/
  features/tuner/
    components/       # Verlauf und quellunabhängige Tuner-Darstellung
    hooks/            # Live-Steuerung und Mikrofon-Lebenszyklus
    analysis/         # Pitchy-Adapter, Messpunkte und Tonhöhenumrechnung
    ...               # Verlauf, Ausschnitt und zugehörige Tests
  pages/tuner/        # Seite, Live-Bedienung und Zusammensetzen
```

Dies ist eine Verantwortungsgrenze, kein verpflichtender Dateibaum. Ein
einziger Pitchy-Adapter genügt zunächst; eine austauschbare
Plugin-Infrastruktur oder ein globaler Audio-Service sind nicht notwendig.
Die vorhandene Notennamen- und Umrechnungslogik ist vor Wiederverwendung
auf ihre Abhängigkeiten zu prüfen: Der neue Tuner soll nicht vom
übungsbezogenen Feature oder von einer anderen Seite abhängen. Wird
tatsächlich gemeinsame Logik benötigt, kann sie gezielt in ein neutrales
Modul verschoben werden, ohne das bestehende Verhalten zu ändern.

### Schnittstelle und Lebenszyklus

- Ein Messpunkt enthält `timeMs` und entweder eine positive, endliche
  Frequenz in Hz oder eine explizite Lücke. Ein Klarheitswert kann bei der
  Analyse für die Gültigkeitsentscheidung genutzt werden; die Darstellung
  muss Pitchys Ergebnisformat nicht kennen. Zeiten sind monoton innerhalb
  einer Sitzung und relativ zu deren Beginn beziehungsweise zum
  Dateianfang.
- Der sichtbare Zeitausschnitt wird der Verlaufskomponente explizit
  übergeben. Live-Daten laufen bis zur aktuellen Zeit und sind begrenzt;
  eine spätere Dateiansicht kann einen anderen Ausschnitt steuern, ohne das
  Mikrofon zu starten. Darstellung und Ausschnittberechnung müssen sich
  mit künstlichen Messpunkten unabhängig vom Browser-Audio testen lassen.
- Ein Live-Controller besitzt die Ressourcen einer Sitzung. Sein Zustand
  unterscheidet mindestens inaktiv, Berechtigung/Start ausstehend,
  aktiv und Fehler; das Ende einer Sitzung friert den Verlauf ein.
  Stille ist ein Signalzustand während `aktiv`, kein Fehler. Stop,
  Seitenwechsel, Startfehler, entfernte Mikrofone und verspätete
  Berechtigungszusagen müssen Ressourcen zuverlässig freigeben.
- Die Zeitbasis muss auch bei pausierten oder verzögerten
  Browser-Callbacks eindeutig bleiben. Nach einer Analyseunterbrechung
  wird keine Linie über den nicht beobachteten Zeitraum gezogen. Die
  tatsächlichen Zeitstempel statt der Anzahl von Frames bestimmen den
  Verlauf.

### Spätere Erweiterung und Lieferumfang

| Ausbaustufe | Fachlicher Umfang | Schnitt |
| --- | --- | --- |
| Jetzt | Ein Tuner für Live-Gesang | Ein Feature `tuner` mit den oben getrennten Bausteinen und einer Seite |
| Mittelfristig | MP3-Datei laden, dekodieren und analysieren | Eigenständiger Datei-Controller als weiterer Baustein; dieselbe Analyse und Verlaufskomponente verwenden |
| Später, falls gewünscht | Referenzmelodie und Vergleich für Gesangsübungen | Eigenes Übungs-/Vergleichsfeature, das Analyseergebnisse und Anzeige nutzt; keine Übungsregeln in Pitchy-Adapter oder Diagramm |

Ob die Dateianalyse ein eigenes Feature wird, entscheiden wir erst,
wenn ihr Umfang und weitere Nutzer feststehen. Es wird jetzt weder ein
MP3-Controller noch ein Vergleichsfeature implementiert. Die Komponente
muss aber einen expliziten Zeitbereich und quellunabhängige Messpunkte
akzeptieren. Sie kann deshalb später wiederverwendet werden, ohne bereits
heute Datei-Navigation oder mehrere Spuren vorzusehen.

Später soll außerdem die **Audioaufnahme selbst exportiert** werden
können; ein Export von Diagrammbildern oder Messdaten ist damit nicht
festgelegt. Dafür wird ein eigener Aufnahme-/Exportbaustein benötigt: Die
Tonhöhenmesspunkte ersetzen keine Audiodaten. Die erste Version zeichnet
keine Audiodatei auf. Format, Umfang und Bedienung des späteren Exports
werden vor dessen Umsetzung geklärt.

### Konsequenz der vorgesehenen Entfernung von Intonationsübungen

Der Bereich `/intonation-exercises` wird einschließlich seiner Seiten und
Routen entfernt, nicht nur auf der Startseite ausgeblendet. Er umfasst
Üben, Lieder und Erstellen. Betroffen sind auch der Startseiten-Link sowie
die zugehörigen Komponenten und Tests; nicht mehr verwendeter Code kann
nach Prüfung seiner Abhängigkeiten entfernt werden.

Bereits lokal gespeicherte Übungen, Lieder und Einstellungen bleiben im
Browser unangetastet. Sie werden weder gelöscht noch migriert; nach
Entfernung des Bereichs sind sie über die Anwendung zunächst nicht mehr
zugänglich. Alte Links fallen auf die bestehende Weiterleitung für
unbekannte Routen zur Startseite zurück. Das separate Intonationstraining
unter `/intonation-training` bleibt erhalten.

## Mittelfristiges Ziel: MP3-Tonhöhenverlauf

Eine ausgewählte MP3-Datei soll lokal eingelesen und beispielsweise mit
`decodeAudioData` in einen AudioBuffer dekodiert werden. Aus dessen
Samples werden gleich lange, gegebenenfalls überlappende Abschnitte
gebildet; Pitchy analysiert sie mit der tatsächlichen Abtastrate des
Buffers. Der zeitlich zugeordnete Verlauf wird in derselben
Tuner-Komponente auf demselben Notenraster dargestellt. Anders als beim
Live-Modus richtet sich die Zeitachse nach der Position in der Datei und
muss auch längere Aufnahmen zugänglich machen. Bedienung für Ausschnitte,
Navigation und gegebenenfalls Wiedergabe wird vor Umsetzung konkretisiert.

Damit lassen sich Gesangsaufnahmen bei Übungen auf ihren Tonhöhenverlauf
hin betrachten. Der Vergleich mit einer Referenzmelodie ist als
**separate spätere Ausbaustufe nach der ersten MP3-Version** vorgesehen;
wie diese Referenz bereitgestellt und zeitlich ausgerichtet wird, ist noch
offen. Der Vergleich ist weder Teil der ersten Mikrofonversion noch der
ersten MP3-Version.

Der erste Anwendungsfall ist eine möglichst einzelne, gut hörbare
Gesangsstimme. Bei Begleitung, mehreren Stimmen oder starkem Rauschen kann
eine einstimmige Pitch-Detection die Stimme nicht zuverlässig isolieren.
Welche Aufnahmen unterstützt werden und ob dafür weitere Verfahren nötig
sind, muss praktisch geprüft werden. MP3-Auswertung, längere Verläufe und
ein möglicher Vergleich gehören nicht zum ersten Implementierungsumfang.

## Datenschutz und Fehlerfälle

- Die Analyse erfolgt im Browser. Für den vorgesehenen Umfang werden
  weder Audio noch Tonhöhenverlauf an einen Server übertragen oder
  dauerhaft gespeichert. Beim Verlassen der Seite geht der Verlauf verloren.
  Auch für die spätere MP3-Auswertung ist lokale Verarbeitung vorgesehen;
  eine Übertragung oder dauerhafte Speicherung ist nicht Bestandteil
  dieses Konzepts.
- Bei verweigerter Berechtigung, fehlendem Mikrofon, unsicherer Verbindung
  oder einem sonstigen Audiofehler erscheint eine verständliche Meldung mit
  einem Hinweis zum erneuten Versuch. Eine Berechtigung allein gilt noch
  nicht als erfolgreich gestartete Messung.
- Wird die Mikrofonquelle während des Betriebs entfernt oder beendet,
  endet die Messung sichtbar mit einer Fehlermeldung. Bei Stille oder
  nicht eindeutig erkannter Tonhöhe bleibt die Messung dagegen aktiv und
  zeigt eine Lücke.
- Die Browser unterstützen Mikrofonzugriff grundsätzlich nur in einem
  sicheren Kontext, etwa über HTTPS oder lokal auf localhost. Verhalten
  und AudioContext-Start sind insbesondere auf mobilen Browsern zu prüfen.

## Abnahmekriterien

1. Ohne Klick wird kein Mikrofon angefordert. Start und Stop sind sichtbar;
   nach Stop und Seitenwechsel ist das Mikrofon freigegeben.
2. Ein konstanter, künstlich erzeugter Referenzton bei 440 Hz liegt auf
   A4; ein Ton 50 Cent darüber liegt auf halber Höhe zwischen A4 und Ais4.
   Der Momentanwert zeigt jeweils den passenden Notennamen und Centwert.
3. Ein Tonwechsel und ein Vibrato erscheinen als zeitlicher Verlauf.
   Stille und unzuverlässige Erkennung erzeugen sichtbare Lücken ohne
   Verbindungslinie; die Messung läuft danach weiter.
4. Zeitfenster, Löschen, Stoppen, Neustart und der Wechsel des
   Tonhöhenausschnitts verhalten sich wie oben beschrieben. Die Skalierung
   unterscheidet Oktaven und klemmt keine Werte an den Rand.
5. Fehlerfälle werden verständlich angezeigt; Desktop und Mobilansicht
   bleiben bedienbar. Das separate Intonationstraining funktioniert
   weiterhin wie zuvor. Der Bereich Intonationsübungen ist entfernt;
   seine lokal gespeicherten Daten bleiben unangetastet.
6. Zusätzlich zu automatisierten Tests für Umrechnung, Lücken,
   Fenstergrenzen, Ausschnitt und Lebenszyklus wird die Erkennung mit
   echten Stimmen unterschiedlicher Tonlagen sowie auf unterstützten
   mobilen Browsern praktisch erprobt.

## Offene Entscheidungen vor der Umsetzung

- Nach welcher konkreten Regel passt sich der Tonumfang an andere
  Bildschirmgrößen an, und sollen Zeitfenster und Tonhöhenbereich später
  manuell einstellbar sein?
- Welche Einstellungen für Pitchy, Puffergröße und Analyseintervall
  bewähren sich für Stimmen und Geräte in den benötigten Tonlagen?
- Welche konkreten Tonlagen sowie Grenzwerte für Latenz und Genauigkeit
  ergeben sich aus der praktischen Erprobung?
- In welchem Format, über welchen Zeitraum und mit welcher Bedienung soll
  die Audioaufnahme später exportiert werden?
- Wie sollen bei der späteren MP3-Auswertung Ausschnitte bedient und
  gegebenenfalls wiedergegeben werden? Wie wird in der anschließenden
  Vergleichsstufe die Referenzmelodie bereitgestellt und ausgerichtet?
