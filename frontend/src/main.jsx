import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css' 
import './bootstrap.min.css'
import './index.css'
import './sweetalert2-custom.css'
import App from './App.jsx'
import './utils/leafletIconFix'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
