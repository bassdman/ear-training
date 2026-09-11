import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { CampaignTrainerPage } from './features/campaign/CampaignTrainerPage'
import { CoursePage } from './pages/course/CoursePage'
import { HomePage } from './pages/home/HomePage'
import { IntonationTrainingPage } from './pages/intonation/IntonationTrainingPage'
import { TrainerPage } from './pages/TrainerPage'
import { ExerciseSettings } from './components/ExcerciseSettings'
import { ConverterPage } from './pages/converter/ConverterPage'

function App() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/course" element={<CoursePage />} />
      <Route path="/intonation-training" element={<IntonationTrainingPage />} />
      <Route path="/converter" element={<ConverterPage />} />
      <Route
        path="/campaign"
        element={
          <ExerciseSettings
            onBackHome={() => navigate('/')}
            onOpenExercises={() => navigate('/course')}
            onOpenTrainer={(levelIdx) => navigate(`/campaign/trainer?level=${levelIdx}`)}
          />
        }
      />
      <Route path="/campaign/trainer" element={<CampaignTrainerPage />} />
      <Route
        path="/trainer"
        element={
          <TrainerPage onBackToCourse={() => navigate('/course')} />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
