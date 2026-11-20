import { useEffect, useRef, useState } from 'react'

// Loads data when the screen opens and quietly re-reads it whenever the tab regains focus or becomes visible, so a
// number never goes stale after the user did something elsewhere. Only the first load shows a loading state; if a
// background refresh fails the last good data stays on screen. `deps` restart the whole load (for example a new role).
export default function useLiveData(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    const load = (initial) => {
      if (initial) setState((s) => ({ ...s, loading: true, error: null }))
      Promise.resolve()
        .then(() => fetchRef.current())
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: null })
        })
        .catch((err) => {
          if (cancelled) return
          if (initial) setState({ data: null, loading: false, error: err?.message ?? 'Something went wrong' })
        })
    }
    load(true)
    const refresh = () => { if (document.visibilityState !== 'hidden') load(false) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
