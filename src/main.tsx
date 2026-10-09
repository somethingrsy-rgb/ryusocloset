import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { loadCustomItems, loadCustomRoomItems } from './lib/customItems'

registerSW({ immediate: true })

// 저장된 내 옷을 먼저 불러온 뒤 그려야, 저장해 둔 코디에 들어 있는 내 옷도 사라지지 않는다
void Promise.all([loadCustomItems(), loadCustomRoomItems()]).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
