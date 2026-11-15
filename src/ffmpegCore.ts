import type { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

export function loadFFmpegCore(ffmpeg: FFmpeg) {
  return ffmpeg.load({
    coreURL: new URL(coreURL, window.location.href).href,
    wasmURL: new URL(wasmURL, window.location.href).href,
  })
}
