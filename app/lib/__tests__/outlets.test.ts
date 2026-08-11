import { describe, it, expect } from 'vitest'
import type { Plan, Furniture } from '../types'
import { defaultPlan } from '../storage'
import { typicalOutlets, computeOutletsLayer } from '../layers/outlets'
import { getLayer, computeActiveLayers } from '../layers/registry'

const piece = (over: Partial<Furniture> & Pick<Furniture, 'id' | 'type'>): Furniture => ({
  name: over.name ?? over.id,
  x: 0, y: 0, w: 100, h: 100, rotation: 0, color: '#b5714e',
  ...over,
})
const room = { id: 'r', name: 'Room', x: 0, y: 0, w: 600, h: 600 }
const base = (furniture: Furniture[]): Plan => ({ ...defaultPlan(), units: 'metric', rooms: [room], doors: [], furniture })

describe('L7 outlets', () => {
  it('places outlets along the room walls, inset from them', () => {
    const pts = typicalOutlets(base([]))
    expect(pts.length).toBeGreaterThan(4)
    // every outlet sits near a wall (within a small inset), never mid-room
    for (const p of pts) {
      const nearWall = Math.min(p.x, p.y, 600 - p.x, 600 - p.y)
      expect(nearWall).toBeLessThan(40)
    }
  })

  it('marks a wall-hugging device as within reach and a mid-room device as an extension run', () => {
    const res = computeOutletsLayer(
      base([
        piece({ id: 'tv', name: 'TV', type: 'tv', x: 280, y: 10, w: 120, h: 25 }), // against the top wall
        piece({ id: 'lamp', name: 'Floor lamp', type: 'lamp', x: 290, y: 290, w: 40, h: 40 }), // dead centre
      ]),
    )
    expect(res.panelRows.find((r) => r.id === 'dev-tv')).toMatchObject({ tone: 'ok' })
    const lamp = res.panelRows.find((r) => r.id === 'dev-lamp')
    expect(lamp).toMatchObject({ tone: 'warn' })
    expect(lamp?.detail).toContain('extension run')
    expect(res.warnings).toHaveLength(1)
    expect(res.overlays.some((o) => o.kind === 'rect')).toBe(true) // outlet markers
    expect(res.overlays.some((o) => o.kind === 'path')).toBe(true) // the run line
  })

  it('notes when nothing needs power', () => {
    expect(computeOutletsLayer(base([piece({ id: 's', type: 'sofa', x: 40, y: 40, w: 100, h: 100 })])).panelRows.some((r) => r.id === '__nodev__')).toBe(true)
  })

  it('needs rooms', () => {
    expect(computeOutletsLayer({ ...defaultPlan(), rooms: [], furniture: [] }).panelRows[0]).toMatchObject({ id: '__norooms__' })
  })

  it('is a distinct registered layer', () => {
    expect(getLayer('outlets')?.label).toBe('Outlets & power')
    expect(computeActiveLayers({ ...base([]), layers: ['outlets'] }).map((l) => l.id)).toEqual(['outlets'])
  })
})
