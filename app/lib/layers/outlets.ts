// ── L7 — Electrical / outlets ────────────────────────────────────
// Will your layout actually reach power? We place typical code-spaced wall
// outlets (a receptacle every ~2.2m, so nothing on a wall is more than ~1.8m
// from one) and flag each power-hungry piece whose nearest outlet is out of
// cord reach — "the floor lamp is 2.4m from an outlet, plan an extension run."
// The outlets are TYPICAL positions (we don't know the real ones); stated as such.

import type { Plan, Furniture, Pt } from '../types'
import { furnitureType } from '../furniture'
import { roomCorners } from '../geometry'
import { formatLength } from '../units'
import type { InsightLayer, LayerResult, Overlay, PanelRow } from './types'

const SPACING = 220 // cm between outlets along a wall
const MARGIN = 55 // cm from a corner to the first outlet
const INSET = 22 // cm the marker sits inside the wall
const REACH = 180 // cm: further than this from an outlet = an extension run
const POWER: ReadonlySet<string> = new Set(['tv', 'lamp', 'fridge', 'stove', 'desk'])

const OUTLET_FILL = 'rgba(201, 183, 154, 0.9)'
const OUTLET_STROKE = 'rgba(107, 95, 79, 0.8)'
const RUN_LINE = 'rgba(168, 70, 60, 0.85)'
const RUN_TEXT = '#a8463c'

const center = (f: Furniture): Pt => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 })

// Typical outlet points: spaced along each room wall, nudged just inside.
export function typicalOutlets(plan: Plan): Pt[] {
  const pts: Pt[] = []
  for (const room of plan.rooms) {
    const cs = roomCorners(room)
    const cx = cs.reduce((a, p) => a + p.x, 0) / cs.length
    const cy = cs.reduce((a, p) => a + p.y, 0) / cs.length
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i]
      const b = cs[(i + 1) % cs.length]
      const L = Math.hypot(b.x - a.x, b.y - a.y)
      if (L < 120) continue
      const ux = (b.x - a.x) / L
      const uy = (b.y - a.y) / L
      const usable = L - 2 * MARGIN
      const n = Math.max(1, Math.floor(usable / SPACING) + 1)
      for (let k = 0; k < n; k++) {
        const d = MARGIN + (n === 1 ? usable / 2 : (k * usable) / (n - 1))
        const px = a.x + ux * d
        const py = a.y + uy * d
        const inx = cx - px
        const iny = cy - py
        const il = Math.hypot(inx, iny) || 1
        pts.push({ x: px + (inx / il) * INSET, y: py + (iny / il) * INSET })
      }
    }
  }
  return pts
}

export function computeOutletsLayer(plan: Plan): LayerResult {
  const overlays: Overlay[] = []
  const panelRows: PanelRow[] = []
  const warnings: string[] = []
  const u = plan.units

  const devices = plan.furniture.filter((f) => POWER.has(furnitureType(f.type)))
  if (plan.rooms.length === 0) {
    return { overlays, panelRows: [{ id: '__norooms__', label: 'Draw rooms first', detail: 'Outlets are placed along room walls.', tone: 'ok' }], warnings }
  }

  const outlets = typicalOutlets(plan)
  const S = 13 // marker size (cm)
  for (const o of outlets) overlays.push({ kind: 'rect', x: o.x - S / 2, y: o.y - S / 2, w: S, h: S, fill: OUTLET_FILL, stroke: OUTLET_STROKE })

  if (devices.length === 0) {
    panelRows.push({ id: '__nodev__', label: 'No powered pieces', detail: 'Add a TV, lamp, fridge, stove or desk to check outlet reach.', tone: 'ok' })
    return { overlays, panelRows, warnings }
  }

  let runs = 0
  for (const f of devices) {
    const c = center(f)
    let nearest: Pt | null = null
    let nd = Infinity
    for (const o of outlets) {
      const d = Math.hypot(o.x - c.x, o.y - c.y)
      if (d < nd) {
        nd = d
        nearest = o
      }
    }
    if (!nearest) continue
    const needsRun = nd > REACH
    if (needsRun) {
      runs++
      overlays.push({ kind: 'path', points: [c, nearest], stroke: RUN_LINE, dash: '6 5' })
      overlays.push({ kind: 'badge', x: (c.x + nearest.x) / 2, y: (c.y + nearest.y) / 2, text: formatLength(nd, u), color: RUN_TEXT })
    }
    panelRows.push({
      id: `dev-${f.id}`,
      label: f.name || furnitureType(f.type),
      detail: needsRun ? `${formatLength(nd, u)} from an outlet — plan an extension run` : `${formatLength(nd, u)} from an outlet — within reach`,
      tone: needsRun ? 'warn' : 'ok',
      targetId: f.id,
    })
  }
  panelRows.push({ id: '__note__', label: `${outlets.length} typical outlets`, detail: 'Positions are code-spaced estimates, not your real outlets.', tone: 'ok' })
  if (runs) warnings.push(`${runs} device${runs > 1 ? 's need' : ' needs'} an extension run.`)

  return { overlays, panelRows, warnings }
}

export const outletsLayer: InsightLayer = {
  id: 'outlets',
  label: 'Outlets & power',
  desc: 'Typical wall outlets + which powered pieces sit out of cord reach',
  icon: '🔌',
  compute: computeOutletsLayer,
}
