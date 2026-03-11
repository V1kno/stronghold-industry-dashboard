import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './App'
import PasswordGate from './PasswordGate'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PasswordGate>
      <Dashboard />
    </PasswordGate>
  </React.StrictMode>,
)