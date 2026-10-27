import React from 'react'
import ReactDOM from 'react-dom/client'
// Global tokens and shared primitives load before component styles
import './index.css'
import './ui.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
