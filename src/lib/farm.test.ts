import { afterEach, describe, expect, it, vi } from 'vitest'
import { CROPS, defaultFarm, growth, orderCrop, plotPrice, reduceFarm, sanitizeFarm } from './farm'
afterEach(()=>vi.unstubAllGlobals())
describe('farming lifecycle',()=>{
  it('requires water once, grows offline and allows exactly one harvest',()=>{
    let state=defaultFarm()
    state=reduceFarm(state,{type:'plant',plot:0,crop:'carrot'},1000)
    expect(growth(state.plots[0],999999)).toBe(0)
    expect(reduceFarm(state,{type:'harvest',plot:0},999999)).toBe(state)
    state=reduceFarm(state,{type:'water',plot:0},2000)
    expect(reduceFarm(state,{type:'water',plot:0},4000)).toBe(state)
    expect(growth(state.plots[0],32000)).toBe(.5)
    expect(reduceFarm(state,{type:'harvest',plot:0},61000)).toBe(state)
    state=sanitizeFarm(JSON.parse(JSON.stringify(state)))
    expect(growth(state.plots[0],62000)).toBe(1)
    state=reduceFarm(state,{type:'harvest',plot:0},62000)
    expect(state.inventory.carrot).toBe(1);expect(state.plots[0]).toBeNull()
    expect(reduceFarm(state,{type:'harvest',plot:0},62000)).toBe(state)
  })
  it('fulfills the current order once and charges decorations only once',()=>{
    let state=defaultFarm();state.inventory.carrot=2
    state=reduceFarm(state,{type:'deliver'},0)
    expect(state.inventory.carrot).toBe(0);expect(state.coins).toBe(12)
    expect(orderCrop(state).id).toBe('strawberry')
    expect(reduceFarm(state,{type:'deliver'},0)).toBe(state)
    expect(reduceFarm(state,{type:'decorate',id:'fence'},0)).toBe(state)
    state.inventory.strawberry=2;state=reduceFarm(state,{type:'deliver'},0)
    state=reduceFarm(state,{type:'decorate',id:'fence'},0)
    expect(state.coins).toBe(4);expect(state.decorations).toEqual(['fence'])
    expect(reduceFarm(state,{type:'decorate',id:'fence'},0)).toBe(state)
  })
  it('handles each crop, future clocks, occupied plots and invalid indices',()=>{
    for(const crop of CROPS){
      let state=reduceFarm(defaultFarm(),{type:'plant',plot:1,crop:crop.id},0)
      expect(reduceFarm(state,{type:'plant',plot:1,crop:crop.id},0)).toBe(state)
      state=reduceFarm(state,{type:'water',plot:1},1000)
      expect(growth(state.plots[1],0)).toBe(0)
      expect(growth(state.plots[1],1000+crop.seconds*1000)).toBe(1)
    }
    const state=defaultFarm()
    for(const plot of [-1,9,1.5])expect(reduceFarm(state,{type:'plant',plot,crop:'carrot'},0)).toBe(state)
    expect(reduceFarm(state,{type:'sell',crop:'carrot'},0)).toBe(state)
  })
  it('sanitizes malformed and old save data',()=>{
    expect(sanitizeFarm(null)).toEqual(defaultFarm())
    const state=sanitizeFarm({plots:[{crop:'bad'},null,{crop:'carrot',wateredAt:-1}],inventory:{carrot:-5,tomato:3.5,corn:1},coins:Infinity,decorations:['fence','fence','invalid']})
    expect(state.plots).toHaveLength(27);expect(state.plots[0]).toBeNull()
    expect(state.plots[2]?.wateredAt).toBeNull();expect(state.inventory.corn).toBe(4);expect(state.inventory.carrot).toBe(0)
    expect(state.coins).toBe(0);expect(state.decorations).toEqual(['fence'])
  })
})
it('persists atomically, blocks restoration writes and keeps farm on storage failure',async()=>{
  const values=new Map<string,string>()
  const write=vi.fn((key:string,value:string)=>{values.set(key,value)})
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:write})
  vi.resetModules();const store=await import('./farm')
  expect(store.actFarm({type:'plant',plot:0,crop:'carrot'},100)).toBe('saved')
  expect(store.actFarm({type:'water',plot:0},200)).toBe('saved')
  write.mockImplementation(()=>{throw Error('quota')})
  expect(store.actFarm({type:'harvest',plot:0},60200)).toBe('failed')
  expect(store.getFarm().plots[0]?.crop).toBe('carrot');expect(store.getFarm().inventory.carrot).toBe(0)
  vi.resetModules();const reload=await import('./farm')
  expect(reload.getFarm().plots[0]?.wateredAt).toBe(200)
  const guard=await import('./restoreGuard');guard.beginRestore()
  expect(reload.actFarm({type:'plant',plot:1,crop:'corn'})).toBe('failed')
  guard.endRestore()
})
it('예전 6칸·토마토 저장은 9칸·옥수수로 이어진다',()=>{
  const old=sanitizeFarm({plots:[{crop:'tomato',wateredAt:5},{crop:'carrot',wateredAt:null},null,null,null,{crop:'strawberry',wateredAt:7}],inventory:{carrot:2,tomato:3,strawberry:1},coins:40,deliveries:2})
  expect(old.plots).toHaveLength(27)
  expect(old.plots[0]).toEqual({crop:'corn',wateredAt:5});expect(old.plots[5]?.crop).toBe('strawberry');expect(old.plots[8]).toBeNull()
  expect(old.inventory).toEqual({carrot:2,strawberry:1,corn:3});expect(old.coins).toBe(40);expect(old.deliveries).toBe(2)
})

describe('새 땅 밭 사기', () => {
  it('가운데 9칸은 처음부터 내 것이고 새 땅은 코인으로 한 칸씩 산다 (값이 점점 오른다)', () => {
    let state = { ...defaultFarm(), coins: 100 }
    expect(state.owned.slice(0, 9).every(Boolean)).toBe(true)
    expect(state.owned.slice(9).some(Boolean)).toBe(false)
    expect(plotPrice(state)).toBe(20)
    expect(reduceFarm(state, { type: 'plant', plot: 9, crop: 'carrot' }, 0)).toBe(state) // 안 산 밭에는 못 심는다
    state = reduceFarm(state, { type: 'buy', plot: 9 }, 0)
    expect(state.coins).toBe(80); expect(state.owned[9]).toBe(true); expect(plotPrice(state)).toBe(25)
    expect(reduceFarm(state, { type: 'buy', plot: 9 }, 0)).toBe(state) // 이미 산 밭
    expect(reduceFarm(state, { type: 'buy', plot: 3 }, 0)).toBe(state) // 가운데 땅은 살 필요 없다
    state = reduceFarm(state, { type: 'buy', plot: 20 }, 0)
    expect(state.coins).toBe(55); expect(plotPrice(state)).toBe(30)
    state = reduceFarm(state, { type: 'plant', plot: 20, crop: 'corn' }, 0)
    expect(state.plots[20]?.crop).toBe('corn')
  })
  it('코인이 모자라거나 범위 밖이면 살 수 없다', () => {
    const state = { ...defaultFarm(), coins: 19 }
    expect(reduceFarm(state, { type: 'buy', plot: 9 }, 0)).toBe(state)
    expect(reduceFarm({ ...state, coins: 99 }, { type: 'buy', plot: 27 }, 0)).toEqual({ ...state, coins: 99 })
  })
  it('예전 저장(9칸)은 가운데 땅 그대로 이어지고 산 땅은 저장에서 읽는다', () => {
    const old = sanitizeFarm({ plots: [{ crop: 'carrot', wateredAt: null }], coins: 7 })
    expect(old.owned.filter(Boolean)).toHaveLength(9)
    const saved = sanitizeFarm({ plots: [], owned: Array(27).fill(true), coins: 1 })
    expect(saved.owned.every(Boolean)).toBe(true)
    expect(sanitizeFarm({ owned: 'x' }).owned.filter(Boolean)).toHaveLength(9)
  })
})
