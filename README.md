# React + TypeScript + Vite

## Audiobook

Über **Audiobook** auf der Startseite lassen sich Projekte für Lieder und
Aufnahmen anlegen, öffnen und nach Bestätigung löschen. Die Projektnamen
werden lokal im Browser gespeichert und sind an diesen Browser gebunden.
Auf der Projektseite legt **+ Spur hinzufügen** eine leere Spur an. Ein Klick
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
Die Spuren lassen sich
über die untere Wiedergabeleiste gemeinsam abspielen oder pausieren.
Ein Klick auf die oben haftende Zeitleiste setzt die Wiedergabeposition aller Spuren;
mit den Pfeiltasten sowie Pos1 und Ende ist dies auch per Tastatur möglich.
Eine fest mittige rote Linie zeigt die aktuelle Position über alle Spuren hinweg;
bei der Wiedergabe bewegen sich die Spuren darunter nach links.
Beim Importieren eines Audioblocks pausiert die Wiedergabe. Die Audiodateien werden
lokal in IndexedDB gespeichert und beim Löschen des Projekts entfernt.
Links neben jeder Wellenform öffnet das Lautsprechersymbol den Lautstärkeregler;
**M** schaltet die jeweilige Spur stumm. Lautstärke und Stummschaltung gelten
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
