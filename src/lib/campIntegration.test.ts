import { expect, it } from 'vitest'
import { CAMP_ASSETS, sceneAssets } from './exportRoom'
import { addItem, defaultCamp, defaultRoom, ROOM_ITEM_BY_ID, sanitizeRoom } from './room'
it('keeps camping backgrounds and mixed room/camping props through a saved room reload',()=>{
  const room=addItem({...defaultRoom(),wallId:'camp',floorId:'camp'},ROOM_ITEM_BY_ID.camp_tent,'mixed-tent')!
  const reloaded=sanitizeRoom(JSON.parse(JSON.stringify(room)))
  expect(reloaded.wallId).toBe('camp');expect(reloaded.floorId).toBe('camp')
  expect(reloaded.items.some(i=>i.itemId==='camp_tent')).toBe(true)
  expect(reloaded.items.some(i=>i.itemId==='furniture_sofa_bear')).toBe(true)
  expect(sceneAssets('room',false,reloaded.wallId,reloaded.floorId)).toEqual({wall:CAMP_ASSETS.day,floor:CAMP_ASSETS.floor,floorH:500})
  expect(sceneAssets('room',true,'camp','camp').wall).toBe(CAMP_ASSETS.night)
})
it('imports an old campsite into My room without losing its placements',()=>{
  const old=defaultCamp()
  const merged=sanitizeRoom({...old,wallId:'camp',floorId:'camp'})
  expect(merged.items).toEqual(old.items)
  expect(merged.avatar).toEqual(old.avatar)
  expect(sceneAssets('camp',true)).toEqual(sceneAssets('room',true,'camp','camp'))
})
