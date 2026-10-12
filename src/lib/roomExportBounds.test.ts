import { expect, it } from 'vitest'
import { roomExportBounds } from './roomExportBounds'
it('includes the visible sides and top/bottom of the editor',()=>{
 const result=roomExportBounds([],{left:-400,top:-100,width:1886,height:1648})
 expect(result).toEqual({left:-400,top:-100,width:1886,height:1648,scale:1})
})
it('does not clip oversized furniture or avatars extending past the room',()=>{
 const result=roomExportBounds([{left:-150,top:-300,w:1600,h:2100}])
 expect(result.left).toBe(-150);expect(result.top).toBe(-300)
 expect(result.width).toBe(1600);expect(result.height).toBe(2100)
})
it('keeps the complete composition while limiting mobile canvas size',()=>{
 const result=roomExportBounds([{left:-2000,top:-1000,w:8000,h:9000}])
 expect(result.width).toBe(8000);expect(result.height).toBe(9000)
 expect(result.width*result.scale).toBeLessThanOrEqual(4096)
 expect(result.height*result.scale).toBeLessThanOrEqual(4096)
 expect(result.width*result.height*result.scale**2).toBeLessThanOrEqual(12000001)
})
