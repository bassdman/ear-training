type Detail = Record<string, string | number | boolean | null>
type Event = { ms: number, type: string, detail: Detail }
type Metric = { count: number, total: number, max: number }

const MAX_EVENTS = 3000

export class PlaybackDiagnostics {
  private readonly startedAt = performance.now()
  private readonly started = new Date().toISOString()
  private events: Event[] = []
  private metrics: Record<string, Metric> = {}
  private dropped = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private observer: PerformanceObserver | null = null
  private active = false
  private readonly trackNumbers = new Map<string, number>()

  trackNumber(id: string) {
    let number = this.trackNumbers.get(id)
    if (number === undefined) {
      number = this.trackNumbers.size + 1
      this.trackNumbers.set(id, number)
    }
    return number
  }

  start() {
    if (this.active) return
    this.active = true
    this.event('diagnostics-start', {
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      visibility: document.visibilityState,
    })
    document.addEventListener('visibilitychange', this.visibilityChanged)
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.measure('mainThreadLongTaskMs', entry.duration)
        })
        this.observer.observe({ entryTypes: ['longtask'] })
      } catch (cause) {
        this.observer?.disconnect()
        this.observer = null
        console.error('Long-Task-Beobachtung konnte nicht gestartet werden:', cause)
        this.event('longtask-observer-error', { error: cause instanceof Error ? cause.name : 'unknown' })
      }
    }
    this.timer = setInterval(() => this.flush(), 1000)
  }

  stop() {
    if (!this.active) return
    this.active = false
    document.removeEventListener('visibilitychange', this.visibilityChanged)
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.observer?.disconnect()
    this.observer = null
    this.flush()
    this.event('diagnostics-stop', {})
  }

  private visibilityChanged = () => this.event('visibility', { state: document.visibilityState })

  event(type: string, detail: Detail = {}) {
    if (this.events.length >= MAX_EVENTS) {
      this.events.shift()
      this.dropped++
    }
    this.events.push({ ms: Math.round(performance.now() - this.startedAt), type, detail })
  }

  measure(name: string, value: number) {
    if (!Number.isFinite(value)) return
    const metric = this.metrics[name] ?? { count: 0, total: 0, max: value }
    metric.count++
    metric.total += value
    metric.max = Math.max(metric.max, value)
    this.metrics[name] = metric
  }

  private flush() {
    for (const [name, metric] of Object.entries(this.metrics)) {
      this.event('metric', { name, count: metric.count, total: Math.round(metric.total * 100) / 100, max: Math.round(metric.max * 100) / 100 })
    }
    this.metrics = {}
  }

  snapshot() {
    this.flush()
    return {
      format: 'ear-training-playback-debug-log',
      version: 1,
      startedAt: this.started,
      exportedAt: new Date().toISOString(),
      droppedEvents: this.dropped,
      events: [...this.events],
    }
  }
}

export function downloadPlaybackDiagnostics(log: PlaybackDiagnostics) {
  const blob = new Blob([JSON.stringify(log.snapshot(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = 'audiobook-playback-debug.json'
    link.hidden = true
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
