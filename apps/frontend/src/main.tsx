import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'
import { BridgeProvider } from './bridge/BridgeProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BridgeProvider>
        <App />
      </BridgeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)