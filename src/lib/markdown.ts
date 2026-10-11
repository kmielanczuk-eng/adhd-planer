/** Mini-markdown: nagłówki, pogrubienie, kursywa, listy, checkboxy, linki, cytaty, kod, ==zakreślenie==. Bezpieczny (najpierw escapuje HTML). */
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
}

export function renderMarkdown(src: string): string {
  const lines = src.split(/\r?\n/)
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  lines.forEach((line, idx) => {
    let m: RegExpMatchArray | null
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      closeList()
      const n = m[1].length
      out.push(`<h${n}>${inline(m[2])}</h${n}>`)
    } else if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      const checked = m[1].toLowerCase() === 'x'
      out.push(
        `<li class="check"><label><input type="checkbox" data-line="${idx}" ${checked ? 'checked' : ''}/> <span${checked ? ' style="text-decoration:line-through;opacity:.6"' : ''}>${inline(m[2])}</span></label></li>`,
      )
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') {
        closeList()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      closeList()
      out.push(`<blockquote>${inline(m[1])}</blockquote>`)
    } else if (!line.trim()) {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  })
  closeList()
  return out.join('\n')
}

/** Przełącza checkbox w danej linii źródła. */
export function toggleCheckboxLine(src: string, lineIdx: number): string {
  const lines = src.split(/\r?\n/)
  const l = lines[lineIdx]
  if (l == null) return src
  lines[lineIdx] = l.replace(/\[( |x|X)\]/, (_, c: string) => (c.trim() ? '[ ]' : '[x]'))
  return lines.join('\n')
}

export function plainPreview(src: string, max = 120): string {
  return src
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\[( |x|X)\]\s*/g, '')
    .replace(/[*_`=>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
