import { afterEach, expect, it, vi } from 'vitest'
vi.mock('virtual:pwa-register',()=>({registerSW:vi.fn()}))
afterEach(()=>vi.unstubAllGlobals())
async function setup({offline=false,waiting=false,fail=false}={}) {
  const reload=vi.fn()
  const container=new EventTarget()
  const worker={postMessage:vi.fn(()=>queueMicrotask(()=>container.dispatchEvent(new Event('controllerchange'))))}
  const registration={update:vi.fn(async()=>{if(fail)throw Error('network')}),waiting:waiting?worker:null,installing:null}
  Object.assign(container,{getRegistration:vi.fn(async()=>registration)})
  vi.stubGlobal('navigator',{onLine:!offline,serviceWorker:container})
  vi.stubGlobal('window',{location:{reload}})
  vi.resetModules()
  return {refresh:(await import('./appUpdate')).refreshApp,reload,worker,registration}
}
it('checks the service worker and reloads when already current',async()=>{
  const {refresh,reload,registration}=await setup()
  await refresh();expect(registration.update).toHaveBeenCalledOnce();expect(reload).toHaveBeenCalledOnce()
})
it('activates a waiting update before reloading',async()=>{
  const {refresh,reload,worker}=await setup({waiting:true})
  await refresh();expect(worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(reload).toHaveBeenCalledOnce()
})
it('keeps the open game when offline or the update check fails',async()=>{
  for(const options of [{offline:true},{fail:true}]) {
    const {refresh,reload}=await setup(options)
    await expect(refresh()).rejects.toThrow();expect(reload).not.toHaveBeenCalled()
  }
})
it('reloads normally in browsers without a service worker',async()=>{
  const {refresh,reload}=await setup()
  vi.stubGlobal('navigator',{onLine:true})
  await refresh();expect(reload).toHaveBeenCalledOnce()
})
it('waits for the downloaded update to install',async()=>{
  const {refresh,reload,registration,worker}=await setup()
  const installing=Object.assign(new EventTarget(),{state:'installing'})
  Object.assign(registration,{installing})
  const done=refresh()
  await new Promise(resolve=>setTimeout(resolve,0))
  expect(reload).not.toHaveBeenCalled()
  installing.state='installed';Object.assign(registration,{waiting:worker});installing.dispatchEvent(new Event('statechange'))
  await done;expect(reload).toHaveBeenCalledOnce()
})
