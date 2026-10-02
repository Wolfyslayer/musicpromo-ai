import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import MobileRenderHost from '@/pages/MobileRenderHost'
import '@/index.css'

document.documentElement.classList.remove("light", "dark")

const isMobileRenderHost = new URLSearchParams(window.location.search).has("mobile-render")

ReactDOM.createRoot(document.getElementById('root')).render(
  isMobileRenderHost ? <MobileRenderHost /> : <App />
)
