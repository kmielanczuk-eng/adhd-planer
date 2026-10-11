import { useSyncExternalStore } from 'react'

export interface Route {
  path: string
  parts: string[]
  query: URLSearchParams
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/dzis'
  const [p, q = ''] = raw.split('?')
  const path = p.startsWith('/') ? p : '/' + p
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(q) }
}

let current = parse()
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  current = parse()
  listeners.forEach((l) => l())
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

export function navigate(path: string, replace = false) {
  const url = '#' + path
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
  current = parse()
  listeners.forEach((l) => l())
  window.scrollTo({ top: 0 })
}
