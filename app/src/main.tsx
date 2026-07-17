import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/crimson-text/400.css'
import '@fontsource/crimson-text/400-italic.css'
import '@fontsource/crimson-text/600.css'
import '@fontsource/crimson-text/700.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import './styles/global.css'
import './styles/screens.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
