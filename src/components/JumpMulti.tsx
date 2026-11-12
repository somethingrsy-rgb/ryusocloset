import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { earnStars } from '../lib/shop'
import { playHop, playLand, playLose, playTap, playWin } from '../lib/sound'
import { assetUrl } from '../lib/items'
import { ANIMALS, COLORS, SIZE, findMove, planCpuTurn, setsOf, type Pos } from '../lib/jumpPuzzle'
import { actionOf, applyAction, isMOver, newMState, rewardFor, winnersOf, type Action } from '../lib/jumpMulti'
import { JUMP_MAX, joinJumpRoom, type JumpRoom, type JumpSnap } from '../lib/mp/jumpNet'
import { getMp, sayJump, savedName, subscribeMp } from '../lib/mp/session'
import { DARK, FILL, MARK } from './jumpStyle'

const ANIMAL_KO = ['토끼', '강아지', '호랑이', '곰돌이', '고양이', '팬더']
/** 자리마다 이름표 색(내 자리는 초록 테두리로 따로 표시) */
const SEAT_COLOR = ['#ff8fab', '#7cc545', '#4aa6ea', '#f8b84a']

/**
 * 점프 퍼즐 같이 하기: 2~4자리(사람 + 빈 자리는 컴퓨터 동물)가 같은 판에서 번갈아 뛴다.
 * 판은 씨앗으로 만들고, 서버에 쌓인 「수」를 같은 순서로 적용해서 모두의 화면이 같다(규칙은 lib/jumpMulti.ts).
 * 방장이 컴퓨터 자리와 나가 버린 사람의 자리를 대신 둔다. invite: 초대받은 방 번호.
 */
export function JumpMulti({ onClose, invite }: { onClose: () => void; invite?: string }) {
  const [snap, setSnap] = useState<JumpSnap | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [cpuCount, setCpuCount] = useState(1)
  const [sel, setSel] = useState<Pos | null>(null)
  const [invited, setInvited] = useState(false)
  const [hostGone, setHostGone] = useState(false)
  const netRef = useRef<JumpRoom | null>(null)
  const [net, setNet] = useState<JumpRoom | null>(null)
  const names = useRef<Record<string, string>>({})
  const sawMeta = useRef(false)
  const paid = useRef(false)
  const [reward, setReward] = useState(0)
  const mpOn = useSyncExternalStore(subscribeMp, () => getMp().status === 'on')

  // 방에 들어간다(초대받았으면 그 방으로)
  useEffect(() => {
    let alive = true
    // 개발 중에는 화면을 두 번 시작했다 지워서(방이 두 번 만들어지지 않게) 아주 조금 늦춰서 시작한다
    const start = window.setTimeout(() => {
      joinJumpRoom(savedName() || '친구', (s) => { if (alive) setSnap(s) }, invite).then((n) => {
        if (!alive) { n?.leave(); return }
        if (!n) { setErr('지금은 방이 꽉 찼어요. 조금 뒤에 다시 해 봐요'); return }
        netRef.current = n; setNet(n)
      }).catch((e) => { if (alive) setErr(e instanceof Error ? e.message.replace(/^\[[^\]]+\]\s*/, '') || '연결하지 못했어요' : '연결하지 못했어요') })
    }, 30)
    return () => { alive = false; clearTimeout(start); netRef.current?.leave(); netRef.current = null }
  }, [invite])

  const meta = snap?.meta ?? null
  const order = meta?.order ?? []
  const started = !!meta?.started && order.length >= 2
  // 이름을 기억해 둔다(나간 친구 자리도 이름으로 보이게)
  if (snap) for (const [u, p] of Object.entries(snap.players)) names.current[u] = p.name
  useEffect(() => { if (meta) sawMeta.current = true; else if (sawMeta.current && !started) setHostGone(true); else if (sawMeta.current && started) setHostGone(true) }, [meta, started])

  const moves = snap?.moves ?? []
  const state = useMemo(() => {
    if (!started || !meta) return null
    let s = newMState(meta.seed, order.length)
    for (const a of moves) s = applyAction(s, a)
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, meta?.seed, order.length, moves.length])
  const mySeat = net ? order.indexOf(net.uid) : -1
  const over = !!state && isMOver(state)
  const seatName = (i: number) => (order[i] === 'cpu' ? ANIMAL_KO[meta?.cpus[i] ?? 0] : names.current[order[i]] ?? '친구')
  const seatAbsent = (i: number) => order[i] !== 'cpu' && !snap?.players[order[i]]
  const lastJump = useMemo(() => { for (let i = moves.length - 1; i >= 0; i--) if (moves[i].fr !== undefined) return moves[i]; return null }, [moves.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const say = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 1600) }
  // 수가 새로 오면 소리
  const lastLen = useRef(0)
  useEffect(() => { if (moves.length > lastLen.current && lastLen.current > 0) { playHop(); window.setTimeout(playLand, 250) } lastLen.current = moves.length }, [moves.length])

  // 이어 뛰기 중인 내 말은 자동으로 골라 둔다
  useEffect(() => { if (state && !over && state.turn === mySeat && state.chain) setSel(state.chain); else setSel(null) }, [state?.applied, state?.turn, mySeat, over]) // eslint-disable-line react-hooks/exhaustive-deps

  // 방장: 컴퓨터 자리와 나간 친구 자리를 대신 둔다(차례마다 한 수씩, 천천히)
  useEffect(() => {
    if (!net || !net.host || !state || !meta || over) return
    const seat = state.turn
    const cpuSeat = order[seat] === 'cpu' || seatAbsent(seat)
    if (!cpuSeat) return
    const id = window.setTimeout(() => {
      const plan = planCpuTurn(state.board, state.pockets[seat], Math.random, 'normal', state.chain)
      const n = moves.length
      if (state.chain && (plan.length === 0 || Math.random() < 0.45)) net.send(n, { s: seat, e: 1 })
      else if (plan.length > 0) net.send(n, actionOf(seat, plan[0]))
    }, state.chain ? 700 : 1300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, state?.applied, state?.turn, moves.length, over, snap && Object.keys(snap.players).join()])

  // 끝나면 별을 한 번만 받는다
  useEffect(() => {
    if (!over || !state || mySeat < 0 || paid.current) return
    paid.current = true
    const n = rewardFor(state, mySeat)
    earnStars(n); setReward(n)
    if (winnersOf(state).includes(mySeat)) playWin(); else playLose()
  }, [over, state, mySeat])

  const tap = (r: number, c: number) => {
    if (!state || over || !net || state.turn !== mySeat) return
    const v = state.board[r][c]
    if (v !== 0) {
      if (state.chain && (state.chain.r !== r || state.chain.c !== c)) return
      setSel(sel && sel.r === r && sel.c === c ? null : { r, c }); playTap()
      return
    }
    if (!sel) return
    const m = findMove(state.board, sel, { r, c })
    if (!m) { say('그곳으로는 뛸 수 없어요'); return }
    net.send(moves.length, actionOf(mySeat, m)); setSel(null)
  }
  const endTurn = () => { if (net && state && state.turn === mySeat && state.chain) { net.send(moves.length, { s: mySeat, e: 1 } as Action); setSel(null) } }
  const leave = () => { netRef.current?.leave(); netRef.current = null; onClose() }

  const humans = snap ? Object.keys(snap.players).length : 0
  const maxCpu = Math.max(0, JUMP_MAX - humans)
  const cpuPick = Math.min(cpuCount, maxCpu)
  const canStart = humans + cpuPick >= 2

  const shell = 'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#faf9f2] text-[#213f35] ring-1 ring-black/5'
  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-[#e2e7dc] px-4 py-2">
      <h2 className="m-0 text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]">🎯 점프 퍼즐 · 같이 하기</h2>
      <button onClick={leave} aria-label="나가기" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">✕</button>
    </div>
  )

  if (err) return <div className={shell}>{header}<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"><p role="alert" className="m-0 text-sm font-bold text-[#c04a5a]">{err}</p><button onClick={leave} className="min-h-11 rounded-full bg-[#246f55] px-6 text-sm font-bold text-white">돌아가기</button></div></div>
  if (hostGone) return <div className={shell}>{header}<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"><p role="status" className="m-0 text-sm font-bold text-[#6b4b52]">방장이 나가서 판이 끝났어요</p><button onClick={leave} className="min-h-11 rounded-full bg-[#246f55] px-6 text-sm font-bold text-white">돌아가기</button></div></div>
  if (!snap || !net || !meta) return <div className={shell}>{header}<div className="flex flex-1 items-center justify-center"><p className="m-0 text-sm font-bold text-[#678071]">방을 찾는 중…</p></div></div>

  // ── 대기실 ──
  if (!started || !state) {
    const uids = Object.keys(snap.players)
    return (
      <div className={shell}>
        {header}
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-3">
          <div role="dialog" aria-label="같이 하기 대기실" className="my-auto flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-xl">
            <p className="m-0 text-xs font-bold text-[#6b4b52]">친구들이 모이면 방장이 시작해요 · {uids.length}/{JUMP_MAX}명</p>
            <ul className="m-0 flex w-full list-none flex-col gap-1.5 p-0">
              {uids.map((u, i) => (
                <li key={u} className="flex items-center gap-2 rounded-2xl bg-[#f1f6ec] px-3 py-1.5 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: SEAT_COLOR[i % 4] }}>{(snap.players[u].name || '?').slice(0, 1)}</span>
                  <b className="flex-1 truncate text-sm">{snap.players[u].name}{u === net.uid ? ' (나)' : ''}</b>
                  {u === meta.host && <span className="text-[11px] font-black text-[#246f55]">방장</span>}
                </li>
              ))}
            </ul>
            {net.host ? (
              <>
                <div role="radiogroup" aria-label="컴퓨터 동물" className="flex w-full items-center gap-1.5">
                  <span className="shrink-0 text-xs font-black text-[#246f55]">🐾 컴퓨터</span>
                  {[0, 1, 2].map((n) => (
                    <button key={n} role="radio" aria-checked={cpuPick === n} disabled={n > maxCpu} onClick={() => { playTap(); setCpuCount(n) }} className={`h-8 flex-1 rounded-full border-2 text-xs font-black disabled:opacity-30 ${cpuPick === n ? 'border-[#7cc545] bg-[#f1f6ec] text-[#246f55]' : 'border-transparent bg-[#eef3e6] text-[#678071]'}`}>{n === 0 ? '없음' : `${n}마리`}</button>
                  ))}
                </div>
                <button disabled={!canStart} onClick={() => { playTap(); net.start(cpuPick) }} className="min-h-12 w-full rounded-full bg-[#246f55] text-lg font-black text-white shadow-lg disabled:opacity-40 active:scale-95">{canStart ? '시작!' : '친구나 컴퓨터가 더 필요해요'}</button>
              </>
            ) : <p className="m-0 text-sm font-black text-[#246f55]">방장이 시작하길 기다려요…</p>}
            {mpOn
              ? <button onClick={() => { playTap(); sayJump(net.room); setInvited(true); window.setTimeout(() => setInvited(false), 3000) }} className="min-h-11 w-full rounded-full bg-[#fff0f5] text-sm font-black text-[#c0587a] ring-2 ring-[#ffc2d4] active:scale-95">{invited ? '💌 초대를 보냈어요!' : '💌 친구 초대하기'}</button>
              : <p className="m-0 text-[11px] font-bold text-[#6b4b52]">친구를 초대하려면 맨 위 <b>친구</b> 탭에서 같이 놀기에 먼저 들어가요</p>}
            <button onClick={leave} className="min-h-11 w-full rounded-full bg-[#f3e6ea] text-sm font-bold text-[#6b4b52] active:scale-95">나가기</button>
          </div>
        </div>
      </div>
    )
  }

  // ── 판 ──
  const myTurn = !over && state.turn === mySeat
  const win = over ? winnersOf(state) : []
  const turnName = seatName(state.turn)
  return (
    <div className={shell}>
      {header}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2 overflow-hidden px-3 py-2 landscape:grid landscape:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] landscape:grid-rows-[minmax(0,1fr)] landscape:items-center">
        <div className="flex w-full flex-col items-center gap-2 landscape:col-start-2 landscape:row-start-1">
          <div className="flex w-full max-w-[44rem] flex-col gap-1.5 rounded-2xl bg-white px-3 py-2 shadow-sm landscape:max-w-none">
            {Array.from({ length: state.seats }, (_, i) => {
              const cpu = order[i] === 'cpu'
              return (
                <div key={i} className={`flex items-center justify-between gap-2 rounded-xl px-1 ${state.turn === i && !over ? 'bg-[#f1f6ec] font-extrabold' : ''} ${i === mySeat ? 'ring-2 ring-[#7cc545]' : ''}`}>
                  <span className="flex w-[5.2rem] shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold text-[#678071]">
                    {cpu ? <img src={assetUrl(`assets/jump/${ANIMALS[meta.cpus[i] ?? 0]}.webp`)} alt="" draggable={false} className="h-6 w-6 object-contain" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: SEAT_COLOR[i % 4] }}>{seatName(i).slice(0, 1)}</span>}
                    <span className="truncate">{i === mySeat ? '나' : seatName(i)}{seatAbsent(i) ? ' 💤' : ''}</span>
                  </span>
                  <div className="flex flex-1 gap-1" aria-label={`${seatName(i)} 주머니`}>
                    {Array.from({ length: COLORS }, (_, k) => (
                      <span key={k} className="flex items-center gap-0.5 rounded-full px-1 py-0.5 text-xs font-bold text-white" style={{ background: FILL[k] }}><span aria-hidden>{MARK[k]}</span>{state.pockets[i][k]}</span>
                    ))}
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-right text-base font-bold text-[#246f55]">{setsOf(state.pockets[i])} 세트</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center landscape:col-start-1 landscape:row-start-1 landscape:h-full" style={{ containerType: 'size' }}>
          <div role="grid" aria-label="점프 퍼즐 판" className={`relative grid aspect-square gap-[3px] rounded-2xl bg-[#d9e3cf] p-1.5 transition-shadow ${myTurn ? 'shadow-[0_0_0_4px_#7cc545,0_0_22px_6px_rgba(124,197,69,.5)]' : ''}`} style={{ width: 'min(100cqw, 100cqh)', gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
            {state.board.flatMap((row, r) => row.map((v, c) => {
              const picked = sel && sel.r === r && sel.c === c
              const landed = lastJump && lastJump.tr === r && lastJump.tc === c
              const from = lastJump && lastJump.fr === r && lastJump.fc === c
              return (
                <button key={`${r}-${c}`} role="gridcell" aria-label={v ? `${r + 1}-${c + 1} ${MARK[v - 1]}` : `${r + 1}-${c + 1}`} onClick={() => tap(r, c)}
                  className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border-0 p-[8%] ${v === 0 ? (from ? 'bg-[#e3efc9]' : 'bg-[#eef3e6]') : 'bg-[#f6f9f0]'}`}>
                  {v !== 0 && (
                    <span className={`flex h-full w-full items-center justify-center rounded-full text-[min(3.2vw,1.1rem)] font-black text-white/80 shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] transition ${picked ? 'scale-110 ring-4 ring-[#213f35]' : ''} ${landed && !picked ? 'ring-4 ring-[#ffd84a]' : ''}`} style={{ background: FILL[v - 1], border: `2px solid ${DARK[v - 1]}` }}>{MARK[v - 1]}</span>
                  )}
                </button>
              )
            }))}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-2 landscape:col-start-2 landscape:row-start-2 landscape:self-start">
          <p className={`m-0 min-h-5 text-center text-sm font-bold text-[#246f55] ${!msg ? 'sr-only' : ''}`} role="status" aria-live="polite">{msg || (myTurn ? '내 차례예요' : `${turnName} 차례예요`)}</p>
          {!over && <p aria-hidden className={`m-0 rounded-full px-4 py-1 text-center text-sm font-extrabold ${myTurn ? 'bg-white text-[#246f55] shadow-[0_0_0_2px_#7cc545,0_0_12px_3px_rgba(124,197,69,.5)]' : 'bg-[#eef0e8] text-[#678071]'}`}>{myTurn ? '🟢 내 차례예요!' : `⏳ ${turnName} 차례예요`}</p>}
          <button onClick={endTurn} disabled={!myTurn || !state.chain} className="min-h-9 rounded-full border border-[#dce4d7] bg-white px-4 text-xs font-bold disabled:opacity-40">✋ 끝내기</button>
        </div>
      </div>

      {over && (
        <div role="dialog" aria-label="판이 끝났어요" className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-6">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="m-0 text-lg font-extrabold">{win.includes(mySeat) ? '🏆 1등이에요!' : `${win.map(seatName).join('·')}가 1등이에요`}</p>
            <p className="m-0 text-2xl font-extrabold text-[#246f55]">{state.pockets.map((p) => setsOf(p)).join(' : ')}</p>
            {reward > 0 && <p className="m-0 rounded-3xl bg-gradient-to-b from-[#fff3c4] to-[#ffd96b] px-6 py-3 text-3xl font-black text-[#b8610a]">⭐ +{reward}</p>}
            <button onClick={leave} className="min-h-11 rounded-full bg-[#246f55] px-6 text-sm font-bold text-white">나가기</button>
          </div>
        </div>
      )}
    </div>
  )
}
