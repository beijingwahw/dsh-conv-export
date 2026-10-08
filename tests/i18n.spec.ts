import { afterEach, describe, expect, it } from 'vitest'
import { t } from '../src/client/i18n.ts'

/** Original language properties restored after each case. */
const originalLang = document.documentElement.lang
const originalNavigator = Object.getOwnPropertyDescriptor(navigator, 'language')

afterEach(() => {
  document.documentElement.lang = originalLang
  if (originalNavigator !== undefined) {
    Object.defineProperty(navigator, 'language', originalNavigator)
  }
})

/** Force one language source for the next assertion. */
function setLanguage(lang: string | undefined): void {
  document.documentElement.lang = lang ?? ''
  Object.defineProperty(navigator, 'language', {
    value: lang ?? 'en-US',
    configurable: true,
  })
}

describe('i18n language resolution', () => {
  it('follows <html lang> = zh-CN', () => {
    setLanguage('zh-CN')
    expect(t('menu.select')).toBe('选择回合导出…')
    expect(t('role.assistant')).toBe('助手')
  })

  it('follows <html lang> = en', () => {
    setLanguage('en-US')
    expect(t('menu.select')).toBe('Select turns…')
    expect(t('role.assistant')).toBe('Assistant')
  })

  it('reacts to a language switch instead of caching the first answer', () => {
    setLanguage('en-US')
    expect(t('menu.select')).toBe('Select turns…')
    setLanguage('zh-CN')
    expect(t('menu.select')).toBe('选择回合导出…')
  })

  it('treats the untouched product default "en" as unset and uses the browser language', () => {
    // 静态 index.html 声明 lang="en"（产品默认），locale 插件尚未写入；
    // 此时中文系统应拿到中文，而不是被钉在英文。
    setLanguage(undefined)
    document.documentElement.lang = 'en'
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true })
    expect(t('menu.select')).toBe('选择回合导出…')
  })
})
