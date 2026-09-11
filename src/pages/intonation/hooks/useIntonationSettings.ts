import { useEffect, useState } from 'react'

import { readIntonationSettings, saveIntonationSettings } from '../helpers/storage'
import type { IntonationInstrumentId, IntonationSettings } from '../types'

export function useIntonationSettings() {
  const [settings, setSettings] = useState<IntonationSettings>(readIntonationSettings)

  useEffect(() => {
    saveIntonationSettings(settings)
  }, [settings])

  const toggleMicrophone = (onStopListening?: () => void) => {
    if (settings.microphoneEnabled && onStopListening) {
      onStopListening()
    }
    setSettings((current) => ({
      ...current,
      microphoneEnabled: !current.microphoneEnabled,
    }))
  }

  const selectInstrument = (instrumentId: IntonationInstrumentId) => {
    setSettings((current) => ({
      ...current,
      selectedInstrumentId: instrumentId,
    }))
  }

  return {
    settings,
    toggleMicrophone,
    selectInstrument,
  }
}
