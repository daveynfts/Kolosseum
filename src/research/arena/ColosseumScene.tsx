import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, Object3D, Path, Shape } from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'

const GOLD = '#b88c4c', STEEL = '#d7ccaa', LEATHER = '#35231e'
function Architecture() {
  const arches = useRef<InstancedMesh>(null), seats = useRef<InstancedMesh>(null)
  const arch = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-.72, 0); shape.lineTo(.72, 0); shape.lineTo(.72, 2.35); shape.lineTo(-.72, 2.35); shape.closePath()
    const hole = new Path()
    hole.moveTo(-.45, .12); hole.lineTo(-.45, 1.43); hole.absarc(0, 1.43, .45, Math.PI, 0, true); hole.lineTo(.45, .12); hole.closePath()
    shape.holes.push(hole)
    return new ExtrudeGeometry(shape, { depth: .45, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 10 })
  }, [])
  const positions = useMemo(() => {
    const result: Array<[number, number, number, number]> = []
    for (let level = 0; level < 3; level++) for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2
      if (Math.sin(a) > .6) continue
      const r = 11.8 + level * .3
      result.push([Math.cos(a) * r, .5 + level * 2.5, Math.sin(a) * r, -a - Math.PI / 2])
    }
    return result
  }, [])
  useLayoutEffect(() => {
    const temp = new Object3D()
    positions.forEach(([x,y,z,a], i) => { temp.position.set(x,y,z); temp.rotation.set(0,a,0); temp.updateMatrix(); arches.current!.setMatrixAt(i,temp.matrix); arches.current!.setColorAt(i, new Color(i % 4 === 0 ? '#675747' : '#806c55')) })
    arches.current!.instanceMatrix.needsUpdate = true
    if (arches.current!.instanceColor) arches.current!.instanceColor.needsUpdate = true
    let index = 0
    for (let tier = 0; tier < 5; tier++) for (let i = 0; i < 42; i++) {
      const a = i / 42 * Math.PI * 2, r = 8.1 + tier * .65
      if (Math.sin(a) > .7) continue
      temp.position.set(Math.cos(a) * r, .3 + tier * .27, Math.sin(a) * r); temp.rotation.set(0, -a, 0); temp.scale.set(.62,.28,1.25); temp.updateMatrix(); seats.current!.setMatrixAt(index++,temp.matrix)
    }
    seats.current!.count = index; seats.current!.instanceMatrix.needsUpdate = true
  }, [positions])
  return <group>
    <instancedMesh ref={arches} args={[arch, undefined, positions.length]} receiveShadow><meshStandardMaterial roughness={.92} /></instancedMesh>
    <instancedMesh ref={seats} args={[undefined, undefined, 210]} receiveShadow><boxGeometry /><meshStandardMaterial color="#5b4936" roughness={1} /></instancedMesh>
    {[0,1,2].map(i => <mesh key={i} rotation={[-Math.PI / 2,0,0]} position={[0,.48 + i * 2.5,0]}><ringGeometry args={[11.4 + i * .3,12.7 + i * .3,64,1,Math.PI * .82,Math.PI * 1.35]} /><meshStandardMaterial color="#9a8060" side={DoubleSide} roughness={.85} /></mesh>)}
    {[-5,-2.5,0,2.5,5].map((x,i) => <group key={x} position={[x,4.3,-10.9]}><mesh position={[0,.9,0]}><boxGeometry args={[1.05,2.4,.045]} /><meshStandardMaterial color={i % 2 ? '#601f28' : '#963b37'} side={DoubleSide} roughness={.85} /></mesh><mesh position={[0,.95,.035]}><torusGeometry args={[.24,.026,5,20]} /><meshStandardMaterial color={GOLD} metalness={.6} roughness={.4} /></mesh><mesh position={[0,2.16,0]} rotation={[0,0,Math.PI / 2]}><cylinderGeometry args={[.04,.04,1.4,8]} /><meshStandardMaterial color={GOLD} /></mesh></group>)}
    {[-1,1].map(side => <group key={side} position={[side * 6.4,0,-4.2]}><mesh position={[0,.8,0]}><cylinderGeometry args={[.15,.3,1.6,8]} /><meshStandardMaterial color="#33251b" metalness={.55} roughness={.45} /></mesh><mesh position={[0,1.65,0]}><coneGeometry args={[.28,.7,7]} /><meshStandardMaterial color="#ffbe6f" emissive="#ff7329" emissiveIntensity={3} /></mesh><pointLight position={[0,2,0]} color="#ff943f" intensity={16} distance={9} /></group>)}
  </group>
}
function JointLimb({ leg = false }: { leg?: boolean }) {
  return <><mesh position={[0,-.23,0]} castShadow><capsuleGeometry args={[leg ? .15 : .12,.27,4,8]} /><meshStandardMaterial color={leg ? LEATHER : '#ae8060'} roughness={.8} /></mesh><mesh position={[0,-.23,.02]} castShadow><boxGeometry args={[leg ? .22 : .19,.32,.19]} /><meshStandardMaterial color={GOLD} metalness={.72} roughness={.36} /></mesh></>
}
function Fighter({ side, clock }: { side: number; clock: RefObject<number> }) {
  const root = useRef<Group>(null), chest = useRef<Group>(null), sword = useRef<Group>(null), shield = useRef<Group>(null), leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null), cape = useRef<Group>(null)
  useFrame(() => {
    const phase = (clock.current % 6) / 6
    const pulse = (center: number, width: number) => Math.max(0, 1 - Math.abs(phase - center) / width)
    const approach = Math.sin(phase * Math.PI) ** 2
    const strike = side < 0 ? pulse(.35,.15) : pulse(.7,.14)
    const block = side < 0 ? pulse(.7,.14) : pulse(.35,.15)
    root.current!.position.set(side * (1.45 - approach * .33), Math.sin(phase * Math.PI * 4) * .035, 0)
    chest.current!.rotation.z = side * strike * .12
    chest.current!.rotation.y = strike * .35 - block * .15
    sword.current!.rotation.x = -.5 - Math.sin(strike * Math.PI) * 1.7 + strike * 1.1
    sword.current!.rotation.z = -.22 - strike * .45
    shield.current!.rotation.x = -.4 - block * .8
    leftLeg.current!.rotation.x = Math.sin(phase * Math.PI * 4) * .22
    rightLeg.current!.rotation.x = -Math.sin(phase * Math.PI * 4) * .22
    cape.current!.rotation.x = .12 + Math.sin(phase * Math.PI * 4 + side) * .09
  })
  return <group ref={root} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2,0]} scale={1.18}>
    <group position={[0,1.1,0]}><mesh castShadow><cylinderGeometry args={[.29,.35,.35,10]} /><meshStandardMaterial color={LEATHER} /></mesh><mesh position={[0,.12,0]} castShadow><cylinderGeometry args={[.32,.32,.12,12]} /><meshStandardMaterial color={GOLD} metalness={.7} roughness={.3} /></mesh>
      {[-1,1].map(s => <group key={s} position={[s * .19,-.08,0]} ref={s < 0 ? leftLeg : rightLeg}><JointLimb leg /><group position={[0,-.48,0]} rotation={[.12,0,0]}><JointLimb leg /><mesh position={[0,-.44,.12]} castShadow><boxGeometry args={[.23,.19,.42]} /><meshStandardMaterial color={LEATHER} /></mesh></group></group>)}
    </group>
    <group ref={chest} position={[0,1.42,0]}>
      <mesh position={[0,.2,0]} castShadow><cylinderGeometry args={[.48,.29,.69,10]} /><meshStandardMaterial color={side < 0 ? '#ad8545' : '#657476'} metalness={.78} roughness={.32} /></mesh>
      <mesh position={[0,.2,.36]} castShadow><sphereGeometry args={[.18,10,8]} /><meshStandardMaterial color={GOLD} metalness={.8} roughness={.3} /></mesh>
      <group position={[0,.76,0]}><mesh castShadow><sphereGeometry args={[.26,16,12]} /><meshStandardMaterial color="#b18b6c" roughness={.8} /></mesh><mesh position={[0,.07,-.035]} castShadow><sphereGeometry args={[.285,16,12,0,Math.PI * 2,0,Math.PI * .7]} /><meshStandardMaterial color={GOLD} metalness={.8} roughness={.3} /></mesh><mesh position={[0,.025,.237]}><boxGeometry args={[.38,.065,.07]} /><meshStandardMaterial color="#141315" /></mesh><mesh position={[0,-.065,.245]} castShadow><boxGeometry args={[.075,.25,.09]} /><meshStandardMaterial color={GOLD} metalness={.8} roughness={.3} /></mesh><mesh position={[0,.3,-.04]} castShadow><boxGeometry args={[.085,.24,.42]} /><meshStandardMaterial color={side < 0 ? '#922d32' : '#172c37'} roughness={.92} /></mesh></group>
      <group ref={cape} position={[0,.45,-.25]}><mesh position={[0,-.55,-.12]} rotation={[.15,0,0]} castShadow><boxGeometry args={[.65,1.28,.045]} /><meshStandardMaterial color={side < 0 ? '#852c35' : '#223e49'} side={DoubleSide} roughness={.9} /></mesh></group>
      <group ref={sword} position={[.5,.4,0]}><mesh castShadow><sphereGeometry args={[.22,10,8]} /><meshStandardMaterial color={GOLD} metalness={.7} roughness={.4} /></mesh><JointLimb /><group position={[0,-.48,0]} rotation={[-.8,0,0]}><JointLimb /><group position={[0,-.43,0]} rotation={[0,0,-.12]}><mesh castShadow><cylinderGeometry args={[.055,.055,.24,8]} /><meshStandardMaterial color={LEATHER} /></mesh><mesh position={[0,-.14,0]} castShadow><boxGeometry args={[.3,.065,.1]} /><meshStandardMaterial color={GOLD} metalness={.8} roughness={.2} /></mesh><mesh position={[0,-.64,0]} castShadow><boxGeometry args={[.105,.95,.04]} /><meshStandardMaterial color={STEEL} metalness={.9} roughness={.18} /></mesh><mesh position={[0,-1.17,0]} rotation={[0,0,Math.PI]} castShadow><coneGeometry args={[.07,.14,4]} /><meshStandardMaterial color={STEEL} metalness={.9} roughness={.18} /></mesh></group></group></group>
      <group ref={shield} position={[-.5,.35,0]}><mesh castShadow><sphereGeometry args={[.22,10,8]} /><meshStandardMaterial color={GOLD} metalness={.7} roughness={.4} /></mesh><JointLimb /><group position={[0,-.4,.22]}><mesh rotation={[Math.PI / 2,0,0]} scale={[1,1,1.3]} castShadow><cylinderGeometry args={[.47,.47,.085,24]} /><meshStandardMaterial color={side < 0 ? '#772c2d' : '#273d43'} metalness={.3} roughness={.5} /></mesh><mesh position={[0,0,.06]} scale={[1,1.3,1]}><torusGeometry args={[.45,.045,8,24]} /><meshStandardMaterial color={GOLD} metalness={.8} roughness={.25} /></mesh><mesh position={[0,0,.1]}><sphereGeometry args={[.13,12,8]} /><meshStandardMaterial color={GOLD} metalness={.85} roughness={.22} /></mesh></group></group>
    </group>
  </group>
}
function World({ paused, resetCamera, low, onLost }: { paused: boolean; resetCamera: number; low: boolean; onLost: () => void }) {
  const clock = useRef(0), controls = useRef<Controls>(null)
  const { camera, gl } = useThree()
  useFrame((_, delta) => { if (!paused) clock.current += Math.min(delta, .05) })
  useEffect(() => { camera.position.set(6.8,5.2,8.4); controls.current?.target.set(0,1.5,0); controls.current?.update() }, [camera,resetCamera])
  useEffect(() => { const lost = (e: Event) => { e.preventDefault(); onLost() }; gl.domElement.addEventListener('webglcontextlost',lost); return () => gl.domElement.removeEventListener('webglcontextlost',lost) }, [gl,onLost])
  return <>
    <color attach="background" args={['#16151a']} /><fog attach="fog" args={['#20191a',15,36]} />
    <ambientLight intensity={.8} color="#d3b491" /><hemisphereLight args={['#edd3a5','#272330',1.5]} />
    <directionalLight position={[-5,10,4]} intensity={3.5} color="#ffd3a0" castShadow={!low} shadow-mapSize={[1024,1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-normalBias={.04} />
    <directionalLight position={[4,5,-6]} color="#adc2da" intensity={2.3} />
    <mesh rotation={[-Math.PI / 2,0,0]} receiveShadow><circleGeometry args={[14,64]} /><meshStandardMaterial color="#9e7b50" roughness={1} /></mesh>
    {[5.5,6,7.4].map(r => <mesh key={r} rotation={[-Math.PI / 2,0,0]} position={[0,.008,0]}><ringGeometry args={[r,r + .025,64]} /><meshStandardMaterial color="#c5a473" roughness={1} /></mesh>)}
    <Architecture /><Fighter side={-1} clock={clock} /><Fighter side={1} clock={clock} />
    <OrbitControls ref={controls} target={[0,1.5,0]} enablePan={false} enableZoom={false} minPolarAngle={.9} maxPolarAngle={1.25} minAzimuthAngle={.25} maxAzimuthAngle={1.05} autoRotate={!paused} autoRotateSpeed={.15} enableDamping dampingFactor={.08} />
  </>
}
export default function ColosseumScene({ paused, resetCamera }: { paused: boolean; resetCamera: number }) {
  const [low,setLow] = useState(() => window.innerWidth < 768), [lost,setLost] = useState(false)
  if (lost) return <div className="arena-poster"><img src="/demo/arena-poster.jpg" alt="Colosseum" /><span>KOLOSSEUM</span></div>
  return <Canvas className="colosseum-canvas" aria-label="Two gladiators sparring in a Roman Colosseum" shadows={!low} dpr={low ? 1 : [1,1.5]} camera={{ position:[6.8,5.2,8.4],fov:42,near:.1,far:60 }} frameloop={paused ? 'demand' : 'always'} gl={{ antialias:true,alpha:false,powerPreference:'high-performance' }} fallback={<div className="arena-poster"><img src="/demo/arena-poster.jpg" alt="Colosseum" /></div>}>
    <Suspense fallback={null}><World paused={paused} resetCamera={resetCamera} low={low} onLost={() => setLost(true)} /><PerformanceMonitor onDecline={() => setLow(true)} flipflops={2} onFallback={() => setLow(true)} /></Suspense>
  </Canvas>
}
