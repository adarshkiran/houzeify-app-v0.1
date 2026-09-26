import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import ConstructionDataProvider from './mock/ConstructionDataProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConstructionDataProvider>
      <App />
    </ConstructionDataProvider>
  </React.StrictMode>,
)
