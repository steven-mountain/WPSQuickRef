export const REF_SOURCE_REFRESH_KEY = 'quickref.refSources.refreshTick'

export function notifyRefSourcesChanged() {
  const tick = `${Date.now()}`
  try {
    window.localStorage.setItem(REF_SOURCE_REFRESH_KEY, tick)
  } catch (error) {
    console.warn('发送引用源刷新通知失败', error)
  }

  try {
    if (window.Application && window.Application.PluginStorage) {
      window.Application.PluginStorage.setItem(REF_SOURCE_REFRESH_KEY, tick)
    }
  } catch (error) {
    console.warn('发送 WPS 引用源刷新通知失败', error)
  }
}

export function getRefSourcesChangeTick() {
  try {
    return window.localStorage.getItem(REF_SOURCE_REFRESH_KEY) || ''
  } catch (error) {
    return ''
  }
}
