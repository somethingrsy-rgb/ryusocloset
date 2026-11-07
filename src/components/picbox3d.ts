import * as THREE from 'three'
import { assetUrl } from '../lib/items'

/**
 * 그림 네 장(앞·뒤·왼쪽·오른쪽)으로 만든 입체 건물. 그림은 돌지 않고 각자 바깥을 보며,
 * 안쪽에는 작은 상자를 채워서 그림의 빈 틈으로 속이 비쳐 보이지 않게 한다.
 * 원점은 발 가운데, 앞은 +z. 쓰는 쪽에서 위치를 정해 scene 에 넣는다.
 */
export interface PicFace { img: string; h: number; aspect: number; x: number; z: number; /** 바라보는 쪽: 0 앞(+z), π 뒤, -π/2 왼쪽(-x), π/2 오른쪽(+x) */ yaw: number }
export function pictureBox(k: { keep: <T extends { dispose: () => void }>(x: T) => T; texOf: (src: string) => THREE.Texture }, faces: PicFace[], core: { w: number; h: number; d: number; z: number; color: number }) {
  const g = new THREE.Group()
  for (const f of faces) {
    const m = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(f.h * f.aspect, f.h).translate(0, f.h / 2, 0)), k.keep(new THREE.MeshBasicMaterial({ map: k.texOf(assetUrl(f.img)), transparent: true, alphaTest: 0.35, side: THREE.FrontSide })))
    m.position.set(f.x, 0, f.z)
    m.rotation.y = f.yaw
    g.add(m)
  }
  const inner = new THREE.Mesh(k.keep(new THREE.BoxGeometry(core.w, core.h, core.d)), k.keep(new THREE.MeshLambertMaterial({ color: core.color, emissive: core.color, emissiveIntensity: 0.3 })))
  inner.position.set(0, core.h / 2, core.z)
  inner.castShadow = true
  g.add(inner)
  const shadow = new THREE.Mesh(k.keep(new THREE.CircleGeometry(1, 24)), k.keep(new THREE.MeshBasicMaterial({ color: 0x3c5a2a, transparent: true, opacity: 0.22, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(core.w * 0.75, core.d * 0.8, 1)
  shadow.position.set(0, 0.02, core.z)
  g.add(shadow)
  return g
}
