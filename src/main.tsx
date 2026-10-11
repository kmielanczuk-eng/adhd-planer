import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAccount } from './lib/account'
import { ensureDopamineDefaults } from './lib/actions'
import { startLocalReminders } from './lib/notify'
import { applyTheme, getSettings } from './lib/settings'

applyTheme(getSettings().theme)
initAccount()
void ensureDopamineDefaults()
startLocalReminders()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
