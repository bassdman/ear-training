## Grundidee

Ein Kampagnenmodus mit 80- Leveln, dargestellt als sichtbarer Weg/Pfad. Ziel des letzten Levels: die gesamte chromatische Tonleiter über den vollen relevanten Stimmumfang ganz ohne Hilfsmittel heraushören.

Läuft unabhängig vom bestehenden Tonraten-Modus mit täglichen Übungen, kann aber später verzahnt werden (siehe unten).

## Schwierigkeitssystem

- Jede aktive Note = 1 Schwierigkeitspunkt (z. B. 4 Noten zur Auswahl = 4 Punkte)
- Jede um 1 Stufe reduzierte Hilfsmittel-Stufe (z. B. dauerhafte Farbanzeige abschwächen, unterschiedliche Tonstile einführen) = ebenfalls 1 Punkt
- Start: maximale Hilfsmittel, minimale Notenanzahl
- Jede erfolgreich abgeschlossene Runde erhöht die Schwierigkeit um +1
- Kein Zurücksetzen/Reue-Mechanismus nötig, da nur additiv (evolutionär) – Punkte gehen nie verloren
- Der Spieler wählt bei jedem Punktegewinn aktiv, ob er ein Hilfsmittel weiter reduziert oder die Notenanzahl erhöht (Agency wie bei Ausrüstungswahl in Browsergames)

## Notenumfang / Lagen (Oktavblöcke)

Basierend auf den vier real relevanten Gesangslagen (bereits in `TRAINING_CATEGORIES` vorhanden):

- C2-H2 – sehr tiefe Männerlage (Bass, tiefer Bereich)
- C3-H3 – tiefe Lage (Bass-Start, Tenor-Start)
- C4-H4 – mittlere Lage (Alt/Sopran-Bereich)
- C5-H5 – hohe Lage (Sopran)

Reihenfolge im Levelweg: erst eine Lage komplett trainieren (alle Noten, Hilfsmittel schrittweise weg), dann Nachbarlagen dazu kombinieren. Beispielhafte Grobstruktur:

- Level 1-20: eine Lage, alle Noten, Hilfsmittel schrittweise weg
- Level 20-40: 3 lagen zur hälfte (weitere Noten kommen immer am rand dazu)
- Level 40-60: drei Lagen
- Level 60-80: alle vier Lagen, keine Hilfsmittel

## Wählbarer Startpunkt (Stimmtyp-Auswahl)

Zu Beginn fragt die App den Stimmtyp ab (Bass / Tenor / Alt / Sopran) und leitet daraus die Start-Lage ab:

- Bass → Start bei C2-H2
- Tenor → Start bei C3-H3
- Alt → C3-H3 oder C4-H4 (Überlappungsbereich mit Tenor)
- Sopran → C4-H4 oder C5-H5

Level-Nummerierung sollte relativ zur gewählten Start-Lage gedacht werden (Level 1 = eigene Start-Lage, Level 20 = Start-Lage + Nachbarlage), nicht als feste absolute Lagen an feste Levelnummern gebunden – sonst braucht es für jeden möglichen Startpunkt einen eigenen Levelbaum. Erweiterung wächst symmetrisch in beide Richtungen (erst direkter Nachbar, dann übernächster), unabhängig vom Startpunkt.

## Notenauswahl-Logik bei mehreren aktiven Lagen

Sobald mehrere Lagen gleichzeitig aktiv sind (ab der Kombinations-Phase im Levelweg):

- Innerhalb eines Levels: adaptive Gewichtung nach Erfolgsquote pro Lage (gleitender Durchschnitt der letzten N Antworten) – Lagen mit niedrigerer Trefferquote werden häufiger abgefragt, gut beherrschte seltener (Spaced-Repetition-Prinzip)
- Diese Erfolgsquote ist ein separater interner Tracker, unabhängig von den Kampagnen-Schwierigkeitspunkten – sie entscheidet nur, welche Note aus den aktiven Lagen als nächstes drankommt, nicht was freigeschaltet ist
- Für den MVP reicht ein einfacheres Round-Robin über die aktiven Lagen, bevor auf gewichtete Auswahl umgestellt wird

## Verknüpfung mit täglichen Übungen (später)

Tägliche Aufgaben knüpfen an das schwerste bzw. zweitschwerste bereits erreichte Level an, damit tägliches Üben nicht nur leichte Wiederholung ist, sondern am eigenen Limit bleibt. Ergänzend gelegentlich ein zufälliges, länger nicht gespieltes mittleres Level einstreuen, damit dort trainierte Fähigkeiten nicht einrosten.

## Empfohlene Umsetzungsreihenfolge

Der Kampagnenmodus sollte nicht als Erweiterung der bestehenden Kategorien-Seite gebaut werden, sondern als eigenes Feature mit eigener Progress-Logik. Es wird eine neue startseite geben, in der die neue Kampagne und die derzeitigen übungen verlinkt sind. Die bestehende Übungslogik ist heute entlang von Kategorien x Schwierigkeitsgrad organisiert. Der Kampagnenmodus ist fachlich anders: relativer Startpunkt je Stimmtyp, ein zusammenhängender Pfad, aktive Entscheidungen bei jedem Fortschritt und später lagenübergreifende Auswahlregeln. Wenn wir das in die bestehende Grid-Struktur pressen, erzeugen wir schnell Sonderfälle und doppelte Logik.

Sinnvolle Reihenfolge:

1. Zuerst das Kampagnen-Datenmodell und die Navigationshülle bauen, noch ohne spielbare Session.
2. Danach den Trainer so öffnen, dass er nicht nur feste Übungen aus `EXERCISES`, sondern allgemein beschriebene Sessions abspielen kann.
3. Erst dann den ersten spielbaren Kampagnenabschnitt bauen: Start-Lage + erste Entscheidungen.
4. Danach Nachbarlagen und relative Level-Generierung ergänzen.
5. Adaptive Gewichtung erst nach dem stabilen Mehrlagen-MVP hinzufügen.
6. Die Verzahnung mit täglichen Übungen ganz zum Schluss bauen.

## Architekturvorschlag

### 1. Eigene Feature-Grenze für Kampagne

Neue Struktur parallel zum bestehenden Trainer-Feature:

- `src/features/campaign/config.ts`: Stimmtypen, Hilfsmittel-Stufen, Level-Generierungsregeln
- `src/features/campaign/types.ts`: Kampagnen-Zustand, Level-Definitionen, Upgrade-Entscheidungen
- `src/features/campaign/storage.ts`: persistenter Kampagnen-Fortschritt
- `src/features/campaign/hooks/useCampaignProgress.ts`: Laden, Speichern, Fortschritt, Upgrades
- `src/features/campaign/hooks/useCampaignSession.ts`: Ableitung einer spielbaren Session aus dem aktuellen Kampagnen-Level
- `src/features/campaign/CampaignPage.tsx`: Pfadansicht, Startpunktwahl, Continue-Entry
- `src/features/campaign/components/...`: Path, Upgrade-Auswahl, Voice-Type-Chooser

Wichtig: Kampagnen-Progress getrennt vom bestehenden Trainer-Progress speichern. Beide Modi dürfen dieselbe Audio- und Session-Engine nutzen, aber nicht dieselben Fortschrittsdaten überschreiben.

### 2. Gemeinsame Session-Engine statt zweitem Trainer

Der vorhandene Trainingsloop in `useEarTrainerGame` ist die richtige Wiederverwendungsstelle. Der Kampagnenmodus sollte keinen zweiten Guess/Feedback/Progress-Loop bekommen. Stattdessen sollte der bestehende Trainer auf eine allgemeinere Session-Beschreibung umgestellt werden.

Zielbild:

- Der bestehende Übungsmodus liefert weiter eine Session aus `EXERCISES` + Kategorie + Schwierigkeitsgrad.
- Der Kampagnenmodus liefert eine Session aus Kampagnen-Level + gewählten Hilfsmitteln + aktiven Lagen.
- `EarTrainer` und die UI-Bausteine bleiben möglichst gleich und bekommen ihre Session-Parameter nur aus einer anderen Quelle.

Die zentrale Schnittstelle sollte ungefähr diese Felder beschreiben:

- aktive Notenmenge
- aktive Frequenz-Multiplikatoren bzw. Lagen
- Anzahl/Konfiguration der Klangfarben-Hinweise
- Farb-Hinweis-Modus
- Fortschrittsziel pro Abschnitt
- Auswahlstrategie für den nächsten Ton: zunächst Round-Robin, später gewichtet

### 3. Kampagne als deklaratives Progressionsmodell

Die 80 Level sollten nicht manuell als 80 einzelne React-Zustände modelliert werden. Besser ist ein deklaratives Modell:

- Ein `CampaignProfile` beschreibt den gewählten Stimmtyp und die daraus abgeleitete Start-Lage.
- Ein `CampaignState` speichert den aktuellen Knoten, freigeschaltete Knoten, investierte Schwierigkeitspunkte und optionale Beherrschungswerte pro Lage.
- Eine `CampaignLevelDefinition` beschreibt, was in einem Level aktiv ist: Notenmenge, Hilfsmittelstand, aktive Lagen, Auswahlregel.
- Eine Generator-Funktion erzeugt die relative Level-Sequenz auf Basis des Startpunkts.

Dadurch bleibt die Logik für Bass, Tenor, Alt und Sopran dieselbe; nur der Startanker verschiebt sich.

## Konkreter Delivery-Plan

### Phase 1: Kampagnen-Skelett ohne Gameplay

Ziel: Die App kennt den Modus, den Einstieg und den persistenten Kampagnenzustand.

Enthält:

- neue Route, zum Beispiel `/campaign`
- Einstiegspunkt von der bestehenden Kursübersicht aus
- Auswahl des Stimmtyps beim ersten Start
- persistenter Kampagnenzustand mit `voiceType`, `startRangeId`, `currentLevel`, `unlockedLevel`, `spentPoints`
- statische Path-Ansicht mit Platzhaltern für 80 Schritte oder zunächst 20 sichtbare Knoten

Noch nicht enthalten:

- kein echter Trainer-Start aus der Kampagne
- keine Upgrade-Entscheidung
- keine adaptive Auswahl

Warum zuerst: Diese Phase klärt Produktfluss, Navigation und Speicherformat, ohne schon die bestehende Trainingslogik umzubauen.

### Phase 2: Session-Vertrag aus dem bestehenden Trainer herausziehen

Ziel: Der Trainer kann durch externe Session-Daten betrieben werden, nicht nur durch `EXERCISES`.

Enthält:

- bestehende Ableitung aus Kategorie + Schwierigkeit in eine explizite Session-Konfiguration überführen
- `useEarTrainerGame` auf eine generischere Eingabe umbauen
- bestehende Übungsmodi unverändert weiter betreiben

Akzeptanzkriterium:

- Der normale Übungsmodus verhält sich nach dem Refactoring exakt wie vorher.

Warum hier: Das ist der wichtigste Architekturschnitt. Erst wenn der sauber steht, lohnt sich spielbare Kampagnenlogik.

### Phase 3: Spielbarer MVP für die Start-Lage

Ziel: Die ersten Kampagnenlevel sind tatsächlich spielbar.

Enthält:

- Level 1 bis ca. 20 nur in der gewählten Start-Lage
- Schwierigkeitspunkte als echte Kampagnenmechanik
- nach einem abgeschlossenen Abschnitt Auswahl zwischen mindestens zwei Upgrade-Arten:
	- Notenmenge erhöhen
	- ein Hilfsmittel reduzieren
- zunächst einfache Auswahl des nächsten Tons innerhalb der Start-Lage
- Rückkehr zur Kampagnenkarte nach Abschluss oder Pause

Vereinfachung für diesen Schritt:

- Hilfsmittel nicht zu fein granulieren; zuerst nur die bereits existierenden Achsen nutzen:
	- Farbhinweis: persistent -> transient -> off
	- Klangfarbenanzahl: 1 -> 2 -> 4

Warum so: Damit entsteht früh ein echter spielbarer Kern, ohne schon Mehrlagen-Logik und Spaced Repetition mitzuschleppen.

### Phase 4: Relative Erweiterung auf Nachbarlagen

Ziel: Der Pfad wächst von der Start-Lage aus nach außen, unabhängig vom Stimmtyp.

Enthält:

- Generator für Nachbarlagen relativ zum Startpunkt
- Level-Definitionen für 2er- und 3er-Lagen-Kombinationen
- zunächst feste Reihenfolge oder Round-Robin über aktive Lagen

Wichtige Architekturregel:

- nicht über feste absolute Levelnummern wie "Level 20 ist immer C3-H4" modellieren
- stattdessen Regeln wie "ab diesem Kampagnenabschnitt kommt die direkte Nachbarlage dazu"

Damit bleibt die Kampagne für alle Start-Stimmtypen konsistent.

### Phase 5: Adaptive Lagengewichtung

Ziel: Bei mehreren aktiven Lagen fragt die App schwächere Lagen häufiger ab.

Enthält:

- separaten Accuracy-Tracker pro Lage
- gleitendes Fenster der letzten N Antworten pro Lage
- gewichtete Auswahl statt reinem Round-Robin

Wichtig:

- diese Werte beeinflussen nur die interne Auswahl des nächsten Tons
- sie verändern nicht den freigeschalteten Kampagnenfortschritt

### Phase 6: Verzahnung mit täglichen Übungen

Ziel: Freies Training und Kampagne greifen sinnvoll ineinander.

Enthält:

- tägliche Aufgabe orientiert sich am schwersten oder zweitschwersten Kampagnenstand
- gelegentliche Wiederholung älterer mittlerer Level
- optionale Hinweise auf sinnvolle nächste Kampagnenlevels

## Was ich bewusst nicht zuerst bauen würde

- Keine 80 hart codierten UI-Karten mit individueller Logik.
- Keine Erweiterung von `TRAINING_CATEGORIES`, um die gesamte Kampagne abzubilden.
- Keine gemeinsame Progress-Struktur für freien Übungsmodus und Kampagne.
- Keine adaptive Gewichtung vor dem Mehrlagen-MVP.
- Keine Verknüpfung mit Daily Exercises vor einem stabilen Kampagnenkern.

## Konkreter erster Implementierungsschnitt

Wenn wir direkt ins Bauen gehen, würde ich als ersten PR-Schnitt genau das umsetzen:

1. neues Feature `campaign` mit Types, Config, Storage und `CampaignPage`
2. neue Route in der App und Einstieg von der Kursseite
3. Stimmtyp-Auswahl + persistenter Kampagnenzustand
4. statische Pfadansicht mit hervorgehobenem aktuellem Knoten

Noch keine spielbare Session in diesem ersten Schnitt.

Der Grund ist einfach: Das ist der kleinste sinnvolle Inkrement-Schnitt, der sofort Produktform zeigt und die spätere Implementierung nicht verbaut.

## Offene Fachfragen vor Phase 3

Diese Punkte sollten wir vor dem ersten spielbaren Kampagnenlevel festziehen:

- Hat Alt genau einen festen Startpunkt oder eine Auswahl zwischen zwei Start-Lagen?
- Hat Sopran genau einen festen Startpunkt oder eine Auswahl zwischen zwei Start-Lagen?
- Bekommt jeder erfolgreiche Level genau einen Punkt, oder können späte Level mehrere Punkte geben?
- Ist die Upgrade-Auswahl dauerhaft irreversibel, oder darf innerhalb eines Abschnitts umgeplant werden?
- Soll ein Kampagnenlevel dieselben Abschnittsziele wie der freie Modus nutzen, oder bekommt die Kampagne eigene Zielwerte?

## Empfehlung für unser gemeinsames Vorgehen

Für die nächsten Schritte ist die sinnvollste Reihenfolge:

1. Wir setzen Phase 1 um.
2. Danach prüfen wir im Code, welche Session-Schnittstelle aus `useEarTrainerGame` herausgezogen werden muss.
3. Erst dann bauen wir den spielbaren Kampagnen-MVP.

So bleibt jeder Schritt klein, testbar und architektonisch sauber.
