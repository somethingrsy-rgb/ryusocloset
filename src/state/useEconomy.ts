import { create } from 'zustand'
import { attend, buy, buySet, initialEconomy, mission, rewardOutfit, validateEconomy, type EconomyState } from '../lib/economyCore'
import { ROOM_CATALOG } from '../lib/room'
import { loadRoom } from '../lib/storage'
export const ECONOMY_KEY = 'ryuso.economy.v1'
const load=()=>{try{const raw=localStorage.getItem(ECONOMY_KEY);if(raw)return validateEconomy(JSON.parse(raw),ROOM_CATALOG)}catch{}return initialEconomy(loadRoom().items.map(p=>p.itemId))}
interface Store { data: EconomyState; error: string | null; transact: (f: (s: EconomyState)=>EconomyState)=>boolean; attendance:()=>boolean; saveReward:(key:string)=>boolean; dailyMission:()=>boolean; purchase:(id:string)=>boolean; purchaseSet:(id:string)=>boolean; restore:(s:unknown)=>boolean }
export const useEconomy=create<Store>((set,get)=>({
  data:load(),error:null,
  transact:f=>{try{ // Persist before publishing, so quota errors never spend points.
    const disk=localStorage.getItem(ECONOMY_KEY)
    let current=get().data
    if(disk){try{current=validateEconomy(JSON.parse(disk),ROOM_CATALOG)}catch{ /* Replace malformed persistence with the valid in-memory fallback. */ }}
    const next=f(current);localStorage.setItem(ECONOMY_KEY,JSON.stringify(next));set({data:next,error:null});return true
  }catch(e){set({error:e instanceof Error?e.message:'SAVE_FAILED'});return false}},
  attendance:()=>get().transact(s=>attend(s)),saveReward:key=>get().transact(s=>rewardOutfit(s,key)),dailyMission:()=>get().transact(s=>mission(s)),
  purchase:id=>get().transact(s=>buy(s,ROOM_CATALOG,id)),purchaseSet:id=>get().transact(s=>buySet(s,ROOM_CATALOG,id)),restore:raw=>get().transact(()=>validateEconomy(raw,ROOM_CATALOG)),
}))
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===ECONOMY_KEY && e.newValue){try{useEconomy.setState({data:validateEconomy(JSON.parse(e.newValue),ROOM_CATALOG)})}catch{}}})
