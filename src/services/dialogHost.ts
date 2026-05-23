export function notifyAndClose(message) {
  alert(message)
  setTimeout(closeDialogSafely, 80)
}

export function closeDialogSafely() {
  const app = window.Application
  const closeMethods = [
    () => {
      if (app && typeof app.CloseDialog === 'function') {
        app.CloseDialog()
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
      if (window.external && typeof window.external.Close === 'function') {
        window.external.Close()
        return true
      }
      return false
    },
    () => {
      if (window.external && typeof window.external.close === 'function') {
        window.external.close()
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
      // 尝试下一个宿主关闭接口。
    }
  }

  try {
    window.close()
  } catch (error) {
    console.warn('关闭弹窗失败', error)
  }
}
