import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

document.documentElement.classList.remove("light", "dark")

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
