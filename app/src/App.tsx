import { Route, Routes } from 'react-router-dom'
import WelcomeScreen from './components/WelcomeScreen'
import QuizScreen from './components/QuizScreen'
import ResultsScreen from './components/ResultsScreen'
import SharedResultScreen from './components/SharedResultScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/quiz" element={<QuizScreen />} />
      <Route path="/r/:code" element={<ResultsScreen />} />
      <Route path="/s/:code" element={<SharedResultScreen />} />
      <Route path="*" element={<WelcomeScreen />} />
    </Routes>
  )
}
