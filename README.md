# React + TypeScript + Vite

## Audiobook

Über **Audiobook** auf der Startseite lassen sich Projekte für Lieder und
Aufnahmen anlegen, öffnen und nach Bestätigung löschen. Die Projektnamen
werden lokal im Browser gespeichert und sind an diesen Browser gebunden.
Im Projekt führt die oben haftende Navigation zurück zur Projektliste oder
zwischen **Edit** und **Exercise**. Exercise spielt die gespeicherten Spuren
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
Im Übungsmodus lädt **Projektoptionen → Debug-Trace herunterladen** nach
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
Ein Klick auf die oben haftende Zeitleiste setzt die Wiedergabeposition aller Spuren;
mit den Pfeiltasten sowie Pos1 und Ende ist dies auch per Tastatur möglich.
Eine fest mittige rote Linie zeigt die aktuelle Position über alle Spuren hinweg;
bei der Wiedergabe bewegen sich die Spuren darunter nach links.
Beim Importieren eines Audioblocks pausiert die Wiedergabe. Die Audiodateien werden
lokal in IndexedDB gespeichert und beim Löschen des Projekts entfernt.
Links neben jeder Wellenform schaltet **M** die jeweilige Spur stumm. Über
**...** lassen sich die Lautstärke einstellen und die Spur mit allen ihren
Audioblöcken nach Bestätigung löschen. Gemeinsam genutzte Audiodaten bleiben
erhalten, solange sie in anderen Spuren verwendet werden. Lautstärke und Stummschaltung gelten
auch während der Wiedergabe und werden pro Spur lokal gespeichert. Bei aktiver
Stummschaltung erscheinen die Spur grau und der Mute-Button rot.
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
