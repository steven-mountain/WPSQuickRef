import Util from './js/util.js'
import { registerContextMenu } from '../services/contextMenu'
import { listInvalidRefs, updateAllFields } from '../services/wpsApi'
import { closeReferencePreviewMode, enableReferencePreviewMode } from '../services/referencePreviewService'

function OnAddinLoad(ribbonUI) {
  if (typeof window.Application.ribbonUI != 'object') {
    window.Application.ribbonUI = ribbonUI
  }

  if (typeof window.Application.Enum != 'object') {
    window.Application.Enum = Util.WPS_Enum
  }

  registerContextMenu()
  return true
}

function OnAction(control) {
  const eleId = control.Id
  switch (eleId) {
    case 'btnCreateRefSource':
      showCreateDialog()
      break
    case 'btnInsertPageRef':
      showInsertDialog()
      break
    case 'btnRefManager':
      toggleTaskPane()
      break
    case 'btnUpdateAllRefs':
      handleUpdateAllRefs()
      break
    case 'btnCheckInvalidRefs':
      handleCheckInvalidRefs()
      break
    case 'btnEnableReferencePreview':
      handleEnableReferencePreview()
      break
    case 'btnCloseReferencePreview':
      handleCloseReferencePreview()
      break
    default:
      break
  }
  return true
}

function GetImage(control) {
  const eleId = control.Id
  switch (eleId) {
    case 'btnCreateRefSource':
      return 'images/1.svg'
    case 'btnInsertPageRef':
      return 'images/2.svg'
    case 'btnRefManager':
      return 'images/3.svg'
    default:
      return 'images/newFromTemp.svg'
  }
}

function OnGetEnabled() {
  return true
}

function OnGetVisible() {
  return true
}

function OnGetLabel() {
  return ''
}

function showCreateDialog() {
  window.Application.ShowDialog(
    Util.GetUrlPath() + Util.GetRouterHash() + '/create-ref-source',
    '创建引用源',
    420 * window.devicePixelRatio,
    420 * window.devicePixelRatio,
    true
  )
}

function showInsertDialog() {
  window.Application.ShowDialog(
    Util.GetUrlPath() + Util.GetRouterHash() + '/insert-ref',
    '插入页码引用',
    520 * window.devicePixelRatio,
    520 * window.devicePixelRatio,
    true
  )
}

function toggleTaskPane() {
  let taskPaneId = window.Application.PluginStorage.getItem('quickref_taskpane_id')
  if (!taskPaneId) {
    let taskPane = window.Application.CreateTaskPane(
      Util.GetUrlPath() + Util.GetRouterHash() + '/taskpane',
      '引用源管理'
    )
    window.Application.PluginStorage.setItem('quickref_taskpane_id', taskPane.ID)
    taskPane.Visible = true
    return
  }

  let taskPane = window.Application.GetTaskPane(taskPaneId)
  taskPane.Visible = !taskPane.Visible
}

function handleUpdateAllRefs() {
  try {
    updateAllFields()
    alert('已更新全部引用字段。')
  } catch (error) {
    alert(error.message || error)
  }
}

function handleCheckInvalidRefs() {
  try {
    const invalidRefs = listInvalidRefs()
    alert(`检查完成，发现 ${invalidRefs.length} 个失效引用。可在“引用源管理”任务窗格中查看和跳转。`)
  } catch (error) {
    alert(error.message || error)
  }
}

async function handleEnableReferencePreview() {
  try {
    await enableReferencePreviewMode()
  } catch (error) {
    alert(error.message || error)
  }
}

async function handleCloseReferencePreview() {
  try {
    await closeReferencePreviewMode()
  } catch (error) {
    alert(error.message || error)
  }
}

export default {
  OnAddinLoad,
  OnAction,
  GetImage,
  OnGetEnabled,
  OnGetVisible,
  OnGetLabel
}
