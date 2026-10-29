import { describe, expect, it } from 'vitest'
import { placeMenu } from '../src/client/place.ts'

/** 常见桌面视口（上一版实测 GUI 约 1382×904，这里取整）。 */
const VIEWPORT = { width: 1280, height: 800 }
/** 菜单实测尺寸量级：6 项 + 分隔线 + 内边距。 */
const MENU = { width: 240, height: 244 }

describe('placeMenu', () => {
  it('空间充足时向按钮下方展开，间距 6px', () => {
    const p = placeMenu({ top: 100, bottom: 128, right: 600 }, MENU, VIEWPORT)
    expect(p.dir).toBe('down')
    expect(p.top).toBe(134)
  })

  it('下方放不下时翻到按钮上方', () => {
    const p = placeMenu({ top: 700, bottom: 728, right: 600 }, MENU, VIEWPORT)
    expect(p.dir).toBe('up')
    expect(p.top).toBe(700 - 6 - 244)
  })

  it('上翻时不会越过视口顶部', () => {
    const p = placeMenu({ top: 300, bottom: 328, right: 600 }, { width: 240, height: 260 }, VIEWPORT)
    expect(p.dir).toBe('up')
    expect(p.top).toBe(34)
    expect(p.top).toBeGreaterThanOrEqual(8)
  })

  it('上下都放不下时贴边夹取（矮视口兜底）', () => {
    const tight = placeMenu(
      { top: 300, bottom: 328, right: 600 },
      { width: 240, height: 500 },
      { width: 1280, height: 420 },
    )
    expect(tight.dir).toBe('down')
    expect(tight.top).toBe(8)
  })

  it('右边缘溢出时向左夹取', () => {
    const p = placeMenu({ top: 100, bottom: 128, right: 1279 }, MENU, VIEWPORT)
    expect(p.left).toBe(1280 - 240 - 8)
  })

  it('左边缘溢出时贴左夹取', () => {
    const p = placeMenu({ top: 100, bottom: 128, right: 60 }, MENU, VIEWPORT)
    expect(p.left).toBe(8)
  })

  it('恰好放得下时仍向下展开', () => {
    const p = placeMenu(
      { top: 500, bottom: 528, right: 600 },
      MENU,
      { width: 1280, height: 528 + 6 + 244 + 8 },
    )
    expect(p.dir).toBe('down')
  })
})
