import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { actFarm, CROPS, getFarm, growth, orderCrop, subscribeFarm, type CropId, type FarmAction } from '../lib/farm'
import { matchesReply } from '../lib/speakingLessons'
import { Modal } from './Modal'
import { useSpeechPractice } from './useSpeechPractice'

function FarmBackdrop({ fence, flowers }: { fence: boolean; flowers: boolean }) {
  return <svg aria-hidden viewBox="0 0 800 340" preserveAspectRatio="xMidYMid slice" className="absolute inset-x-0 top-0 h-64 w-full">
    <defs><linearGradient id="farm-sky" x2="0" y2="1"><stop stopColor="#c8e6ef"/><stop offset="1" stopColor="#edf4d9"/></linearGradient></defs>
    <path d="M0 0H800V340H0Z" fill="url(#farm-sky)"/>
    <g fill="#fffcf2"><ellipse cx="155" cy="65" rx="70" ry="20"/><ellipse cx="135" cy="50" rx="34" ry="28"/><ellipse cx="181" cy="54" rx="29" ry="24"/><ellipse cx="670" cy="88" rx="60" ry="19"/></g>
    <path d="M0 201Q160 88 330 198T680 170T800 190V340H0Z" fill="#a9c390"/>
    <path d="M0 239Q180 189 360 222T800 220V340H0Z" fill="#c5d8a0"/>
    <g transform="translate(92 225)"><ellipse cy="5" rx="56" ry="10" fill="#8fab73"/><path d="M-8 0V-86H10V0" fill="#a08059"/><path d="M-57-65Q-80-109-47-121Q-39-163-1-145Q29-172 52-129Q84-121 66-77Q45-49-57-65Z" fill="#8aaf77" stroke="#72955f" strokeWidth="3"/><path d="M-40-106Q-45-136-10-133Q11-152 33-120Q48-117 44-94" fill="#b5cc91"/></g>
    <g transform="translate(620 207)"><path d="M-60 0V-83H56V0Z" fill="#f7e9cd" stroke="#c5aa82" strokeWidth="3"/><path d="M-76-80L-3-139L75-80Z" fill="#d49287" stroke="#f6d1b9" strokeWidth="5"/><path d="M-19 0V-47Q0-66 20-47V0" fill="#a88460"/><rect x="-47" y="-56" width="20" height="24" rx="4" fill="#b5d9dc"/><rect x="30" y="-56" width="20" height="24" rx="4" fill="#b5d9dc"/></g>
    <path d="M0 291Q350 261 800 284" stroke="#e4cb9e" strokeWidth="34" fill="none"/>
    {fence && <g stroke="#fff2dc" strokeWidth="7" strokeLinecap="round"><path d="M140 237H530M140 255H530"/>{Array.from({length:12},(_,i)=><path key={i} d={`M${145+i*34} 226V268`}/>)}</g>}
    {flowers && <g>{Array.from({length:18},(_,i)=><g key={i} transform={`translate(${28+i*43} ${306+(i%3)*10})`}><path d="M0 0V-18" stroke="#779761" strokeWidth="3"/><circle cy="-18" r="8" fill={i%2?'#edb0b7':'#fff2ba'}/><circle cy="-18" r="3" fill="#d7af69"/></g>)}</g>}
  </svg>
}
export function FarmScene({ onExit }: { onExit: () => void }) {
  const { lang } = useI18n(); const ko = lang === 'ko'
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [selected, setSelected] = useState<CropId>('carrot')
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const [practice, setPractice] = useState<{ line: string; meaning: string; action?: FarmAction } | null>(null)
  const [heard, setHeard] = useState('')
  const [matched, setMatched] = useState(false)
  const speech = useSpeechPractice(text => {
    setHeard(text)
    if (practice) setMatched(matchesReply(text, { question: '', meaning: '', answer: practice.line, answerMeaning: '', cue: '' }))
  })
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const apply = (action: FarmAction) => {
    const result = actFarm(action)
    setNow(Date.now())
    setNotice(result === 'failed' ? (ko ? '저장하지 못했어요. 저장 공간을 확인해주세요. 기존 농장은 유지돼요.' : 'Could not save. Check storage. Your farm is unchanged.') : result === 'invalid' ? (ko ? '아직 할 수 없는 동작이에요. 밭과 수확물을 확인해주세요.' : 'Check the plot or your basket first.') : (ko ? '농장에 저장했어요 🌱' : 'Farm saved 🌱'))
    return result === 'saved'
  }
  const practiceLine = (line: string, meaning: string, action?: FarmAction) => { speech.stop(); setHeard(''); setMatched(false); setPractice({ line, meaning, action }) }
  const crop = CROPS.find(c => c.id === selected)!
  const order = orderCrop(farm)
  const btn = 'min-h-11 rounded-2xl px-3 py-2 text-sm font-bold'
  return <section aria-label={ko ? '영어 농장' : 'English farm'} className="relative h-full overflow-y-auto rounded-3xl bg-[#edf2de] ring-1 ring-black/5">
    <FarmBackdrop fence={farm.decorations.includes('fence')} flowers={farm.decorations.includes('flowers')}/>
    <div className="relative p-3">
      <header className="flex items-center justify-between gap-2"><button className={`${btn} bg-white/95 shadow-sm`} onClick={onExit}>🗺️ {ko ? '지도' : 'Map'}</button><h2 className="rounded-full bg-white/90 px-3 py-2 text-sm font-bold">🌱 {ko ? '나의 영어 농장' : 'My English farm'}</h2><span className="rounded-full bg-white/95 px-3 py-2 text-sm font-bold">🪙 {farm.coins}</span></header>
      <div className="mt-24 rounded-2xl bg-white/90 p-3 shadow-sm"><p className="m-0 text-sm font-bold">{ko ? '씨앗을 골라 빈 밭에 심고, 물을 한 번 주세요.' : 'Choose seeds, plant an empty plot, then water once.'}</p><p className="mt-1 mb-0 text-xs">{ko ? '물 준 뒤 1~2분이면 수확해요. 접속하지 않아도 자라고 시들지 않아요.' : 'Harvest in 1–2 minutes after watering. Plants grow offline and never wilt.'}</p></div>
      <div aria-label={ko ? '씨앗 선택' : 'Choose seeds'} className="my-3 grid grid-cols-3 gap-2">{CROPS.map(c => <button key={c.id} aria-pressed={selected === c.id} className={`${btn} ${selected===c.id?'bg-white ring-2 ring-blush':'bg-white/75'}`} onClick={() => setSelected(c.id)}><span className="text-2xl">{c.emoji}</span><span className="block">{c[lang]}</span><span lang="en" className="block text-xs font-normal">{c.plural} · {c.seconds}{ko?'초':'s'}</span></button>)}</div>
      <div className="grid grid-cols-3 gap-2">{farm.plots.map((plot,i)=>{
        const growing = plot ? CROPS.find(c => c.id===plot.crop)! : null
        const progress = growth(plot,now); const ready = progress===1
        const label = !plot ? (ko?`${i+1}번 밭에 ${crop.ko} 심기`:`Plant ${crop.en} in plot ${i+1}`) : plot.wateredAt===null ? (ko?`${i+1}번 밭 물 주기`:`Water plot ${i+1}`) : ready ? (ko?`${i+1}번 밭 수확하기`:`Harvest plot ${i+1}`) : (ko?`${i+1}번 밭 자라는 중`:`Plot ${i+1} growing`)
        return <button key={i} aria-label={label} disabled={!!plot && plot.wateredAt!==null && !ready} className="relative flex min-h-32 flex-col items-center justify-center rounded-3xl border-4 border-[#c5ad83] bg-[#ad8057] p-2 text-white shadow-inner disabled:opacity-100" style={{backgroundImage:'repeating-linear-gradient(0deg,transparent 0px,transparent 19px,#90654055 20px,#90654055 23px)'}} onClick={()=>{
          if (!plot) { if(apply({type:'plant',plot:i,crop:selected})) practiceLine(`I want to grow ${crop.plural}.`,`${crop.ko}을 키우고 싶어요.`) }
          else if(plot.wateredAt===null) { if(apply({type:'water',plot:i})) practiceLine(`Water the ${growing!.plural}.`,`${growing!.ko}에 물을 주세요.`) }
          else if(ready) { if(apply({type:'harvest',plot:i})) practiceLine('Look! It is ready.', '봐요! 다 자랐어요.') }
        }}>
          <span aria-hidden className="text-4xl">{!plot?'＋':ready?growing!.emoji:plot.wateredAt===null?'🌰':progress<.45?'🌱':'🌿'}</span>
          <span className="mt-2 text-xs font-bold">{!plot?(ko?'심기':'Plant'):plot.wateredAt===null?(ko?'💧 물 주기':'💧 Water'):ready?(ko?'수확하기':'Harvest'):`${Math.ceil((1-progress)*growing!.seconds)}${ko?'초':'s'}`}</span>
          {plot?.wateredAt!==null && plot && <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/15"><span className="block h-full bg-[#d0ed9a]" style={{width:`${progress*100}%`}}/></span>}
        </button>
      })}</div>
      <p role="status" className="my-2 min-h-5 text-xs font-bold">{notice}</p>
      <div className="rounded-2xl bg-white/90 p-3"><h3 className="m-0 text-sm font-bold">🧺 {ko?'수확 바구니':'Harvest basket'}</h3><div className="mt-2 grid grid-cols-3 gap-2">{CROPS.map(c=><div key={c.id} className="text-center"><p className="my-1 text-sm">{c.emoji} {farm.inventory[c.id]}</p><button disabled={!farm.inventory[c.id]} className={`${btn} w-full bg-petal disabled:opacity-40`} onClick={()=>apply({type:'sell',crop:c.id})}>{ko?'판매':'Sell'} +{c.price}🪙</button></div>)}</div></div>
      <div className="mt-3 rounded-2xl bg-white/90 p-3"><h3 className="m-0 text-sm font-bold">🐰 {ko?'주민의 부탁':'Resident request'} · +12🪙</h3><p lang="en" className="mb-1 text-sm font-bold">Can I have two {order.plural}?</p><p className="mt-0 text-xs">{ko?`${order.ko} 두 개를 줄 수 있나요?`:`Give the resident two ${order.plural}.`}</p><div className="flex gap-2"><button disabled={!speech.canListen} className={`${btn} bg-petal disabled:opacity-40`} onClick={()=>speech.speak(`Can I have two ${order.plural}?`)}>🔊 {ko?'듣기':'Listen'}</button><button disabled={farm.inventory[order.id]<2} className={`${btn} flex-1 bg-blush text-white disabled:opacity-40`} onClick={()=>practiceLine('Here you go!', '여기 있어요!', {type:'deliver'})}>{ko?'말하고 전달하기':'Speak and deliver'} · {farm.inventory[order.id]}/2</button></div></div>
      <div className="mt-3 rounded-2xl bg-white/90 p-3"><h3 className="m-0 text-sm font-bold">🌼 {ko?'농장 꾸미기':'Decorate the farm'}</h3><div className="mt-2 flex gap-2">{(['fence','flowers'] as const).map((id,i)=><button key={id} disabled={farm.decorations.includes(id)||farm.coins<(i?30:20)} className={`${btn} flex-1 bg-petal disabled:opacity-40`} onClick={()=>apply({type:'decorate',id})}>{id==='fence'?(ko?'울타리':'Fence'):(ko?'꽃밭':'Flowers')} · {farm.decorations.includes(id)?'✓':`${i?30:20}🪙`}</button>)}</div></div>
    </div>
    {practice && <Modal title={ko?'농장에서 한마디 영어':'Speak on the farm'} onClose={()=>{speech.stop();setPractice(null)}}>
      <p className="text-sm">{ko?'듣고 짧게 소리 내어 말해봐요. 막혀도 괜찮아요.':'Listen and say it aloud. Take your time.'}</p><p lang="en" className="rounded-2xl bg-cream p-4 text-xl font-bold">{practice.line}</p><p className="text-sm">{practice.meaning}</p>
      <div className="flex flex-col gap-2"><button disabled={!speech.canListen} className={`${btn} bg-petal disabled:opacity-40`} onClick={()=>speech.speak(practice.line)}>🔊 {ko?'듣고 따라 말하기':'Listen and repeat'}</button>{speech.supported && <button className={`${btn} bg-blush text-white`} onClick={()=>speech.listening?speech.stop():speech.start()}>{speech.listening?(ko?'⏹ 듣는 중 · 멈추기':'⏹ Listening · stop'):(ko?'🎤 직접 말하기':'🎤 Speak')}</button>}
      {heard && <p role="status" className="text-sm">{ko?'인식된 말: ':'Heard: '}{heard}<span className="block">{matched?(ko?'표현이 잘 맞아요!':'That fits!'):(ko?'예시를 듣고 다시 말해봐도 좋아요.':'Listen and try again if you like.')}</span></p>}
      {speech.error && <p role="alert" className="text-xs">{ko?'음성 인식을 못 했어요. 다시 시도하거나 소리 내어 말한 뒤 직접 완료해주세요.':'Recognition failed. Retry or say it aloud and continue yourself.'}</p>}
      <button className={`${btn} bg-petal`} onClick={()=>{speech.stop();if(!practice.action||apply(practice.action))setPractice(null)}}>{matched?(ko?'완료하기':'Finish'):(ko?'소리 내어 말했어요 · 직접 완료':'I said it aloud · finish myself')}</button></div>
      <p className="text-xs text-cocoa-soft">{ko?'마이크는 버튼을 누를 때만 켜져요. 음성 인식은 발음 점수가 아니에요.':'The microphone starts only when tapped. Recognition is not a pronunciation score.'}</p>
    </Modal>}
  </section>
}
