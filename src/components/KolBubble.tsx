import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Billboard, Float, Html, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { Kol } from '../types'
import { NICHE_COLORS, primaryNiche } from '../types'
import { radiusForScore } from '../lib/layout'
import { xAvatarTextureUrl } from '../lib/avatar'
import { AvatarImg } from './AvatarImg'
import { TextureErrorBoundary } from './TextureErrorBoundary'

interface Props {
  kol: Kol
  position: [number, number, number]
  selected: boolean
  dimmed: boolean
  onSelect: (kol: Kol) => void
  /** 2D lite: fewer meshes / no glass shells / cheaper materials */
  lite?: boolean
}

export function KolBubble(props: Props) {
  return (
    <TextureErrorBoundary
      fallback={<AvatarNode {...props} map={null} loadState="error" />}
    >
      <Suspense
        fallback={<AvatarNode {...props} map={null} loadState="loading" />}
      >
        <AvatarWithTexture {...props} />
      </Suspense>
    </TextureErrorBoundary>
  )
}

function AvatarWithTexture(props: Props) {
  const url = xAvatarTextureUrl(props.kol.handle)
  // R2 CDN is cross-origin — required for WebGL texture upload
  const texture = useLoader(THREE.TextureLoader, url, (loader) => {
    loader.setCrossOrigin('anonymous')
  })
  texture.colorSpace = THREE.SRGBColorSpace
  // Lite/2.5D: no mipmap thrash when billboard distance changes (stops shimmer)
  if (props.lite) {
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 1
  } else {
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 16
  }
  texture.needsUpdate = true
  return <AvatarNode {...props} map={texture} loadState="ready" />
}

type LoadState = 'ready' | 'loading' | 'error'

function AvatarNode({
  kol,
  position,
  selected,
  dimmed,
  onSelect,
  map,
  lite = false,
  loadState = 'ready',
}: Props & { map: THREE.Texture | null; loadState?: LoadState }) {
  const glowRef = useRef<THREE.Mesh>(null)
  const discRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const shellInnerRef = useRef<THREE.Mesh>(null)
  const rimRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const { gl } = useThree()

  if (map && !lite) {
    map.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
  }

  const color = NICHE_COLORS[primaryNiche(kol)]
  const baseR = radiusForScore(kol.score) * (lite ? 1.08 : 1)
  const isHot = kol.statusLabel === 'hot' || kol.hotScore >= 78
  const isFocus = selected || hovered
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const segs = lite ? 48 : 64
  // Static scale in 2.5D — no per-frame pulse (was causing flicker)
  const liteScale = isFocus ? 1.12 : 1
  const hasFace = !!map
  // Neutral placeholder while texture loads / on error — no letter flash
  const placeholderColor = loadState === 'loading' ? '#1e293b' : '#0f172a'
  const faceColor = hasFace ? color : placeholderColor

  useFrame((state) => {
    // 2.5D: skip all per-frame motion on avatars (stable, no flicker)
    if (lite) return

    const t = state.clock.elapsedTime
    if (!discRef.current || !glowRef.current) return

    const floatY = Math.sin(t * 0.85 + phase) * 0.07
    discRef.current.position.y = floatY

    const pulse =
      isHot || isFocus
        ? 1 + Math.sin(t * (isHot ? 2.6 : 2.0) + phase) * (isHot ? 0.065 : 0.04)
        : 1 + Math.sin(t * 1.15 + phase) * 0.018
    const boost = isFocus ? 1.18 : 1
    const s = pulse * boost

    discRef.current.scale.setScalar(
      THREE.MathUtils.lerp(discRef.current.scale.x, s, 0.12),
    )
    glowRef.current.scale.setScalar(
      THREE.MathUtils.lerp(glowRef.current.scale.x, s * 1.55, 0.1),
    )

    if (orbitRef.current) {
      orbitRef.current.rotation.y = t * (isHot ? 0.75 : 0.32) + phase
      orbitRef.current.rotation.z = Math.sin(t * 0.45 + phase) * 0.35
      orbitRef.current.rotation.x = 0.55 + Math.sin(t * 0.3 + phase) * 0.12
    }

    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.18 + phase
      shellRef.current.rotation.x = t * 0.09
      const mat = shellRef.current.material as THREE.MeshPhysicalMaterial
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        dimmed ? 0.03 : isFocus ? 0.28 : isHot ? 0.2 : 0.14,
        0.08,
      )
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        isFocus ? 0.45 : isHot ? 0.28 : 0.14,
        0.08,
      )
    }

    if (shellInnerRef.current) {
      shellInnerRef.current.rotation.y = -t * 0.12 + phase
      const mat = shellInnerRef.current.material as THREE.MeshPhysicalMaterial
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        dimmed ? 0.02 : isFocus ? 0.18 : 0.1,
        0.08,
      )
    }

    if (rimRef.current) {
      rimRef.current.rotation.z = t * 0.4
      rimRef.current.rotation.x = Math.PI / 2.2
    }
  })

  const faceOpacity = dimmed ? 0.2 : 1
  const ringOpacity = dimmed ? 0.18 : isFocus ? 1 : 0.92

  const pickHandlers = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      onSelect(kol)
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      setHovered(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHovered(false)
      document.body.style.cursor = 'default'
    },
  }

  /* ——— 2.5D: static disc (no float/pulse) — avoids avatar flicker ——— */
  if (lite) {
    return (
      <group position={position} scale={liteScale}>
        {/* Soft halo behind face — single layer, no z-fight with disc */}
        <Billboard follow lockZ={false}>
          <mesh position={[0, 0, -0.02]} renderOrder={0}>
            <circleGeometry args={[baseR * 1.18, segs]} />
            <meshBasicMaterial
              color={hasFace ? color : placeholderColor}
              transparent
              opacity={
                dimmed
                  ? 0.08
                  : hasFace
                    ? isHot
                      ? 0.38
                      : 0.28
                    : loadState === 'loading'
                      ? 0.35
                      : 0.22
              }
              depthWrite={false}
              depthTest
              toneMapped={false}
            />
          </mesh>

          {/* Face — opaque depth write so no transparent thrash */}
          <mesh position={[0, 0, 0]} renderOrder={1} {...pickHandlers}>
            <circleGeometry args={[baseR, segs]} />
            {map ? (
              <meshBasicMaterial
                map={map}
                transparent={dimmed}
                opacity={faceOpacity}
                depthWrite={!dimmed}
                depthTest
                side={THREE.FrontSide}
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            ) : (
              <meshBasicMaterial
                color={faceColor}
                transparent
                opacity={dimmed ? 0.25 : loadState === 'loading' ? 0.85 : 0.7}
                depthWrite={!dimmed}
                side={THREE.FrontSide}
                toneMapped={false}
              />
            )}
          </mesh>

          {/* Thin niche ring in front of face */}
          <mesh position={[0, 0, 0.01]} renderOrder={2}>
            <ringGeometry args={[baseR * 0.98, baseR * 1.08, segs]} />
            <meshBasicMaterial
              color={hasFace ? color : '#334155'}
              transparent
              opacity={
                dimmed
                  ? 0.12
                  : hasFace
                    ? isFocus
                      ? 0.95
                      : 0.75
                    : 0.35
              }
              depthWrite={false}
              depthTest
              side={THREE.FrontSide}
              toneMapped={false}
            />
          </mesh>

          {kol.tier === 1 && !dimmed && hasFace && (
            <mesh position={[baseR * 0.7, baseR * 0.7, 0.02]} renderOrder={3}>
              <circleGeometry args={[baseR * 0.15, 16]} />
              <meshBasicMaterial color="#fbbf24" depthWrite toneMapped={false} />
            </mesh>
          )}
        </Billboard>

        {isFocus && !dimmed && (
          <Html
            center
            distanceFactor={11}
            position={[0, baseR * 1.65, 0]}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[50, 0]}
          >
            <div className="bubble-label bubble-label--with-avatar glass">
              <AvatarImg
                handle={kol.handle}
                name={kol.displayName}
                size={36}
                color={color}
                className="bubble-label__avatar"
              />
              <div className="bubble-label__text">
                <span className="bubble-label__name">{kol.displayName}</span>
                <span className="bubble-label__meta">
                  @{kol.handle} · T{kol.tier ?? '—'} · {formatNum(kol.followers)}
                </span>
              </div>
            </div>
          </Html>
        )}
      </group>
    )
  }

  /* ——— Full 3D glass bubble ——— */
  return (
    <group position={position}>
      <mesh ref={shellRef}>
        <sphereGeometry args={[baseR * 1.28, 48, 48]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.14}
          roughness={0.08}
          metalness={0.05}
          transmission={0.55}
          thickness={0.6}
          ior={1.4}
          emissive={color}
          emissiveIntensity={0.15}
          depthWrite={false}
          clearcoat={1}
          clearcoatRoughness={0.12}
        />
      </mesh>

      <mesh ref={shellInnerRef} scale={0.92}>
        <sphereGeometry args={[baseR * 1.12, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.1}
          roughness={0.2}
          metalness={0}
          transmission={0.7}
          thickness={0.35}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={rimRef} rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry args={[baseR * 1.22, 0.012, 12, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={dimmed ? 0.08 : isFocus ? 0.55 : 0.28}
          depthWrite={false}
        />
      </mesh>

      {!dimmed && (
        <mesh scale={baseR * 1.32}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={isFocus ? 0.2 : 0.07}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh ref={glowRef}>
        <sphereGeometry args={[baseR * 1.18, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={dimmed ? 0.03 : isHot ? 0.16 : 0.09}
          depthWrite={false}
        />
      </mesh>

      {!dimmed && (
        <group ref={orbitRef}>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2
            const rr = baseR * 1.42
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(a) * rr,
                  Math.sin(a * 1.7) * rr * 0.28,
                  Math.sin(a) * rr,
                ]}
              >
                <sphereGeometry args={[baseR * (i % 2 === 0 ? 0.08 : 0.055), 12, 12]} />
                <meshBasicMaterial
                  color={i % 2 === 0 ? '#ffffff' : color}
                  transparent
                  opacity={0.9}
                  toneMapped={false}
                />
              </mesh>
            )
          })}
        </group>
      )}

      {(isHot || isFocus) && !dimmed && (
        <Sparkles
          count={isFocus ? 22 : 12}
          scale={[baseR * 3.4, baseR * 3.4, baseR * 3.4]}
          size={isFocus ? 3.2 : 2.2}
          speed={0.55}
          opacity={0.7}
          color={color}
        />
      )}

      <Float
        speed={isFocus ? 2.1 : 1.15}
        rotationIntensity={0}
        floatIntensity={isFocus ? 0.4 : 0.18}
        floatingRange={[-0.05, 0.05]}
      >
        <Billboard follow>
          <group ref={discRef}>
            <mesh position={[0, 0, -0.05]}>
              <circleGeometry args={[baseR * 1.16, segs]} />
              <meshPhysicalMaterial
                color={color}
                transparent
                opacity={dimmed ? 0.12 : 0.35}
                roughness={0.15}
                metalness={0.1}
                transmission={0.35}
                thickness={0.2}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            <mesh position={[0, 0, -0.03]}>
              <circleGeometry args={[baseR * 1.28, segs]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={dimmed ? 0.05 : isHot ? 0.28 : 0.16}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            <mesh position={[0, 0, -0.012]}>
              <ringGeometry args={[baseR * 1.03, baseR * 1.18, 72]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={ringOpacity}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            <mesh position={[0, 0, -0.006]}>
              <ringGeometry args={[baseR * 0.985, baseR * 1.035, 72]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={dimmed ? 0.12 : 0.92}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            <mesh position={[0, 0, 0]} {...pickHandlers}>
              <circleGeometry args={[baseR, segs]} />
              {map ? (
                <meshBasicMaterial
                  map={map}
                  transparent
                  opacity={faceOpacity}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                />
              ) : (
                <meshBasicMaterial
                  color={faceColor}
                  transparent
                  opacity={dimmed ? 0.25 : loadState === 'loading' ? 0.85 : 0.7}
                  side={THREE.DoubleSide}
                />
              )}
            </mesh>

            {!dimmed && hasFace && (
              <mesh position={[0, baseR * 0.35, 0.01]} scale={[0.85, 0.35, 1]}>
                <circleGeometry args={[baseR * 0.55, 32]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={isFocus ? 0.16 : 0.08}
                  depthWrite={false}
                />
              </mesh>
            )}

            {isHot && !dimmed && hasFace && (
              <mesh position={[0, 0, 0.02]}>
                <ringGeometry args={[baseR * 1.2, baseR * 1.3, 72]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.65}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            )}

            {kol.tier === 1 && !dimmed && hasFace && (
              <mesh position={[baseR * 0.72, baseR * 0.72, 0.04]}>
                <circleGeometry args={[baseR * 0.17, 24]} />
                <meshBasicMaterial color="#fbbf24" toneMapped={false} />
              </mesh>
            )}
          </group>
        </Billboard>
      </Float>

      {isFocus && !dimmed && (
        <Html
          center
          distanceFactor={11}
          position={[0, baseR * 1.75, 0]}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bubble-label bubble-label--with-avatar glass">
            <AvatarImg
              handle={kol.handle}
              name={kol.displayName}
              size={40}
              color={color}
              className="bubble-label__avatar"
            />
            <div className="bubble-label__text">
              <span className="bubble-label__name">{kol.displayName}</span>
              <span className="bubble-label__meta">
                @{kol.handle} · T{kol.tier ?? '—'} · {formatNum(kol.followers)}
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
