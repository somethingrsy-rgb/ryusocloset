import { afterEach, describe, expect, it, vi } from 'vitest'
import { CATCH_Y, newRain, readRainRecord, RAIN_DURATION, stepRain, type RainState } from './starRain'
afterEach(()=>vi.unstubAllGlobals())
describe('star rain walk',()=>{
  it('awards each star exactly once and gives large stars five points',()=>{
    const state={...newRain(),nextSpawn:99,drops:[{id:1,kind:'star' as const,x:50,y:CATCH_Y-1,speed:30},{id:2,kind:'gold' as const,x:50,y:CATCH_Y-1,speed:30}]}
    const caught=stepRain(state,.1)
    expect(caught.score).toBe(6);expect(caught.caught).toBe(2);expect(caught.drops).toHaveLength(0)
    expect(caught.bursts.map(b => b.points)).toEqual([1,5])
    let faded=caught
    for(let i=0;i<8;i++)faded=stepRain(faded,.1)
    expect(faded.bursts).toHaveLength(0)
    expect(stepRain(caught,.1).score).toBe(6)
    expect(state.score).toBe(0)
  })
  it('does not penalize missed stars or let them be caught after passing the basket',()=>{
    let state: RainState={...newRain(),nextSpawn:99,drops:[{id:1,kind:'star' as const,x:80,y:CATCH_Y-1,speed:30}]}
    state=stepRain(state,.1)
    expect(state.score).toBe(0)
    state={...state,playerX:80,targetX:80};state=stepRain(state,.1)
    expect(state.score).toBe(0)
    for(let i=0;i<20;i++)state=stepRain(state,.1)
    expect(state.drops).toHaveLength(0)
  })
  it('clouds slow movement temporarily without removing score',()=>{
    const state={...newRain(),score:8,nextSpawn:99,drops:[{id:1,kind:'cloud' as const,x:50,y:CATCH_Y-1,speed:30}]}
    const hit=stepRain(state,.1)
    expect(hit.score).toBe(8);expect(hit.clouds).toBe(1)
    const slow=stepRain({...hit,targetX:90},.1)
    expect(slow.playerX).toBeCloseTo(53.2)
    const normal=stepRain({...hit,elapsed:hit.slowUntil+1,targetX:90},.1)
    expect(normal.playerX).toBeCloseTo(56.8)
  })
  it('limits movement, frame gaps, spawning and round duration',()=>{
    expect(stepRain({...newRain(),targetX:-100},.1).targetX).toBe(10)
    expect(stepRain({...newRain(),targetX:200},.1).targetX).toBe(90)
    expect(stepRain(newRain(),20).elapsed).toBe(.1)
    let state=newRain()
    for(let i=0;i<650;i++)state=stepRain(state,.1,()=>.5)
    expect(state.elapsed).toBe(RAIN_DURATION)
    expect(state.serial).toBeGreaterThan(50)
    expect(state.drops.length).toBeLessThan(8)
    expect(stepRain(state,.1)).toBe(state)
    expect(stepRain(state,0)).toBe(state)
  })
  it('loads records defensively without changing other game saves',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({best:7.8,total:-1,rounds:'bad'})})
    expect(readRainRecord()).toEqual({best:7,total:0,rounds:0})
    vi.stubGlobal('localStorage',{getItem:()=>'{invalid'})
    expect(readRainRecord()).toEqual({best:0,total:0,rounds:0})
  })
})
