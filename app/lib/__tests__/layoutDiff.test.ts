import { describe, it, expect } from 'vitest'
import type { Plan, Furniture } from '../types'
import { defaultPlan, normalizePlan } from '../storage'
import { computeLayoutDiffLayer } from '../layers/layoutDiff'
import { getLayer, computeActiveLayers } from '../layers/registry'

const piece = (over: Partial<Furniture> & Pick<Furniture, 'id' | 'type'>): Furniture => ({
  name: over.name ?? over.id,
  x: 0, y: 0, w: 100, h: 100, rotation: 0, color: '#b5714e',
  ...over,
})
const room = { id: 'r', name: 'R', x: 0, y: 0, w: 800, h: 800 }
const base = (over: Partial<Plan>): Plan => ({ ...defaultPlan(), units: 'metric', rooms: [room], doors: [], furniture: [], ...over })

describe('L8 layout diff', () => {
  it('prompts to pin a Plan B when none exists', () => {
    const res = computeLayoutDiffLayer(base({}))
    expect(res.panelRows[0]).toMatchObject({ id: '__pin__' })
    expect(res.overlays).toHaveLength(0)
  })

  it('reports no changes when the layout matches the ghost', () => {
    const sofa = piece({ id: 'sofa', type: 'sofa', x: 100, y: 100 })
    const res = computeLayoutDiffLayer(base({ furniture: [sofa], ghost: { rooms: [], furniture: [{ ...sofa }] } }))
    expect(res.panelRows.some((r) => r.id === '__same__')).toBe(true)
  })

  it('arrows moved pieces and tallies added / removed', () => {
    const res = computeLayoutDiffLayer(
      base({
        furniture: [
          piece({ id: 'sofa', name: 'Sofa', type: 'sofa', x: 100, y: 100 }), // moved from y=300
          piece({ id: 'lamp', name: 'Lamp', type: 'lamp', x: 200, y: 200, w: 40, h: 40 }), // added
        ],
        ghost: {
          rooms: [],
          furniture: [
            piece({ id: 'sofa', name: 'Sofa', type: 'sofa', x: 100, y: 300 }),
            piece({ id: 'bed', name: 'Bed', type: 'bed', x: 400, y: 400 }), // removed
          ],
        },
      }),
    )
    const summary = res.panelRows.find((r) => r.id === '__summary__')
    expect(summary?.detail).toContain('1 moved')
    expect(summary?.detail).toContain('1 added')
    expect(summary?.detail).toContain('1 removed')
    expect(res.panelRows.find((r) => r.id === 'mv-sofa')?.detail).toBe('moved 2 m')
    // ghost rects + an arrow (path + head polygon) + a removed ✕ badge
    expect(res.overlays.some((o) => o.kind === 'path')).toBe(true)
    expect(res.overlays.some((o) => o.kind === 'polygon')).toBe(true)
    expect(res.overlays.some((o) => o.kind === 'badge' && o.text === '✕')).toBe(true)
  })

  it('normalizePlan keeps and sanitizes a ghost, drops a malformed one', () => {
    const p = normalizePlan({ rooms: [], ghost: { rooms: [], furniture: [{ id: 'x', name: 'X', type: 'sofa', x: 0, y: 0, w: 10, h: 10, rotation: 0, color: 'url(evil)' }] } } as unknown as Partial<Plan>)
    expect(p.ghost?.furniture[0].color).not.toBe('url(evil)')
    expect(normalizePlan({ rooms: [] } as Partial<Plan>).ghost).toBeUndefined()
  })

  it('is a distinct registered layer', () => {
    expect(getLayer('layout-diff')?.label).toContain('Layout diff')
    expect(computeActiveLayers(base({ layers: ['layout-diff'] })).map((l) => l.id)).toEqual(['layout-diff'])
  })
})
