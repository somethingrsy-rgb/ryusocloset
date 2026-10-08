import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultRoom,placeInSlot,ROOM_CATALOG,drawables,sanitizeRoom} from '../src/lib/room.ts'
const def=(id:string)=>ROOM_CATALOG.find(i=>i.id===id)!
test('미보유 아이템 배치 차단; 같은 슬롯 중복 제거',()=>{let r=defaultRoom();assert.throws(()=>placeInSlot(r,def('furniture_bed'),[]),/NOT_OWNED/);r=placeInSlot(r,def('furniture_bed'),['furniture_bed']);r=placeInSlot(r,def('furniture_desk_chair'),['furniture_desk_chair']);assert.equal(r.items.filter(p=>p.itemId==='furniture_bed').length,0);assert.equal(r.items.filter(p=>p.itemId==='furniture_desk_chair').length,1);assert.equal(r.layoutMode,'slots')})
test('벽지·바닥 독립 슬롯 변경과 저장 복원',()=>{let r=placeInSlot(defaultRoom(),def('wallpaper_pink'),['wallpaper_pink']);r=placeInSlot(r,def('floor_vintage'),['floor_vintage']);assert.equal(r.items.length,3);const n=sanitizeRoom(JSON.parse(JSON.stringify(r)));assert.equal(n.wallpaperId,'wallpaper_pink');assert.equal(n.floorId,'floor_vintage')})
test('MVP 레이어: 벽 소품 < 가구 < 아바타 < 앞 소품 < 조명',()=>{let r=defaultRoom();r=placeInSlot(r,def('light_sparkle'),['light_sparkle']);assert.deepEqual(drawables(r).map(d=>d.group),['wall','furniture','avatar','rug','light'])})
