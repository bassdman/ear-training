import { useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import JSZip from 'jszip'
import { Link } from 'react-router-dom'

import './converterPage.css'

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
const VOICE_AUDIO_FILTER = 'highpass=f=70,lowpass=f=12000,afftdn=nr=12:nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11'

type BatchState = 'idle' | 'loading' | 'converting' | 'done' | 'error'
type FileState = 'pending' | 'converting' | 'done' | 'error'

type ConvertedFile = {
  id: string
  sourceName: string
  outputName: string
  state: FileState
  url?: string
  blob?: Blob
  error?: string
}

function createId(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`
}

export function ConverterPage() {
  const [state, setState] = useState<BatchState>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<ConvertedFile[]>([])
  const [zipUrl, setZipUrl] = useState<string | null>(null)
  const objectUrlsRef = useRef<string[]>([])

  async function convertBatch(selectedFiles: File[]) {
    const movFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.mov'))
    if (movFiles.length === 0) {
      setState('error')
      setMessage('Bitte wähle mindestens eine MOV-Datei aus.')
      return
    }

    const batchFiles = movFiles.map((file, index) => ({
      id: createId(file, index),
      sourceName: file.name,
      outputName: `${file.name.replace(/\.mov$/i, '')}.mp3`,
      state: 'pending' as FileState,
    }))
    setFiles(batchFiles)
    setZipUrl(null)
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    setState('loading')
    setProgress(0)
    setMessage(`${movFiles.length} Datei${movFiles.length === 1 ? '' : 'en'} werden vorbereitet ...`)

    const ffmpeg = new FFmpeg()
    let completed = 0
    ffmpeg.on('progress', ({ progress: conversionProgress }) => {
      setProgress(Math.round(((completed + conversionProgress) / movFiles.length) * 100))
    })

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      setState('converting')
      for (const [index, file] of movFiles.entries()) {
        const item = batchFiles[index]
        const inputName = `input-${index}.mov`
        const outputName = `output-${index}.mp3`
        setMessage(`Datei ${index + 1} von ${movFiles.length}: ${file.name}`)
        setFiles((current) => current.map((currentFile) => currentFile.id === item.id
          ? { ...currentFile, state: 'converting' }
          : currentFile))

        try {
          await ffmpeg.writeFile(inputName, await fetchFile(file))
          await ffmpeg.exec([
            '-i', inputName,
            '-vn',
            '-af', VOICE_AUDIO_FILTER,
            '-codec:a', 'libmp3lame',
            '-b:a', '192k',
            outputName,
          ])
          const data = await ffmpeg.readFile(outputName)
          const audioData = typeof data === 'string' ? new TextEncoder().encode(data) : data
          const blob = new Blob([audioData.buffer as ArrayBuffer], { type: 'audio/mpeg' })
          const url = URL.createObjectURL(blob)
          objectUrlsRef.current.push(url)
          setFiles((current) => current.map((currentFile) => currentFile.id === item.id
            ? { ...currentFile, state: 'done', blob, url }
            : currentFile))
          await ffmpeg.deleteFile(inputName)
          await ffmpeg.deleteFile(outputName)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Konvertierung fehlgeschlagen.'
          setFiles((current) => current.map((currentFile) => currentFile.id === item.id
            ? { ...currentFile, state: 'error', error: errorMessage }
            : currentFile))
        }
        completed += 1
      }

      setProgress(100)
      await ffmpeg.terminate()
      setState('done')
      setMessage('Alle Dateien wurden abgearbeitet.')
    } catch (error) {
      await ffmpeg.terminate()
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Die Datei konnte nicht konvertiert werden.')
    }
  }

  async function downloadZip() {
    const successfulFiles = files.filter((file) => file.state === 'done' && file.blob)
    if (successfulFiles.length === 0) return
    const zip = new JSZip()
    successfulFiles.forEach((file) => zip.file(file.outputName, file.blob!))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.push(url)
    setZipUrl(url)
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : []
    if (selectedFiles.length > 0) void convertBatch(selectedFiles)
    event.target.value = ''
  }

  const completedFiles = files.filter((file) => file.state === 'done')
  const isBusy = state === 'loading' || state === 'converting'

  return (
    <main className="converter-page">
      <div className="converter-shell">
        <Link className="converter-back" to="/">Zur Startseite</Link>
        <header className="converter-header">
          <p className="converter-kicker">Lokales Werkzeug</p>
          <h1>MOV in MP3 umwandeln</h1>
          <p>Wähle mehrere Dateien aus. Sie werden nacheinander direkt in deinem Browser verarbeitet.</p>
        </header>

        <section className="converter-panel" aria-label="MOV-Konverter">
          <label className="file-picker">
            <span>{isBusy ? 'Konvertierung läuft ...' : 'MOV-Dateien auswählen'}</span>
            <input type="file" accept=".mov,video/quicktime" multiple disabled={isBusy} onChange={handleFileChange} />
          </label>
          {state !== 'idle' && <p className={`converter-status is-${state}`} role="status">{message}</p>}
          {isBusy && <progress className="converter-progress" value={progress} max="100">{progress}%</progress>}

          {files.length > 0 && (
            <ul className="converter-files">
              {files.map((file) => (
                <li key={file.id}>
                  <span>{file.sourceName}</span>
                  {file.state === 'done' && file.url && <a href={file.url} download={file.outputName}>MP3</a>}
                  {file.state === 'pending' && <small>Wartet</small>}
                  {file.state === 'converting' && <small>Wird konvertiert ...</small>}
                  {file.state === 'error' && <small className="file-error">Fehler</small>}
                </li>
              ))}
            </ul>
          )}

          {completedFiles.length > 0 && !isBusy && (
            <div className="download-actions">
              <button className="download-link" type="button" onClick={() => void downloadZip()}>
                Alle als ZIP bündeln
              </button>
              {zipUrl && <a className="download-link" href={zipUrl} download="konvertierte-audios.zip">ZIP herunterladen</a>}
            </div>
          )}
          <p className="converter-note">Die Dateien bleiben auf diesem Gerät. Hintergrundrauschen wird reduziert und die Stimmen werden auf -16 LUFS normalisiert. Die Tonhöhe bleibt unverändert. Nicht unterstützte MOV-Audio-Codecs und sehr große Dateien können die Konvertierung verhindern.</p>
        </section>
      </div>
    </main>
  )
}