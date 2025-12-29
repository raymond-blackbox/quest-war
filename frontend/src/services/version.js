/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
const VERSION_ENDPOINT = '/version.json'
const RELOAD_KEY = 'quest-war:version-reload'

export const appVersion = APP_VERSION

const safeSessionStorageGet = (key) => {
  try {
    return sessionStorage.getItem(key)
  } catch (error) {
    return null
  }
}

const safeSessionStorageSet = (key, value) => {
  try {
    sessionStorage.setItem(key, value)
  } catch (error) {
  }
}

export const getReloadBlockedVersion = () => safeSessionStorageGet(RELOAD_KEY)

const markReloadAttempt = (version) => safeSessionStorageSet(RELOAD_KEY, version)

export const buildReloadUrl = (version) => {
  if (typeof window === 'undefined') {
    return '/'
  }

  const url = new URL(window.location.href)
  url.searchParams.set('v', version)
  return url.toString()
}

export const fetchVersionInfo = async ({ cacheBust = false } = {}) => {
  const url = cacheBust ? `${VERSION_ENDPOINT}?t=${Date.now()}` : VERSION_ENDPOINT
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to load ${VERSION_ENDPOINT}`)
  }

  const data = await response.json()

  return {
    version: typeof data.version === 'string' ? data.version : APP_VERSION,
    message: typeof data.message === 'string' ? data.message : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  }
}

export const checkForVersionUpdate = async () => {
  try {
    const latest = await fetchVersionInfo({ cacheBust: true })

    if (!latest.version || latest.version === APP_VERSION) {
      return { status: 'current', latest }
    }

    const lastReload = getReloadBlockedVersion()
    if (lastReload === latest.version) {
      return { status: 'blocked', latest }
    }

    markReloadAttempt(latest.version)
    window.location.replace(buildReloadUrl(latest.version))
    return { status: 'reloading', latest }
  } catch (error) {
    return { status: 'error', error }
  }
}
