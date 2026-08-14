import { describe, expect, it } from 'vitest'
import { buildMarkdown, htmlToMarkdown } from '../src/client/markdown.ts'

describe('htmlToMarkdown', () => {
  it('serializes headings, emphasis, and inline code', () => {
    const md = htmlToMarkdown('<h1>标题</h1><p>这是<strong>加粗</strong>与<em>斜体</em>和<code>code</code></p>')
    expect(md).toContain('# 标题')
    expect(md).toContain('**加粗**')
    expect(md).toContain('*斜体*')
    expect(md).toContain('`code`')
  })

  it('serializes fenced code with language', () => {
    const md = htmlToMarkdown('<pre><code class="language-python">def f():\n    return 1</code></pre>')
    expect(md).toContain('```python')
    expect(md).toContain('def f():')
    expect(md).toContain('```')
  })

  it('serializes nested lists', () => {
    const md = htmlToMarkdown('<ul><li>一<ul><li>子</li></ul></li><li>二</li></ul>')
    expect(md).toContain('- 一')
    expect(md).toContain('  - 子')
    expect(md).toContain('- 二')
  })

  it('serializes ordered lists', () => {
    const md = htmlToMarkdown('<ol><li>a</li><li>b</li></ol>')
    expect(md).toContain('1. a')
    expect(md).toContain('2. b')
  })

  it('serializes tables and blockquotes', () => {
    const md = htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>')
    expect(md).toContain('| A | B |')
    expect(md).toContain('| --- | --- |')
    expect(md).toContain('| 1 | 2 |')
    const bq = htmlToMarkdown('<blockquote><p>引用</p></blockquote>')
    expect(bq).toContain('> 引用')
  })

  it('serializes links', () => {
    const md = htmlToMarkdown('<p><a href="https://x.dev">站点</a></p>')
    expect(md).toContain('[站点](https://x.dev)')
  })
})

describe('buildMarkdown', () => {
  it('assembles title and role sections in order', () => {
    const md = buildMarkdown('会话标题', [
      { role: 'user', text: '问题', html: '' },
      { role: 'assistant', text: '', html: '<h2>答</h2>' },
    ])
    expect(md.startsWith('# 会话标题')).toBe(true)
    const userIdx = md.indexOf('### ')
    expect(md).toContain('### User') // en dict in jsdom (navigator.language en-US)
    expect(userIdx).toBeGreaterThan(-1)
    expect(md.indexOf('## 答')).toBeGreaterThan(md.indexOf('问题'))
  })
})
