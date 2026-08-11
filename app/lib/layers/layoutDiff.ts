// ── L8 — Layout diff / ghost ─────────────────────────────────────
// Pin the current arrangement as "Plan B", rearrange, then see the ghost of
// where everything used to be at low opacity — with an arrow on every piece
// that moved, and a tally of what was added or removed. The analytical settler
// for "should we move the couch?". Pure over `plan` + `plan.ghost`.

import type { Plan, Furniture, Pt } from '../types'
import { furnitureType } from '../furniture'
import { formatLength } from '../units'
import { rectCorners } from './clearance'
import type { InsightLayer, LayerResult, Overlay, PanelRow } from './types'

const MOVED = 12 // cm: below this a piece counts as unchanged
const GHOST_FILL = 'rgba(120, 110, 96, 0.14)'
const GHOST_STROKE = 'rgba(120, 110, 96, 0.5)'
const ARROW = 'rgba(181, 113, 78, 0.9)' // accent
const REMOVED_STROKE = 'rgba(168, 70, 60, 0.6)'

const center = (f: Furniture): Pt => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 })

// A little arrowhead polygon at `to`, pointing along from→to.
function arrowHead(from: Pt, to: Pt): Pt[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const L = 20 // head length (cm)
  const W = 11 // half-width
  const bx = to.x - ux * L
  const by = to.y - uy * L
  return [
    { x: to.x, y: to.y },
    { x: bx - uy * W, y: by + ux * W },
    { x: bx + uy * W, y: by - ux * W },
  ]
}

export function computeLayoutDiffLayer(plan: Plan): LayerResult {
  const overlays: Overlay[] = []
  const panelRows: PanelRow[] = []
  const warnings: string[] = []
  const u = plan.units

  const ghost = plan.ghost
  if (!ghost) {
    return {
      overlays,
      panelRows: [{ id: '__pin__', label: 'No Plan B pinned yet', detail: 'Pin the current layout, rearrange, then compare — moved pieces get an arrow.', tone: 'ok' }],
      warnings,
    }
  }

  // Ghost furniture drawn faint (skip rugs for clarity).
  const ghostSolids = ghost.furniture.filter((f) => furnitureType(f.type) !== 'rug')
  for (const gf of ghostSolids) {
    overlays.push({ kind: 'rect', x: gf.x, y: gf.y, w: gf.w, h: gf.h, rotation: gf.rotation, fill: GHOST_FILL, stroke: GHOST_STROKE, opacity: 1 })
  }

  const ghostById = new Map(ghost.furniture.map((f) => [f.id, f]))
  const currentIds = new Set(plan.furniture.map((f) => f.id))

  let moved = 0
  let added = 0
  const moves: Array<{ name: string; dist: number; id: string }> = []
  for (const f of plan.furniture) {
    if (furnitureType(f.type) === 'rug') continue
    const gf = ghostById.get(f.id)
    if (!gf) {
      added++
      continue
    }
    const a = center(gf)
    const b = center(f)
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    if (dist <= MOVED) continue
    moved++
    moves.push({ name: f.name || furnitureType(f.type), dist, id: f.id })
    overlays.push({ kind: 'path', points: [a, b], stroke: ARROW, width: 3 })
    overlays.push({ kind: 'polygon', points: arrowHead(a, b), fill: ARROW })
  }

  // Removed = in the ghost but gone now.
  let removed = 0
  for (const gf of ghostSolids) {
    if (!currentIds.has(gf.id)) {
      removed++
      const c = center(gf)
      overlays.push({ kind: 'badge', x: c.x, y: c.y, text: '✕', color: '#a8463c' })
      overlays.push({ kind: 'rect', x: gf.x, y: gf.y, w: gf.w, h: gf.h, rotation: gf.rotation, fill: 'none', stroke: REMOVED_STROKE, opacity: 1 })
    }
  }

  if (moved === 0 && added === 0 && removed === 0) {
    panelRows.push({ id: '__same__', label: 'No changes from Plan B', detail: 'The layout matches the pinned snapshot.', tone: 'ok' })
  } else {
    const bits = [moved && `${moved} moved`, added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(' · ')
    panelRows.push({ id: '__summary__', label: 'Changes from Plan B', detail: bits, tone: 'warn' })
    for (const m of moves.sort((x, y) => y.dist - x.dist).slice(0, 6)) {
      panelRows.push({ id: `mv-${m.id}`, label: m.name, detail: `moved ${formatLength(m.dist, u)}`, tone: 'ok', targetId: m.id })
    }
  }

  return { overlays, panelRows, warnings }
}

export const layoutDiffLayer: InsightLayer = {
  id: 'layout-diff',
  label: 'Layout diff (Plan B ghost)',
  desc: 'Ghost a pinned layout under the current one, with arrows on everything that moved',
  icon: '👻',
  compute: computeLayoutDiffLayer,
}
