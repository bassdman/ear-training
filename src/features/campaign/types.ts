export type CampaignRangeId = 'male-low' | 'low' | 'mid' | 'high'

export type CampaignVoiceType = 'bass' | 'tenor' | 'alto' | 'soprano'

export type CampaignProgressState = {
  voiceType: CampaignVoiceType | null
  startRangeId: CampaignRangeId | null
  currentLevelIdx: number
  unlockedLevelIdx: number
  spentPoints: number
}