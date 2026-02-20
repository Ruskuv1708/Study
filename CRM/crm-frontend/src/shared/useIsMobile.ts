import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 900px)'

const readMatch = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(MOBILE_QUERY).matches
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(readMatch)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    mediaQuery.addEventListener('change', onChange)

    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

export default useIsMobile
