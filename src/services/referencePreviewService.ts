import {
  bookmarkExists,
  getActiveDocument,
  getApplication,
  getReferenceFieldInfoFromSelectionSync
} from './wpsApi'

export interface ReferencePreviewState {
  enabled: boolean
  bindMode: 'auto-horizontal-split' | 'off'
  autoSplitCreated: boolean
  mainWindow?: any
  mainPane?: any
  previewPane?: any
  lastPreviewBookmarkName?: string
  lastError?: string
}

export const REFERENCE_PREVIEW_STATE_EVENT = 'quickref-reference-preview-state'

const DOUBLE_CLICK_EVENT_NAME = 'WindowBeforeDoubleClick'
const SPLIT_PERCENT = 50

const state = {
  enabled: false,
  bindMode: 'off',
  autoSplitCreated: false,
  mainWindow: null,
  mainPane: null,
  previewPane: null,
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

  if (state.enabled && state.previewPaneBound) {
    return getReferencePreviewState()
  }

  resetPreviewBinding()

  try {
    createHorizontalSplit(activeWindow)
    bindSplitPanes(activeWindow, 'auto-horizontal-split', true, getDefaultHorizontalPanes(activeWindow))
    bindDoubleClickEvent()
    persistAndNotify()

    if (!state.doubleClickEnabled) {
      notifyUser('已创建上下预览窗格，但当前 WPS API 不支持稳定正文双击监听，双击预览未启用。')
    } else {
      notifyUser('引用目标双窗预览已开启。')
    }
  } catch (error) {
    resetPreviewBinding()
    state.lastError = `创建上下预览窗格失败：${error.message || error}`
    persistAndNotify()
    notifyUser(state.lastError)
  }

  return getReferencePreviewState()
}

export async function closeReferencePreviewMode() {
  unbindDoubleClickEvent()

  const mainWindow = state.mainWindow
  const shouldCloseAutoSplit = state.autoSplitCreated

  if (shouldCloseAutoSplit) {
    closeAutoSplit()
  }

  tryActivatePane(state.mainPane)
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

function createHorizontalSplit(activeWindow) {
  if (!activeWindow || !activeWindow.Panes) {
    throw new Error('当前窗口不支持拆分窗格。')
  }

  if (getPaneCount(activeWindow) >= 2) {
    closeExistingSplit(activeWindow)
  }

  try {
    if (typeof activeWindow.Panes.Add === 'function') {
      activeWindow.Panes.Add(SPLIT_PERCENT)
    } else {
      activeWindow.Split = true
    }
  } catch (error) {
    throw new Error(error.message || error)
  }

  if (getPaneCount(activeWindow) < 2) {
    throw new Error('无法创建第二个预览窗格。')
  }
}

function closeExistingSplit(activeWindow) {
  try {
    activeWindow.Split = false
  } catch (error) {
    // 如果 WPS 不允许关闭现有拆分，继续尝试复用当前拆分。
  }
}

function bindSplitPanes(activeWindow, bindMode, autoSplitCreated, panes) {
  if (getPaneCount(activeWindow) < 2) {
    throw new Error('当前窗口尚未拆分。')
  }

  state.enabled = true
  state.bindMode = bindMode
  state.autoSplitCreated = autoSplitCreated
  state.mainWindow = activeWindow
  state.mainPane = panes.mainPane
  state.previewPane = panes.previewPane
  state.mainPaneBound = true
  state.previewPaneBound = true
  state.lastError = ''
}

function getDefaultHorizontalPanes(activeWindow) {
  return {
    mainPane: activeWindow.Panes.Item(1),
    previewPane: activeWindow.Panes.Item(2)
  }
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

  if (!state.mainPaneBound || !state.previewPaneBound || !state.mainPane || !state.previewPane) {
    throw new Error('当前拆分窗格不可用，请重新开启引用目标双窗预览。')
  }

  return state.previewPane
}

function previewBookmarkInRightTargetSync(bookmarkName) {
  if (!bookmarkExists(bookmarkName)) {
    throw new Error(`引用书签不存在：${bookmarkName}`)
  }

  const doc = getActiveDocument()
  const bookmarkRange = doc.Bookmarks.Item(bookmarkName).Range
  const mainPane = state.mainPane
  const target = ensurePreviewTargetSync()

  target.Activate()
  bookmarkRange.Select()
  tryActivatePane(mainPane)
}

function closeAutoSplit() {
  const previewPane = state.previewPane
  const mainWindow = state.mainWindow

  try {
    if (previewPane && typeof previewPane.Close === 'function') {
      previewPane.Close()
      return
    }
  } catch (error) {
    state.lastError = `关闭预览窗格失败：${error.message || error}`
  }

  try {
    if (mainWindow) {
      mainWindow.Split = false
    }
  } catch (error) {
    state.lastError = `恢复原窗口失败：${error.message || error}`
  }
}

function getPaneCount(windowObject) {
  try {
    return windowObject && windowObject.Panes ? windowObject.Panes.Count || 0 : 0
  } catch (error) {
    return 0
  }
}

function tryActivatePane(pane) {
  try {
    if (pane && typeof pane.Activate === 'function') {
      pane.Activate()
    }
  } catch (error) {
    state.lastError = `恢复主审阅窗格焦点失败：${error.message || error}`
  }
}

function tryActivateWindow(windowObject) {
  try {
    if (windowObject && typeof windowObject.Activate === 'function') {
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
  state.mainPane = null
  state.previewPane = null
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
