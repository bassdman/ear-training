# React + TypeScript + Vite

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

Die Empfindlichkeit und weitere Analysewerte lassen sich in
[`src/features/tuner/config.ts`](src/features/tuner/config.ts) einstellen.
Insbesondere senkt ein kleinerer `MIN_VOLUME_RMS` die Mindestlautstärke;
ein kleinerer `MIN_PITCH_CLARITY` akzeptiert unklarere Signale.

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
