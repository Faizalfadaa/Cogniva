import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'
import { BridgeProvider } from './bridge/BridgeProvider'
import { LanguageProvider } from './i18n/LanguageProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <BridgeProvider>
          <App />
        </BridgeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
