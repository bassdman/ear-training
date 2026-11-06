// Mindestlautstärke als RMS-Amplitude (0 bis 1).
// Kleiner erkennt leisere Töne, aber möglicherweise auch mehr Hintergrundgeräusche.
export const MIN_VOLUME_RMS = 0.008

// Mindestklarheit der erkannten Tonhöhe (0 bis 1).
// Kleiner akzeptiert unklarere Töne, erhöht aber das Risiko falscher Treffer.
export const MIN_PITCH_CLARITY = 0.85

// Akzeptierter Frequenzbereich in Hz: beide Werte > 0, Minimum < Maximum.
// Außerhalb dieses Bereichs werden Messungen als Lücke dargestellt.
export const MIN_FREQUENCY_HZ = 55
export const MAX_FREQUENCY_HZ = 1200

// Analysefenster in Samples: Zweierpotenz zwischen 32 und 32768.
// Größer hilft bei tiefen Tönen, erhöht aber Verzögerung und Rechenaufwand.
export const ANALYSIS_FFT_SIZE = 4096

// Mindestabstand der Analysen in Millisekunden (> 0).
// Kleiner aktualisiert häufiger, benötigt aber mehr Rechenleistung.
export const ANALYSIS_INTERVAL_MS = 50

// Eine längere Analyseunterbrechung erzeugt eine Lücke (Millisekunden, > 0).
// Größer als ANALYSIS_INTERVAL_MS wählen, damit normale Abstände verbunden bleiben.
export const MAX_SAMPLE_GAP_MS = 250

// Länge des sichtbaren Live-Verlaufs in Millisekunden (> 0).
export const WINDOW_MS = 5000
