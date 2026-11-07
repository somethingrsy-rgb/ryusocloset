import * as THREE from 'three'
import { assetUrl } from '../lib/items'

/**
 * 3D 건물·꽃 덤불(산책·달리기·농장·카페가 같이 쓴다).
 * 건물: 받은 그림을 앞(+z)을 보게 세워 고정하고(카메라 따라 돌지 않는다), 그 뒤에 입체 몸통(벽 + 네모뿔 지붕)을 붙여
 * 옆·뒤에서 봐도 건물로 보이게 한다. 몸통·지붕은 그림 안쪽에 숨는 크기라 앞에서는 그림 그대로 보인다.
 * 꽃 덤불: 그림 대신 초록 공 여러 개 + 분홍·노랑 꽃송이로 만든 진짜 입체(어느 쪽에서 봐도 덤불).
 */
export interface BuildingArt { img: string; aspect: number; /** 벽 색 */ wall: number; /** 지붕 색 */ roof: number }
export const BUILDINGS = {
  cafe: { img: 'cafe/3d/counter.webp', aspect: 997 / 1024, wall: 0xfff1e2, roof: 0xf4a3b8 },
  barn: { img: 'farm/3d/barn.webp', aspect: 1041 / 1085, wall: 0xd84a3c, roof: 0xe2574c },
  farmhouse: { img: 'farm/3d/house.webp', aspect: 1018 / 1188, wall: 0xfbe9d0, roof: 0xe86a4f },
  potion: { img: 'travel/3d/house_potion.webp', aspect: 1021 / 1206, wall: 0xf3e2c4, roof: 0x9b59d0 },
  palace: { img: 'travel/3d/house_palace.webp', aspect: 1026 / 1166, wall: 0xf6ead6, roof: 0x8f8fe0 },
  castle: { img: 'travel/3d/house_castle.webp', aspect: 1043 / 1249, wall: 0xf3e2c4, roof: 0xf08cb0 },
  ginger: { img: 'travel/3d/house_ginger.webp', aspect: 1038 / 1146, wall: 0xc98a4b, roof: 0x9fd4b4 },
} satisfies Record<string, BuildingArt>

type Kit = { keep: <T extends { dispose: () => void }>(x: T) => T; texOf: (src: string) => THREE.Texture }

/** 건물 하나(발 가운데가 원점, 앞이 +z). 쓰는 쪽에서 position·rotation.y 를 정해 scene 에 넣는다 */
export function makeBuilding(k: Kit, art: BuildingArt, h: number) {
  const g = new THREE.Group()
  const W = h * art.aspect
  const face = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(W, h).translate(0, h / 2, 0)), k.keep(new THREE.MeshBasicMaterial({ map: k.texOf(assetUrl(art.img)), transparent: true, alphaTest: 0.35, side: THREE.FrontSide })))
  const mat = (c: number) => k.keep(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.22 }))
  const bw = W * 0.78, bh = h * 0.43, bd = W * 0.5
  const body = new THREE.Mesh(k.keep(new THREE.BoxGeometry(bw, bh, bd)), mat(art.wall))
  body.position.set(0, bh / 2, -bd / 2 - 0.06)
  // 네모뿔 지붕: 가운데 꼭대기만 높아서 그림 위로 삐져나오지 않는다
  const roofGeo = k.keep(new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4))
  const roof = new THREE.Mesh(roofGeo, mat(art.roof))
  roof.scale.set((bw / Math.SQRT2) * 1.08, h * 0.27, (bd / Math.SQRT2) * 1.08)
  roof.position.set(0, bh + h * 0.135, -bd / 2 - 0.06)
  for (const m of [body, roof]) { m.castShadow = true; m.receiveShadow = true }
  const shadow = new THREE.Mesh(k.keep(new THREE.CircleGeometry(1, 24)), k.keep(new THREE.MeshBasicMaterial({ color: 0x3c5a2a, transparent: true, opacity: 0.22, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(W * 0.55, bd * 0.75, 1)
  shadow.position.set(0, 0.02, -bd / 2)
  g.add(shadow, body, roof, face)
  return g
}

/** 꽃 덤불 만드는 기계(모양·색은 한 번 만들고 같이 쓴다). 덤불마다 seed 로 모양이 조금씩 다르다 */
export function bushKit(k: Pick<Kit, 'keep'>) {
  const ball = k.keep(new THREE.IcosahedronGeometry(1, 2)), bloom = k.keep(new THREE.SphereGeometry(1, 10, 8))
  const mat = (c: number, e = 0.18) => k.keep(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e }))
  const greens = [0x8bd96f, 0x9fe27c, 0x7acb5e].map((c) => mat(c, 0.32))
  const flowers = [0xff8fb1, 0xffd54a, 0xff9ec4, 0xffe066, 0xffffff].map((c) => mat(c, 0.35))
  return (seed: number, scale = 1) => {
    let s = (seed * 2654435761) >>> 0
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
    const g = new THREE.Group()
    const n = 5 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r(), d = i ? 0.35 + r() * 0.2 : 0
      const b = new THREE.Mesh(ball, greens[i % 3])
      const sz = (i ? 0.38 : 0.5) + r() * 0.12
      b.position.set(Math.cos(a) * d, sz * 0.75, Math.sin(a) * d * 0.8)
      b.scale.set(sz, sz * 0.85, sz)
      b.castShadow = true
      g.add(b)
    }
    // 꽃송이: 덤불 겉에 흩뿌린다
    for (let i = 0; i < 28; i++) {
      const a = r() * Math.PI * 2, up = 0.25 + r() * 0.55
      const f = new THREE.Mesh(bloom, flowers[i % flowers.length])
      const rad = 0.55 + (1 - up) * 0.25
      f.position.set(Math.cos(a) * rad * Math.sqrt(1 - up * 0.5), 0.3 + up * 0.55, Math.sin(a) * rad * 0.85)
      f.scale.setScalar(0.1 + r() * 0.05)
      g.add(f)
    }
    g.scale.setScalar(scale)
    return g
  }
}
