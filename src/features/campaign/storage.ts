import { readProgress, writeProgress } from '../earTrainer/storage'

export async function readCampaignProgress(key: string) {
  return readProgress(key)
}

export async function writeCampaignProgress(key: string, value: string) {
  return writeProgress(key, value)
}