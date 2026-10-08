import { useState } from 'react'
import { useI18n } from '../i18n'
import { useEconomy } from '../state/useEconomy'
import { dayKey, levelOf, setQuote, unlocked, validateEconomy } from '../lib/economyCore'
import { ECONOMY, THEME_SETS } from '../data/economy'
import { ROOM_CATALOG, ROOM_ITEM_BY_ID, sanitizeRoom } from '../lib/room'
import { assetUrl, ITEM_BY_ID } from '../lib/items'
import { sanitizeOutfit } from '../lib/outfit'
import { sanitizeTweaks } from '../lib/tweaks'
import { CATEGORIES } from '../lib/layers'
import type { RoomItemDef, RoomState } from '../lib/roomTypes'
import type { Outfit, Tweaks } from '../lib/types'
import { Modal } from './Modal'

const PRESETS_KEY='ryuso.room-presets.v1'
interface Preset { name: string; room: RoomState; outfit: Outfit; tweaks: Tweaks }
interface Props { view: 'room'|'shop'|'collection'; room: RoomState; outfit: Outfit; tweaks: Tweaks; onPlace:(d:RoomItemDef)=>void; onRoom:(r:RoomState)=>void; onPreview:(d:RoomItemDef|null)=>void; onRestore:(r:RoomState,o:Outfit,t:Tweaks)=>void; onToast:(s:string)=>void }
const cats=[['all','✨','전체','All'],['wallpaper','💗','벽지','Wallpaper'],['floor','🪵','바닥','Floor'],['furniture','🛋️','가구','Furniture'],['wall','🖼️','벽 소품','Wall'],['props','🧸','소품','Props'],['lighting','💡','조명','Lights'],['sticker','🌸','스티커','Stickers']]
export function RoomAsset({item}:{item:RoomItemDef}){
 const [failed,setFailed]=useState(false)
 return failed?<svg viewBox="0 0 120 120" aria-label={item.name.ko}><rect x="12" y="20" width="96" height="80" rx="18" fill="#ffe9ef" stroke="#c4977a"/><path d="M60 42L66 54L80 56L70 66L72 80L60 73L48 80L50 66L40 56L54 54Z" fill="#ebc777"/></svg>:<img src={assetUrl(item.thumb)} onError={()=>setFailed(true)} alt="" draggable={false} loading="lazy"/>
}
export function RoomEconomyPanel({view,room,outfit,tweaks,onPlace,onRoom,onPreview,onRestore,onToast}:Props){
 const {lang}=useI18n();const tx=(ko:string,en:string)=>lang==='ko'?ko:en
 const store=useEconomy();const s=store.data
 const [cat,setCat]=useState('all');const [purchase,setPurchase]=useState<{item?:RoomItemDef;setId?:string}|null>(null)
 const [backup,setBackup]=useState(false);const [code,setCode]=useState('');const [name,setName]=useState('')
 const [presets,setPresets]=useState<Preset[]>(()=>{try{const raw=JSON.parse(localStorage.getItem(PRESETS_KEY)??'[]');return Array.isArray(raw)?raw.filter(p => p && typeof p.name === 'string' && p.name.length <= 40 && p.room && typeof p.room === 'object').slice(0,ECONOMY.maxPresets):[]}catch{return []}})
 const validRoom=(raw:unknown,owned:string[])=>{const r=sanitizeRoom(raw);r.items=r.items.filter(p=>owned.includes(p.itemId));if(!owned.includes(r.wallpaperId??''))r.wallpaperId='wallpaper_heart';if(!owned.includes(r.floorId??''))r.floorId='floor_wood';return r}
 const loadPreset=(p:Preset)=>{const o=sanitizeOutfit(p.outfit,ITEM_BY_ID);onRestore(validRoom(p.room,s.owned),o,sanitizeTweaks(p.tweaks,CATEGORIES,o));onPreview(null)}
 const savePresets=(next:Preset[])=>{try{localStorage.setItem(PRESETS_KEY,JSON.stringify(next));setPresets(next);return true}catch{onToast(tx('저장 공간이 부족합니다.','Storage is unavailable.'));return false}}
 const error=()=>onToast(tx('구매 조건 또는 저장 공간을 확인해 주세요.','Check purchase requirements or storage.'))
 const status=(d:RoomItemDef)=>s.owned.includes(d.id)?tx('보유','Owned'):!unlocked(s,d)?tx('잠금','Locked'):s.points<d.price?tx('별 부족','Need stars'):tx('구매 가능','Available')
 const condition=(d:RoomItemDef)=>!d.unlock?'':d.unlock.type==='level'?tx(`레벨 ${d.unlock.value}`,`Level ${d.unlock.value}`):d.unlock.type==='streak'?tx(`연속 출석 ${d.unlock.value}일`,`Streak ${d.unlock.value} days`):d.unlock.type==='points'?tx(`누적 획득 ★${d.unlock.value}`,`Earn ★${d.unlock.value}`):tx('이벤트 조건','Event requirement')
 const items=ROOM_CATALOG.filter(d=>(cat==='all'||d.category===cat)&&(view!=='room'||s.owned.includes(d.id)))
 const exportCode=()=>{const raw=JSON.stringify({app:'ryuso-room',version:1,economy:s,room,outfit,tweaks,presets});const bytes=new TextEncoder().encode(raw);let bin='';bytes.forEach(v=>bin+=String.fromCharCode(v));setCode('RYUSO1.'+btoa(bin))}
 const importCode=()=>{try{
  if(!code.startsWith('RYUSO1.')||code.length>500000)throw Error('BAD_CODE')
  const b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code.slice(7)),c=>c.charCodeAt(0))))
  if(b.app!=='ryuso-room'||b.version!==1||!b.room||typeof b.room!=='object'||!b.outfit||typeof b.outfit!=='object'||!Array.isArray(b.presets)||b.presets.length>ECONOMY.maxPresets)throw Error('BAD_CODE')
  const validated=validateEconomy(b.economy,ROOM_CATALOG)
  const o=sanitizeOutfit(b.outfit,ITEM_BY_ID);const t=sanitizeTweaks(b.tweaks,CATEGORIES,o)
  const next=b.presets.map((p:Preset)=>{if(!p||typeof p.name!=='string'||p.name.length>40)throw Error('BAD_CODE');const po=sanitizeOutfit(p.outfit,ITEM_BY_ID);return {name:p.name,room:validRoom(p.room,validated.owned),outfit:po,tweaks:sanitizeTweaks(p.tweaks,CATEGORIES,po)}})
  if(!window.confirm(tx('현재 별·방·프리셋을 백업 내용으로 교체할까요?','Replace stars, room and presets with this backup?')))return
  const old=localStorage.getItem(PRESETS_KEY)
  localStorage.setItem(PRESETS_KEY,JSON.stringify(next))
  if(!store.restore(validated)){if(old===null)localStorage.removeItem(PRESETS_KEY);else localStorage.setItem(PRESETS_KEY,old);throw Error('SAVE_FAILED')}
  setPresets(next);onRestore(validRoom(b.room,validated.owned),o,t);onPreview(null);setBackup(false);onToast(tx('백업을 복원했습니다.','Backup restored.'))
 }catch{onToast(tx('백업 코드가 올바르지 않거나 저장할 수 없습니다.','Invalid backup or storage unavailable.'))}}
 const q=purchase?.setId?setQuote(s,ROOM_CATALOG,purchase.setId):null
 return <div className="economy-panel">
  <div className="economy-summary"><div><small>{tx('나의 작은 옷방','MY LITTLE DRESSING ROOM')}</small><h2>{view==='shop'?tx('별빛 상점','Star shop'):view==='collection'?tx('나의 도감','My collection'):tx('방 꾸미기','Decorate')}</h2></div><strong>★ {s.points}</strong></div>
  <div className="reward-row"><span>{tx('레벨','Level')} {levelOf(s)} · {tx('연속 출석','Streak')} {s.streak}</span><button onClick={()=>store.attendance()?onToast(tx('오늘 출석이 기록되었습니다.','Attendance recorded.')):error()} disabled={s.lastAttendance===dayKey()}>{tx('출석 +5','Check in +5')}</button><button disabled={s.missions.includes(dayKey())||!s.rewards[dayKey()]?.length} onClick={()=>store.dailyMission()?onToast(tx('미션 보상을 받았습니다.','Mission reward claimed.')):error()}>{tx('코디 저장 미션 +30','Save an outfit +30')}</button></div>
  <p className="economy-hint">{tx('새 코디 저장 +10 (하루 3회) · 7일 연속 출석 +50','New outfit +10 (3/day) · 7-day streak +50')}</p>
  {view==='room'&&<div className="preset-row"><input maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder={tx('방 이름','Room name')} aria-label={tx('방 이름','Room name')}/><button onClick={()=>{if(presets.length>=ECONOMY.maxPresets)return onToast(tx('프리셋은 최대 6개입니다.','Maximum 6 presets.'));if(savePresets([...presets,{name:name.trim()||tx('나의 방','My room'),room:structuredClone(room),outfit:structuredClone(outfit),tweaks:structuredClone(tweaks)}]))onToast(tx('방을 저장했습니다.','Room saved.'))}}>{tx('방 저장','Save room')}</button>{presets.map((p,i)=><div key={i}><button onClick={()=>loadPreset(p)}>{p.name}</button><button aria-label={tx('프리셋 삭제','Delete preset')} onClick={()=>savePresets(presets.filter((_,n)=>n!==i))}>×</button></div>)}</div>}
  <div className="category-scroll">{cats.map(([id,icon,ko,en])=><button key={id} aria-pressed={cat===id} onClick={()=>setCat(id)} className={cat===id?'active':''}>{icon}<small>{tx(ko,en)}</small></button>)}</div>
  {view==='shop'&&<div className="theme-sets">{THEME_SETS.map(set=>{const quote=setQuote(s,ROOM_CATALOG,set.id);return <button key={set.id} disabled={!quote.missing.length} onClick={()=>setPurchase({setId:set.id})}>{set.name[lang]}<small>{quote.missing.length?`★ ${quote.price} · −15%`:tx('세트 완성','Complete')}</small></button>})}</div>}
  <div className="economy-grid">{items.map(d=><article key={d.id} className={s.owned.includes(d.id)?'owned':''}><div className="room-thumb"><RoomAsset item={d}/></div><strong>{d.name[lang]}</strong><small>{status(d)}{!unlocked(s,d)&&` · ${condition(d)}`}</small><span>★ {d.price}</span><div>{view==='room'?<><button onClick={()=>onPlace(d)}>{tx('배치','Place')}</button><button aria-label={tx('이 슬롯 비우기','Clear slot')} onClick={()=>{if(d.group==='wallpaper'||d.group==='floor')return;onRoom({...room,items:room.items.filter(p=>(ROOM_ITEM_BY_ID[p.itemId]?.slot??p.itemId)!==(d.slot??d.id))})}}>×</button></>:view==='shop'?<><button onClick={()=>onPreview(d)}>{tx('미리보기','Preview')}</button><button disabled={s.owned.includes(d.id)||!unlocked(s,d)||s.points<d.price} onClick={()=>setPurchase({item:d})}>{s.owned.includes(d.id)?tx('보유','Owned'):tx('구매','Buy')}</button></>:null}</div></article>)}</div>
  {!items.length&&<p className="economy-hint">{tx('이 카테고리는 아직 비어 있습니다.','No items in this category yet.')}</p>}
  <div className="panel-bottom"><button onClick={()=>onPreview(null)}>{tx('미리보기 해제','Clear preview')}</button><button onClick={()=>setBackup(true)}>{tx('백업 코드','Backup code')}</button></div>
  {purchase&&<Modal title={tx('구매 확인','Confirm purchase')} onClose={()=>setPurchase(null)}><p>{purchase.item?.name[lang]??THEME_SETS.find(t=>t.id===purchase.setId)?.name[lang]}</p><p>★ {q?.price??purchase.item?.price} · {tx('현금 결제 없이 별만 사용합니다.','Uses stars only, no cash payment.')}</p>{q&&<p>{tx('미보유 아이템만 구매 · 완성 보너스 +15','Only missing items · Completion bonus +15')}</p>}<button className="primary-action" disabled={q?.missing.some(i=>!unlocked(s,i))||(q?.price??purchase.item?.price??0)>s.points} onClick={()=>{const ok=purchase.item?store.purchase(purchase.item.id):store.purchaseSet(purchase.setId!);if(ok){onToast(tx('구매했습니다. 내 방에서 배치해 보세요.','Purchased. Place it in My room.'));setPurchase(null);onPreview(null)}else error()}}>{tx('구매하기','Purchase')}</button></Modal>}
  {backup&&<Modal title={tx('백업 코드','Backup code')} onClose={()=>setBackup(false)}><p>{tx('별·보유 아이템·현재 코디·방·프리셋을 보관합니다.','Includes stars, inventory, outfit, room and presets.')}</p><textarea rows={6} value={code} onChange={e=>setCode(e.target.value)} aria-label={tx('백업 코드','Backup code')} className="backup-code"/><div className="preset-row"><button onClick={exportCode}>{tx('코드 만들기','Export code')}</button><button onClick={importCode}>{tx('가져오기','Import')}</button></div></Modal>}
 </div>
}
