import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { COMBAT_HITS, COMBAT_LOOP } from './combatTimeline'

/** Fixed instance pools: no allocations, timers or React updates per frame. */
export function CombatEffects({ clock, low }: { clock: RefObject<number>; low: boolean }) {
  const sparks = useRef<InstancedMesh>(null)
  const dust = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const count = low ? 8 : 16
  useLayoutEffect(() => {
    for (let i = 0; i < 64; i++) sparks.current!.setColorAt(i, new Color(i % 3 === 0 ? '#fff6c2' : '#ffb13b'))
    sparks.current!.instanceColor!.needsUpdate = true
  }, [])
  useFrame(() => {
    const t = clock.current % COMBAT_LOOP
    let index = 0
    for (const hit of COMBAT_HITS) {
      const age = t - hit.time
      const active = age >= 0 && age < .48
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996, speed = 2.2 + (i % 4) * .45
        dummy.position.set(
          Math.cos(a) * age * speed,
          1.85 + Math.sin(a) * age * speed - age * age * 4,
          hit.side * .52 + Math.sin(i * 1.7) * age * 1.5,
        )
        dummy.rotation.set(0, -a, a)
        dummy.scale.set(active ? .025 * (1 - age / .48) : 0, active ? .12 : 0, active ? .025 : 0)
        dummy.updateMatrix()
        sparks.current!.setMatrixAt(index++, dummy.matrix)
      }
    }
    sparks.current!.count = index
    sparks.current!.instanceMatrix.needsUpdate = true
    index = 0
    for (const hit of COMBAT_HITS) {
      const age = t - hit.time + .12
      for (let i = 0; i < 8; i++) {
        const active = age >= 0 && age < .65, a = i * Math.PI / 4
        dummy.position.set(hit.side * 1.05 + Math.cos(a) * age * 1.4, .08 + Math.sin(age * Math.PI / .65) * .12, Math.sin(a) * age * .8)
        dummy.rotation.set(0, a, 0)
        dummy.scale.setScalar(active ? .09 * Math.sin(age / .65 * Math.PI) : 0)
        dummy.updateMatrix()
        dust.current!.setMatrixAt(index++, dummy.matrix)
      }
    }
    dust.current!.instanceMatrix.needsUpdate = true
  })
  return <>
    <instancedMesh ref={sparks} args={[undefined, undefined, 64]} frustumCulled={false}>
      <boxGeometry /><meshBasicMaterial toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={dust} args={[undefined, undefined, 32]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#cfac75" transparent opacity={.45} depthWrite={false} />
    </instancedMesh>
  </>
}
