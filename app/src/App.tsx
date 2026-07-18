import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import WelcomeScreen from './components/WelcomeScreen'
import QuizScreen from './components/QuizScreen'
import ResultsScreen from './components/ResultsScreen'
import SharedResultScreen from './components/SharedResultScreen'
import { trackVisit } from './lib/analytics'

// Lazy: regular visitors never download the dashboard bundle.
const AdminScreen = lazy(() => import('./components/admin/AdminScreen'))

export default function App() {
  useEffect(() => {
    trackVisit()
  }, [])
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/quiz" element={<QuizScreen />} />
      <Route path="/r/:code" element={<ResultsScreen />} />
      <Route path="/s/:code" element={<SharedResultScreen />} />
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <AdminScreen />
          </Suspense>
        }
      />
      <Route path="*" element={<WelcomeScreen />} />
    </Routes>
  )
}
