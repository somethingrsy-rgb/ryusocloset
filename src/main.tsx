import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAppUpdates } from './lib/appUpdate'
import App from './App'
import './index.css'
import { loadCustomItems, loadCustomRoomItems } from './lib/customItems'

initAppUpdates()

// 브라우저가 공간이 모자랄 때 코인·별·아이템·코디 같은 저장 데이터를 마음대로 지우지 않도록 '지우지 말아 주세요'를 요청한다(지원하지 않거나 거절돼도 앱은 그대로 동작)
try { void navigator.storage?.persist?.() } catch { /* 지원하지 않는 브라우저 */ }

// 저장된 내 옷을 먼저 불러온 뒤 그려야, 저장해 둔 코디에 들어 있는 내 옷도 사라지지 않는다
void Promise.all([loadCustomItems(), loadCustomRoomItems()]).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
