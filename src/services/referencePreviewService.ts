import {
  bookmarkExists,
  getActiveDocument,
  getApplication,
  getReferenceFieldInfoFromSelectionSync
} from './wpsApi'

export interface ReferencePreviewState {
  enabled: boolean
  bindMode: 'new-window' | 'off'
  autoSplitCreated: boolean
  mainWindow?: any
  previewWindow?: any
  lastPreviewBookmarkName?: string
  lastError?: string
}

export const REFERENCE_PREVIEW_STATE_EVENT = 'quickref-reference-preview-state'

const DOUBLE_CLICK_EVENT_NAME = 'WindowBeforeDoubleClick'
const WD_GO_TO_BOOKMARK = -1
const DO_NOT_SAVE_CHANGES = 0

const state = {
  enabled: false,
  bindMode: 'off',
  autoSplitCreated: false,
  mainWindow: null,
  previewWindow: null,
  mainPaneBound: false,
  previewPaneBound: false,
  doubleClickEnabled: false,
  lastPreviewBookmarkName: '',
  lastError: ''
}

let doubleClickHandler = null

export function getReferencePreviewState() {
  return { ...state }
}

export async function enableReferencePreviewMode() {
  getActiveDocument()
  const app = getApplication()
  const activeWindow = app.ActiveWindow

  if (!activeWindow) {
    throw new Error('当前没有可用的文档窗口。')
  }

  if (state.enabled && state.previewWindow) {
    return getReferencePreviewState()
  }

  resetPreviewBinding()

  try {
    const previewWindow = createPreviewWindow(activeWindow)
    state.enabled = true
    state.bindMode = 'new-window'
    state.autoSplitCreated = false
    state.mainWindow = activeWindow
    state.previewWindow = previewWindow
    state.mainPaneBound = true
    state.previewPaneBound = true
    state.lastError = ''

    tryActivateWindow(activeWindow)
    bindDoubleClickEvent()
    persistAndNotify()

    if (!state.doubleClickEnabled) {
      notifyUser('已创建预览窗口，但当前 WPS API 不支持稳定正文双击监听，双击预览未启用。')
    } else {
      notifyUser('引用目标新窗口预览已开启。可将新建标签拖出并放到右侧。')
    }
  } catch (error) {
    resetPreviewBinding()
    state.lastError = `创建预览窗口失败：${error.message || error}`
    persistAndNotify()
    notifyUser(state.lastError)
  }

  return getReferencePreviewState()
}

export async function closeReferencePreviewMode() {
  unbindDoubleClickEvent()

  const mainWindow = state.mainWindow
  const previewWindow = state.previewWindow

  tryClosePreviewWindow(previewWindow)
  tryActivateWindow(mainWindow)

  resetPreviewBinding()
  persistAndNotify()
  notifyUser('引用目标双窗预览已关闭。')

  return getReferencePreviewState()
}

export async function ensurePreviewTarget() {
  return ensurePreviewTargetSync()
}

export async function previewBookmarkInRightTarget(bookmarkName) {
  previewBookmarkInRightTargetSync(bookmarkName)
}

function createPreviewWindow(activeWindow) {
  if (!activeWindow || typeof activeWindow.NewWindow !== 'function') {
    throw new Error('当前 WPS 窗口不支持“新建窗口”。')
  }

  const previewWindow = activeWindow.NewWindow()
  if (!previewWindow) {
    throw new Error('WPS 未返回可用的预览窗口。')
  }

  return previewWindow
}

function bindDoubleClickEvent() {
  const app = getApplication()
  const apiEvent = app && app.ApiEvent

  if (!apiEvent || typeof apiEvent.AddApiEventListener !== 'function') {
    state.doubleClickEnabled = false
    state.lastError = '当前 WPS API 不支持稳定正文双击监听。'
    return
  }

  if (!doubleClickHandler) {
    doubleClickHandler = handleWindowBeforeDoubleClick
  }

  try {
    apiEvent.RemoveApiEventListener(DOUBLE_CLICK_EVENT_NAME, doubleClickHandler)
  } catch (error) {
    // 避免重复注册，移除失败不影响后续注册。
  }

  try {
    apiEvent.AddApiEventListener(DOUBLE_CLICK_EVENT_NAME, doubleClickHandler)
    state.doubleClickEnabled = true
  } catch (error) {
    state.doubleClickEnabled = false
    state.lastError = `双击事件无法注册：${error.message || error}`
  }
}

function unbindDoubleClickEvent() {
  const app = getApplication()
  const apiEvent = app && app.ApiEvent

  if (!apiEvent || typeof apiEvent.RemoveApiEventListener !== 'function' || !doubleClickHandler) {
    return
  }

  try {
    apiEvent.RemoveApiEventListener(DOUBLE_CLICK_EVENT_NAME, doubleClickHandler)
  } catch (error) {
    state.lastError = `双击事件解绑失败：${error.message || error}`
  }
}

function handleWindowBeforeDoubleClick(...eventArgs) {
  if (!state.enabled) {
    return true
  }

  try {
    const selection = getSelectionFromEventArgs(eventArgs)
    const fieldInfo = getReferenceFieldInfoFromSelectionSync(selection)

    if (!fieldInfo) {
      return true
    }

    if (!bookmarkExists(fieldInfo.bookmarkName)) {
      setLastError(`引用书签不存在：${fieldInfo.bookmarkName}`)
      notifyUser(`引用书签不存在：${fieldInfo.bookmarkName}`)
      return true
    }

    ensurePreviewTargetSync()
    if (!setCancelForEvent(eventArgs)) {
      setLastError('当前 WPS 双击事件未暴露可取消参数，无法阻止默认跳转。')
      notifyUser('当前 WPS API 不支持稳定取消正文双击默认行为，双击预览未执行。')
      return true
    }

    previewBookmarkInRightTargetSync(fieldInfo.bookmarkName)
    state.lastPreviewBookmarkName = fieldInfo.bookmarkName
    state.lastError = ''
    persistAndNotify()
    return false
  } catch (error) {
    setLastError(error.message || error)
    notifyUser(error.message || error)
    return true
  }
}

function getSelectionFromEventArgs(eventArgs) {
  return eventArgs.find((item) => item && item.Range)
}

function setCancelForEvent(eventArgs) {
  let didSetCancel = false
  for (const item of eventArgs) {
    try {
      if (item && 'Cancel' in item) {
        item.Cancel = true
        didSetCancel = true
      }
    } catch (error) {
      // 部分 WPS 事件参数是 COM 代理对象，不能可靠枚举属性。
    }
  }

  try {
    const app = getApplication()
    app.ApiEvent.Cancel = true
    didSetCancel = true
  } catch (error) {
    state.lastError = '当前 WPS 双击事件未暴露可取消参数，无法阻止默认跳转。'
  }
  return didSetCancel
}

function ensurePreviewTargetSync() {
  if (!state.enabled) {
    throw new Error('引用目标双窗预览未开启。')
  }

  if (!state.previewWindow) {
    throw new Error('预览窗口引用丢失，请重新开启引用目标双窗预览。')
  }

  return state.previewWindow
}

function previewBookmarkInRightTargetSync(bookmarkName) {
  if (!bookmarkExists(bookmarkName)) {
    throw new Error(`引用书签不存在：${bookmarkName}`)
  }

  const previewWindow = ensurePreviewTargetSync()
  const mainWindow = state.mainWindow

  activatePreviewWindow(previewWindow)
  goToBookmarkInPreviewWindow(previewWindow, bookmarkName)
  tryActivateWindow(mainWindow)
}

function activatePreviewWindow(previewWindow) {
  try {
    previewWindow.Activate()
  } catch (error) {
    throw new Error(`激活预览窗口失败：${error.message || error}`)
  }
}

function goToBookmarkInPreviewWindow(previewWindow, bookmarkName) {
  try {
    if (previewWindow.Selection && typeof previewWindow.Selection.GoTo === 'function') {
      previewWindow.Selection.GoTo(WD_GO_TO_BOOKMARK, undefined, undefined, bookmarkName)
      return
    }
  } catch (error) {
    // 某些 WPS 版本不支持 Window.Selection.GoTo，继续尝试书签 Range.Select。
  }

  selectBookmarkRangeInPreviewWindow(previewWindow, bookmarkName)
}

function selectBookmarkRangeInPreviewWindow(previewWindow, bookmarkName) {
  try {
    const doc = getPreviewDocument(previewWindow)
    doc.Bookmarks.Item(bookmarkName).Select()
  } catch (error) {
    throw new Error(`预览窗口跳转失败：${error.message || error}`)
  }
}

function getPreviewDocument(previewWindow) {
  try {
    if (previewWindow && previewWindow.Document) {
      return previewWindow.Document
    }
  } catch (error) {
    // 拖出标签后的窗口对象可能不支持稳定读取 Document，使用激活后的 ActiveDocument。
  }
  return getActiveDocument()
}

function tryClosePreviewWindow(previewWindow) {
  try {
    if (previewWindow && typeof previewWindow.Close === 'function') {
      previewWindow.Close(DO_NOT_SAVE_CHANGES)
    }
  } catch (error) {
    state.lastError = `预览窗口可能已被关闭，已清理插件状态：${error.message || error}`
  }
}

function tryActivateWindow(windowObject) {
  try {
    if (windowObject) {
      windowObject.Activate()
    }
  } catch (error) {
    state.lastError = `恢复主窗口焦点失败：${error.message || error}`
  }
}

function setLastError(errorText) {
  state.lastError = String(errorText || '')
  persistAndNotify()
}

function resetPreviewBinding() {
  state.enabled = false
  state.bindMode = 'off'
  state.autoSplitCreated = false
  state.mainWindow = null
  state.previewWindow = null
  state.mainPaneBound = false
  state.previewPaneBound = false
  state.doubleClickEnabled = false
}

function persistAndNotify() {
  const status = {
    enabled: state.enabled,
    bindMode: state.bindMode,
    autoSplitCreated: state.autoSplitCreated,
    mainPaneBound: state.mainPaneBound,
    previewPaneBound: state.previewPaneBound,
    doubleClickEnabled: state.doubleClickEnabled,
    lastPreviewBookmarkName: state.lastPreviewBookmarkName,
    lastError: state.lastError
  }

  try {
    window.localStorage.setItem(REFERENCE_PREVIEW_STATE_EVENT, JSON.stringify(status))
  } catch (error) {
    // 状态展示失败不影响预览功能。
  }

  try {
    const app = getApplication()
    if (app && app.PluginStorage) {
      app.PluginStorage.setItem(REFERENCE_PREVIEW_STATE_EVENT, JSON.stringify(status))
    }
  } catch (error) {
    // 状态展示失败不影响预览功能。
  }

  window.dispatchEvent(new CustomEvent(REFERENCE_PREVIEW_STATE_EVENT, { detail: status }))
}

function notifyUser(message) {
  if (!message) {
    return
  }
  try {
    window.alert(message)
  } catch (error) {
    console.warn(message)
  }
}
