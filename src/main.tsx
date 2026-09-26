import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import ConstructionDataProvider from './mock/ConstructionDataProvider'
import SessionProvider from './session/SessionProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <ConstructionDataProvider>
        <App />
      </ConstructionDataProvider>
    </SessionProvider>
  </React.StrictMode>,
)
