import * as THREE from 'three'

/**
 * Soft circular / diffraction-spike textures for PointsMaterial.
 * Default Three.js points are hard squares — these make real-looking stars.
 */

type Kind = 'soft' | 'spike' | 'dust' | 'core'

const cache = new Map<Kind, THREE.CanvasTexture>()

function makeCanvas(size: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('2d context unavailable')
  return { canvas, ctx }
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

/** Soft circular glow — main field stars */
function drawSoft(size: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  // Outer halo
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  halo.addColorStop(0, 'rgba(255,255,255,1)')
  halo.addColorStop(0.08, 'rgba(255,255,255,0.95)')
  halo.addColorStop(0.22, 'rgba(255,255,255,0.55)')
  halo.addColorStop(0.45, 'rgba(255,255,255,0.18)')
  halo.addColorStop(0.7, 'rgba(255,255,255,0.05)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)

  // Hot core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.22)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.5, 'rgba(255,255,255,0.7)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = core
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  return toTexture(canvas)
}

/** Bright star with faint diffraction spikes (cinema look) */
function drawSpike(size: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  // Soft cross spikes
  const spikeLen = r * 0.92
  const spikeW = r * 0.045
  ctx.save()
  ctx.translate(cx, cy)
  for (let i = 0; i < 2; i++) {
    ctx.rotate(i === 0 ? 0 : Math.PI / 2)
    const g = ctx.createLinearGradient(-spikeLen, 0, spikeLen, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.22)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.65, 'rgba(255,255,255,0.22)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(-spikeLen, -spikeW, spikeLen * 2, spikeW * 2)
  }
  // Diagonal thinner spikes
  ctx.rotate(Math.PI / 4)
  for (let i = 0; i < 2; i++) {
    ctx.rotate(i === 0 ? 0 : Math.PI / 2)
    const g = ctx.createLinearGradient(-spikeLen * 0.7, 0, spikeLen * 0.7, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(-spikeLen * 0.7, -spikeW * 0.55, spikeLen * 1.4, spikeW * 1.1)
  }
  ctx.restore()

  // Circular body over spikes
  const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55)
  body.addColorStop(0, 'rgba(255,255,255,1)')
  body.addColorStop(0.12, 'rgba(255,255,255,0.95)')
  body.addColorStop(0.35, 'rgba(255,255,255,0.4)')
  body.addColorStop(0.65, 'rgba(255,255,255,0.08)')
  body.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = body
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  return toTexture(canvas)
}

/** Wide soft blob for nebula / dust clouds */
function drawDust(size: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.28)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return toTexture(canvas)
}

/** Tiny hard-ish core for micro distant stars */
function drawCore(size: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.25)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return toTexture(canvas)
}

export function getStarTexture(kind: Kind = 'soft'): THREE.CanvasTexture {
  const hit = cache.get(kind)
  if (hit) return hit
  let tex: THREE.CanvasTexture
  switch (kind) {
    case 'spike':
      tex = drawSpike(128)
      break
    case 'dust':
      tex = drawDust(96)
      break
    case 'core':
      tex = drawCore(48)
      break
    default:
      tex = drawSoft(64)
  }
  cache.set(kind, tex)
  return tex
}
