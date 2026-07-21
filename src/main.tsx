import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyBranding } from './lib/branding'
import './index.css'

// Set the browser title and accent color from the runtime branding before the first paint.
applyBranding()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
