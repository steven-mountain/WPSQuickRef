const CLOSE_FALLBACK_DELAY = 150

export function notifyAndClose(message) {
  saveLastDialogMessage(message)
  window.setTimeout(closeDialogSafely, 0)
}

export function closeDialogSafely() {
  try {
    window.close()
  } catch (error) {
    console.warn('关闭弹窗失败', error)
  }

  window.setTimeout(closeByHostFallback, CLOSE_FALLBACK_DELAY)
}

function closeByHostFallback() {
  const app = window.Application
  const closeMethods = [
    () => {
      if (window.external && typeof window.external.close === 'function') {
        window.external.close()
        return true
      }
      return false
    },
    () => {
      if (window.external && typeof window.external.Close === 'function') {
        window.external.Close()
        return true
      }
      return false
    },
    () => {
      if (app && typeof app.closeDialog === 'function') {
        app.closeDialog()
        return true
      }
      return false
    },
    () => {
      if (app && typeof app.CloseDialog === 'function') {
        app.CloseDialog()
        return true
      }
      return false
    }
  ]

  for (const close of closeMethods) {
    try {
      if (close()) {
        return
      }
    } catch (error) {
      // Try the next host close API.
    }
  }
}

function saveLastDialogMessage(message) {
  try {
    window.sessionStorage.setItem('quickref.lastDialogMessage', String(message || ''))
  } catch (error) {
    // Best-effort only; dialog closing must not depend on storage.
  }
}
