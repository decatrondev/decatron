import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bootDesign } from './design/runtime'
import './components/ds/ds.css'
import './index.css'
import App from './App.tsx'

bootDesign().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
