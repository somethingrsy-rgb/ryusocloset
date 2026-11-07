import * as THREE from 'three'
import { assetUrl } from '../lib/items'

/**
 * 여덟 방향에서 본 그림으로 만든 입체 물건(건물·노점). 판 하나에 지금 보는 방향(45도씩 8칸, 0 = 앞 +z,
 * 시계 반대로 1 = 앞오른쪽 …)에 맞는 그림만 끼워 보여 준다. 판이 하나라 그림끼리 겹쳐 지지직거리지 않는다.
 * views[k] = [그림 주소, 가로÷세로, 좌우 뒤집기]
 */
export function viewSprite(k: { keep: <T extends { dispose: () => void }>(x: T) => T; texOf: (src: string) => THREE.Texture }, views: [string, number, boolean][], h: number, shadow: [number, number], /** 판을 카메라 쪽으로 내미는 거리(물건 앞 끝까지). 가운데에 두면 떠 보인다 */ front = 0) {
  const tex = new Map<string, THREE.Texture>()
  for (const [img] of views) if (!tex.has(img)) tex.set(img, k.texOf(assetUrl(img))) // 미리 받아 둔다
  const mat = k.keep(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }))
  const plane = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)), mat)
  const root = new THREE.Group()
  const sh = new THREE.Mesh(k.keep(new THREE.CircleGeometry(1, 32)), k.keep(new THREE.MeshBasicMaterial({ color: 0x3c5a2a, transparent: true, opacity: 0.22, depthWrite: false })))
  sh.rotation.x = -Math.PI / 2
  sh.position.y = 0.02
  sh.scale.set(shadow[0], shadow[1], 1)
  root.add(sh, plane)
  let cur = -1
  const show = (i: number) => {
    cur = i
    const [img, aspect, flip] = views[i]
    mat.map = tex.get(img)!
    mat.needsUpdate = true
    plane.scale.set(h * aspect * (flip ? -1 : 1), h, 1)
  }
  show(0)
  const sector = Math.PI / 4
  /** 매 프레임: 카메라 쪽으로 판을 돌리고 방향에 맞는 그림으로(경계에서 왔다 갔다 하지 않게 여유를 둔다) */
  const update = (camera: THREE.Camera) => {
    const a = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z)
    plane.rotation.y = a
    plane.position.set(Math.sin(a) * front, 0, Math.cos(a) * front)
    const off = (i: number) => Math.abs(Math.atan2(Math.sin(a - i * sector), Math.cos(a - i * sector)))
    if (off(cur) > sector / 2 + 0.08) show(((Math.round(a / sector) % 8) + 8) % 8)
  }
  return { root, update }
}
