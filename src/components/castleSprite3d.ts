import * as THREE from 'three'
import { assetUrl } from '../lib/items'
import { castleViewBlend } from '../lib/castleViews'

/** 받은 4×2 방향 시트. 원본은 유지하고 분홍 배경과 각도 글자는 렌더링에서 제외한다. */
export function castleSprite(k: { keep: <T extends { dispose: () => void }>(x: T) => T; texOf: (src: string) => THREE.Texture }, height = 7.5) {
  const map = k.texOf(assetUrl('travel/3d/castle-views.jpg'))
  const uniforms = { castleA: { value: 0 }, castleB: { value: 1 }, castleMix: { value: 0 } }
  const material = k.keep(new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }))
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
      uniform float castleA; uniform float castleB; uniform float castleMix;
      vec4 castleSample(float frame, vec2 uv) {
        vec2 atlas = vec2((mod(frame, 4.0) + uv.x) / 4.0, 1.0 - (floor(frame / 4.0) + 0.015 + (1.0 - uv.y) * 0.85) / 2.0);
        vec4 c = texture2D(map, atlas);
        vec3 rgb = pow(max(c.rgb, vec3(0.0)), vec3(1.0 / 2.2));
        c.a = 1.0 - smoothstep(0.32, 0.52, min(rgb.r, rgb.b) - rgb.g);
        return c;
      }`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec4 ca = castleSample(castleA, vMapUv), cb = castleSample(castleB, vMapUv);
      float alpha = mix(ca.a, cb.a, castleMix);
      vec3 rgb = mix(ca.rgb * ca.a, cb.rgb * cb.a, castleMix) / max(alpha, 0.001);
      diffuseColor *= vec4(rgb, alpha);`)
  }
  material.customProgramCacheKey = () => 'eight-view-castle-v1'
  const plane = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(height * 320 / 272, height).translate(0, height / 2, 0)), material)
  const root = new THREE.Group()
  root.add(plane)
  const shadow = new THREE.Mesh(k.keep(new THREE.CircleGeometry(1, 32)), k.keep(new THREE.MeshBasicMaterial({ color: 0x455a31, transparent: true, opacity: 0.2, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.scale.set(2.8, 1.8, 1)
  root.add(shadow)
  return { root, update: (camera: THREE.Camera) => {
    const facing = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z)
    const frame = castleViewBlend(facing - root.rotation.y)
    uniforms.castleA.value = frame.a; uniforms.castleB.value = frame.b; uniforms.castleMix.value = frame.mix
    plane.rotation.y = facing - root.rotation.y
  } }
}
