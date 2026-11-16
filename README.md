# React + TypeScript + Vite

## Audiobook

Über **Audiobook** auf der Startseite lassen sich Projekte für Lieder und
Aufnahmen anlegen, öffnen und nach Bestätigung löschen. Die Projektnamen
werden lokal im Browser gespeichert und sind an diesen Browser gebunden.
In der Projektübersicht führen **Edit** und **Exercise** direkt in die jeweilige
Ansicht. Das Menü **...** enthält die Löschoption mit Bestätigung; neue Projekte
werden unterhalb der vorhandenen angelegt.
Im Projekt führt die oben haftende Navigation zurück zur Projektliste oder
zwischen **Edit**, **Lyrics & PDFs**, **Exercise** und **Export**. Unter **Export**
lässt sich das Lied mit den aktuellen Schnittpositionen, Lautstärken und
Stummschaltungen als MP3 abmischen oder als `.vst`-Projektdatei sichern.
Die Projektdatei ist ein ZIP-Archiv mit Spuren, Audiodaten, Liedtexten und PDFs.
In der Projektübersicht kann sie als neues Projekt importiert werden; vorhandene
Projekte bleiben unverändert. Der FFmpeg-Encoder für die MP3-Kodierung und den
MOV-Konverter wird bei Bedarf vom eigenen Server geladen; Audiodaten bleiben lokal.
Große Projekte benötigen entsprechend Arbeitsspeicher.
Unter **Lyrics & PDFs**
lassen sich mehrere Liedtexte erstellen und optional Vocalspuren zuweisen.
Liedtexte werden vollständig angezeigt. Über das **...**-Menü können sie
bearbeitet, einer Vocalspur zugeordnet oder nach Bestätigung gelöscht werden;
Änderungen an Text und Zuordnung werden automatisch gespeichert. Wird eine
Vocalspur gelöscht, bleibt der Text ohne Zuordnung erhalten. Darunter können
beliebig viele PDFs mit Namen und optionaler Beschreibung hinzugefügt,
geöffnet, bearbeitet und gelöscht werden. Änderungen an Name oder Beschreibung
werden mit **Dokument speichern** gesichert. Liedtexte und PDFs werden lokal
in IndexedDB gespeichert und beim Löschen des Projekts entfernt.
Exercise spielt die gespeicherten Spuren
ab, ohne die Spuren oder die Editor-Zeitleiste anzuzeigen. Änderungen an
Spuren und Audioblöcken sind nur unter Edit möglich.
Über **...** in der Projektleiste lässt sich der Projektname ändern; die
Spuren und die Projektadresse bleiben dabei erhalten.
Beim Öffnen von Exercise werden die Tonhöhen aller Vocalspuren lokal im
Hintergrund analysiert. Über **V** in der unteren Wiedergabeleiste kann eine
Vocalspur als orangefarbene Referenz ausgewählt oder die Referenz ausgeblendet
werden. Der Button ist bei aktiver Referenz grün. Die Stimmgerät-Einstellungen
öffnen sich über das Menü-Symbol rechts in der Leiste. Mit **Mikrofon starten** in der unteren
Wiedergabeleiste wird der eigene Gesang
erfasst und während der Wiedergabe blau über der Referenz angezeigt; die
mittlere Linie markiert die aktuelle Songposition. Beim Springen wird der
bisherige Mikrofonverlauf zurückgesetzt. Durch horizontales Ziehen des
Stimmgerät-Diagramms oder mit den Pfeiltasten auf dem fokussierten Diagramm
lässt sich die Wiedergabeposition auch während der Wiedergabe ändern.
Die Zeitskala über dem Diagramm zeigt Songsekunden und ermöglicht das
Springen per Klick oder Tastatur; sie bewegt sich synchron zum Diagramm.
Die höhere Tonhöhenansicht zeigt mindestens drei Oktaven und bleibt stabil,
solange die aktuellen Töne genügend Platz haben. Sie führt bei Bedarf sanft
nach und bleibt beim Ziehen auf ihrer aktuellen Höhe; nach dem Loslassen
führt sie wieder automatisch nach.
Die Mikrofonanalyse verwendet die
Einstellungen des Stimm-Tuners; die Referenzanalyse verwendet Standardwerte
und die eingestellte Anzahl übersprungener Frames für große Tonsprünge.
Die Analyse wird beim erneuten Öffnen der Übungsansicht neu erzeugt und ist
abhängig von Aufnahme und Stimmqualität nicht immer eindeutig. Für den
Vergleich empfiehlt sich ein Kopfhörer, damit die Wiedergabe nicht vom
Mikrofon als eigener Gesang erfasst wird.
Einzelne erkannte Tonsprünge ab 10 Halbtönen werden sowohl beim Mikrofon als auch in der
Vocal-Referenz als Lücke ausgelassen. In den Stimmgerät-Einstellungen lässt sich
die Anzahl übersprungener Frames zwischen 0 und 100 einstellen (Standard: 2;
0 deaktiviert den Filter). Ein anhaltender großer Tonsprung erscheint bei der
nächsten passenden Messung; auch echte große Intervalle werden entsprechend
verzögert. Änderungen analysieren die Vocal-Referenz erneut;
nach einer Gesangspause beginnt die Erkennung ohne Vergleich zum vorherigen Ton.
Über **Projektoptionen → Development → Development aktivieren** lassen sich
Diagnosefunktionen einschalten. Die Einstellung bleibt in diesem Browser
gespeichert und kann dort wieder ausgeschaltet werden. Bei aktivierter
Entwicklungsoption lädt **Projektoptionen → Development → Wiedergabe-Debuglog
herunterladen** ein JSON-Protokoll für das aktuelle Projekt herunter. Zur
Fehlersuche die Option vor dem Abspielen einschalten, das Problem nachstellen
und anschließend das Protokoll herunterladen. Es enthält Browserkennung,
Bildschirmgröße, Zeitmessungen, Dateigrößen und Formate, Anzahl der Spuren und
Blöcke, Suchsprünge, Audio- und Zeichenstatistiken sowie gegebenenfalls lange
Hauptthread-Aufgaben. Es enthält keine Audiodaten, Liedtexte oder Projektnamen.
Das Protokoll bleibt lokal im Arbeitsspeicher, ist auf 3000 Einträge begrenzt
und wird beim Deaktivieren oder Projektwechsel verworfen. Ein Seitenneuladen
beginnt ein neues Protokoll. Die Diagnose selbst kann die Leistung etwas
beeinflussen; nach der Untersuchung sollte sie ausgeschaltet werden.
Im Übungsmodus lädt **Projektoptionen → Development → Debug-Trace herunterladen** nach
abgeschlossener Analyse die vollständige ausgewählte Vocalspur als JSON herunter,
auch außerhalb des sichtbaren Ausschnitts. `timeSeconds` bezeichnet Sekunden
seit Songbeginn; `frequencyHz` ist der angezeigte Wert, `rawFrequencyHz` der
Wert vor dem Tonsprungfilter. `null` bedeutet eine Lücke, `clip-end` markiert das
Ende eines Audioblocks. Die Datei enthält Spurkennung und Analyseparameter,
aber weder Audiodaten noch Mikrofonaufnahmen. Bei fehlender oder fehlerhafter
Analyse ist der Download deaktiviert.
Auf der Projektseite legen die drei Schaltflächen eine leere Vocal-,
Instrumental- oder Mixed-Spur an. Vocalspuren sind für Gesang, Instrumentalspuren
für Instrumente und Mixed-Spuren für Aufnahmen mit beidem gedacht. Die Spurart
wird gespeichert und farblich angezeigt; vorhandene Spuren gelten als Mixed.
Im Editmodus kann die Spur links über ihre Typ-Schaltfläche für eine
Mikrofonaufnahme ausgewählt werden. **Aufnehmen** startet an der aktuellen
Wiedergabeposition und spielt die anderen Spuren mit ihren Lautstärke- und
Stummschaltungseinstellungen ab; die Zielspur bleibt währenddessen stumm.
**Aufnahme stoppen** beendet und speichert die Aufnahme. Nur der überlappende
Bereich der Zielspur wird ersetzt; Material davor und danach bleibt erhalten.
Das funktioniert auch in einer leeren Spur und über das bisherige Songende
hinaus. Für die Aufnahme sind Mikrofonberechtigung und HTTPS oder localhost
erforderlich. Kopfhörer vermeiden Rückkopplungen; je nach Gerät und Browser kann
eine zeitliche Mikrofonlatenz auftreten. Bei einem Speicherfehler kann die
Aufnahme über den angezeigten Download-Link gesichert werden.
Falls der Browser das Aufnahmeformat nicht direkt dekodieren kann, wird es
lokal mit dem mitgelieferten FFmpeg in WAV umgewandelt; dies kann beim ersten
Mal einige Zeit und zusätzlichen Arbeitsspeicher benötigen.
Die spätere Tonhöhenanzeige für Vocalspuren ist noch nicht implementiert. Ein Klick
in ihren freien Bereich öffnet **Importieren**; die ausgewählte Audiodatei
wird als Block an der angeklickten Zeitposition eingefügt. Pro Spur sind
mehrere nicht überlappende Blöcke möglich. Die Breite zeigt ihre Dauer;
Blöcke lassen sich mit Maus oder Touch zeitlich und zwischen Spuren verschieben.
Am linken oder rechten Rand scrollt die Ansicht beim Ziehen automatisch mit
einer halben sichtbaren Zeitleistenbreite pro Sekunde, auch über das bisherige
Songende hinaus. Beim Verschieben pausiert die Wiedergabe.
Per Tastatur verschieben die Pfeiltasten einen fokussierten Block um eine
Sekunde oder auf die benachbarte Spur. Überlappungen sind nicht erlaubt.
Ein Klick markiert einen Audioblock; ein weiterer Klick öffnet sein Optionsmenü.
Liegt die rote Positionslinie innerhalb des Blocks, teilt **Schneiden** ihn
an dieser Stelle in zwei separat verschiebbare Blöcke derselben Spur.
Die Originalaufnahme wird dabei nur einmal gespeichert; die Blöcke verweisen
mit ihren jeweiligen Quellbereichen darauf. Beim Schneiden pausiert die Wiedergabe.
Im selben Menü lassen sich einzelne Blöcke nach Bestätigung löschen. Die
gemeinsame Audiodatei bleibt erhalten, solange noch ein Block sie verwendet.
Mit **Kopieren** lässt sich ein Block einschließlich seines Quellbereichs
vormerken und über **Einfügen** an einer freien Stelle derselben oder einer
anderen Spur beliebig oft einsetzen. Die Blöcke teilen sich die Audiodatei;
Überlappungen sind nicht erlaubt. Die Zwischenablage gilt nur, solange das
Projekt geöffnet ist, und bleibt auch beim Löschen des Originals verfügbar.
Die Spuren lassen sich
über die untere Wiedergabeleiste gemeinsam abspielen oder pausieren.
Gemeinsam genutzte Aufnahmen werden für die Zeitleiste nur einmal dekodiert;
die Lautstärke wird auch bei vielen Blöcken über einen gemeinsamen Knoten je
Spur gesteuert. Längere Wellenformen werden beim Scrollen und Abspielen
abschnittsweise zwischengespeichert, statt bei jedem Bild neu gezeichnet.
Ein Klick auf die oben haftende Zeitleiste setzt die Wiedergabeposition aller Spuren;
mit den Pfeiltasten sowie Pos1 und Ende ist dies auch per Tastatur möglich.
In der unteren Wiedergabeleiste verschieben Schaltflächen die Schnittposition
um eine Minute, fünf oder eine Sekunde sowie um zehn oder ein Frame. Die Anzeige
verwendet Minuten:Sekunden:Frames mit 25 Frames pro Sekunde (40 ms je Frame).
Die Position bleibt auf den Bereich zwischen Songanfang und Songende begrenzt.
Auf schmalen Bildschirmen lassen sich die beiden Schaltflächengruppen
horizontal scrollen; die Positionsanzeige bleibt in der Mitte sichtbar.
Eine fest mittige rote Linie zeigt die aktuelle Position über alle Spuren hinweg;
bei der Wiedergabe bewegen sich die Spuren darunter nach links.
Beim Importieren eines Audioblocks pausiert die Wiedergabe. Die Audiodateien werden
lokal in IndexedDB gespeichert und beim Löschen des Projekts entfernt.
Links neben jeder Wellenform schaltet **M** die jeweilige Spur stumm. Über
**...** lässt sich die Lautstärke zwischen 0 und 400 % einstellen und die Spur mit allen ihren
Audioblöcken nach Bestätigung löschen. **Spur duplizieren** erstellt am Ende
eine unabhängige Kopie mit allen Audioblöcken, Schnittpositionen, Spurart und
Mischereinstellungen; die Wiedergabe pausiert dabei. Beide Spuren teilen sich
die Audiodaten, aber Änderungen an Blöcken oder Einstellungen wirken nur auf
die jeweilige Spur. Liedtexte bleiben der ursprünglichen Spur zugeordnet.
Bei Vocalspuren findet sich dort außerdem **Wörter separieren**: Nach
Bestätigung werden Abschnitte unter einem RMS-Pegel von 0,003, die mindestens
120 ms dauern, als Pausen entfernt; um hörbare Abschnitte bleiben jeweils bis
zu 20 ms Sicherheitsabstand. Die restlichen Blöcke bleiben an ihrer Songposition.
Die Analyse erfolgt lokal auf allen Kanälen und ist keine Spracherkennung:
Hintergrundgeräusche, leise Wörter und kurze Pausen können falsch erkannt werden.
Die Aktion lässt sich nicht rückgängig machen; gegebenenfalls vorher die Spur
duplizieren. Eine durchgehend stille Spur kann dadurch leer werden.
Gemeinsam genutzte Audiodaten bleiben
erhalten, solange sie in anderen Spuren verwendet werden. Lautstärke und Stummschaltung gelten
auch während der Wiedergabe und werden pro Spur lokal gespeichert. Bei aktiver
Stummschaltung erscheinen die Spur grau und der Mute-Button rot.
100 % entsprechen dem unveränderten Aufnahmepegel; darüber wird die Spur
verstärkt. Dabei können Hintergrundgeräusche und Verzerrungen zunehmen,
insbesondere wenn mehrere Spuren zusammen den maximalen Ausgangspegel
überschreiten. Gegebenenfalls die Spuren leiser einstellen. Die Verstärkung
gilt auch für die Aufnahmebegleitung und den MP3-Export, verändert aber nicht
die gespeicherte Originalaufnahme. Projektdateien mit Lautstärken über 100 %
benötigen beim Import eine App-Version, die diese Verstärkung unterstützt.
Die gemeinsame Zeitleiste zeigt Wellenformen und Sekundenmarkierungen.
Das Mausrad über den Spuren zoomt um die aktuelle Position; horizontaler
Bildlauf ändert die Wiedergabeposition bis zum Songende. Alternativ lässt sich
der Zoom über die Schaltflächen ändern.
Die unterstützten Audioformate hängen vom Browser ab; Audiobearbeitung ist
noch nicht verfügbar. Beim Löschen der Browserdaten können Projekte und
Audiodaten verloren gehen.
Die Dateiauswahl zeigt auch Dateien ohne erkannten Audiotyp an, damit
beispielsweise iPhone-Sprachmemos ausgewählt werden können. Ob eine Datei
abgespielt werden kann, hängt von ihrem Inhalt und dem Browser ab.

## Stimm-Tuner

Auf der Startseite führt **Stimm-Tuner** zum Tonhöhenverlauf. Das
Mikrofonsymbol in der unteren Leiste startet und stoppt das Mikrofon; beim
Start wird der Browser um Zugriff gebeten.
Das Diagramm zeigt die letzten fünf Sekunden; Stille oder nicht eindeutig
erkannte Töne erscheinen als Lücke. Beim Stoppen friert der Verlauf ein.

Der Zugriff erfordert HTTPS oder localhost und eine Mikrofonberechtigung.
Die Analyse mit Pitchy läuft lokal im Browser; Audio wird nicht gespeichert
oder übertragen. Die Genauigkeit kann je nach Stimme, Umgebung und Gerät
variieren. MP3-Analyse und Audioexport sind noch nicht Bestandteil des
Tuners.

Über das Menü rechts in der unteren Leiste lassen sich Empfindlichkeit,
Frequenzbereich und weitere Analysewerte einstellen. Gültige Änderungen
gelten sofort und werden im lokalen Browser-Speicher abgelegt. Eine
kleinere Mindestlautstärke erkennt leisere Signale; eine kleinere
Mindestklarheit akzeptiert unklarere Signale. Die Standardwerte können im
Menü wiederhergestellt werden.

## Tooltipmenüs

`TooltipMenu` nimmt seine Inhalte als JSX und eine `onClose`-Funktion entgegen.
`TooltipMenuButton`, `TooltipMenuRange`, `TooltipMenuNumber` und
`TooltipMenuFile` sind wiederverwendbare Unterelemente; Hinweise und Gruppen
können als normale HTML-Elemente eingefügt werden. Range und Number verwenden
die üblichen Input-Props und `onChange`-Events. Der Datei-Callback erhält die
ausgewählte Datei; die Auswahl wird zurückgesetzt, damit dieselbe Datei erneut
ausgewählt werden kann.

```tsx
<TooltipMenu onClose={closeMenu}>
  <TooltipMenuButton onClick={runAction}>Aktion</TooltipMenuButton>
  <TooltipMenuRange label="Lautstärke" min={0} max={100} value={volume}
    onChange={(event) => setVolume(Number(event.currentTarget.value))} />
</TooltipMenu>
```

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
