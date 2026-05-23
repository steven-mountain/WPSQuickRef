<template>
  <section class="preview-status">
    <div class="preview-header">
      <h2>引用目标双窗预览</h2>
      <span :class="['badge', status.enabled ? 'on' : 'off']">{{ status.enabled ? '开启' : '关闭' }}</span>
    </div>

    <div class="preview-actions">
      <button class="primary" :disabled="status.enabled" @click="enablePreview">开启引用目标双窗预览</button>
      <button :disabled="!status.enabled" @click="closePreview">关闭引用目标双窗预览</button>
    </div>

    <dl>
      <div>
        <dt>预览模式</dt>
        <dd>{{ status.enabled ? '已开启' : '未开启' }}</dd>
      </div>
      <div>
        <dt>窗格模式</dt>
        <dd>{{ bindModeText }}</dd>
      </div>
      <div>
        <dt>主审阅窗格</dt>
        <dd>{{ status.mainPaneBound ? '已绑定' : '未绑定' }}</dd>
      </div>
      <div>
        <dt>预览窗格</dt>
        <dd>{{ status.previewPaneBound ? '已绑定' : '未绑定' }}</dd>
      </div>
      <div>
        <dt>双击预览</dt>
        <dd>{{ status.doubleClickEnabled ? '已启用' : '未启用' }}</dd>
      </div>
      <div>
        <dt>最近预览引用</dt>
        <dd>{{ status.lastPreviewBookmarkName || '无' }}</dd>
      </div>
      <div>
        <dt>最近错误信息</dt>
        <dd :class="{ error: status.lastError }">{{ status.lastError || '无' }}</dd>
      </div>
    </dl>
  </section>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  closeReferencePreviewMode,
  enableReferencePreviewMode,
  getReferencePreviewState,
  REFERENCE_PREVIEW_STATE_EVENT
} from '../services/referencePreviewService'

export default {
  name: 'ReferencePreviewStatus',
  setup() {
    const status = ref(readPersistedStatus())
    let refreshTimer = null

    const bindModeText = computed(() => {
      if (status.value.bindMode === 'auto-horizontal-split') {
        return '自动上下拆分'
      }
      return '未绑定'
    })

    onMounted(() => {
      window.addEventListener(REFERENCE_PREVIEW_STATE_EVENT, handleStateEvent)
      window.addEventListener('storage', handleStorageEvent)
      refreshTimer = window.setInterval(refreshStatus, 1200)
    })

    onUnmounted(() => {
      window.removeEventListener(REFERENCE_PREVIEW_STATE_EVENT, handleStateEvent)
      window.removeEventListener('storage', handleStorageEvent)
      if (refreshTimer) {
        window.clearInterval(refreshTimer)
      }
    })

    async function enablePreview() {
      try {
        status.value = await enableReferencePreviewMode()
      } catch (error) {
        status.value = { ...status.value, lastError: error.message || String(error) }
        window.alert(error.message || error)
      }
    }

    async function closePreview() {
      try {
        status.value = await closeReferencePreviewMode()
      } catch (error) {
        status.value = { ...status.value, lastError: error.message || String(error) }
        window.alert(error.message || error)
      }
    }

    function handleStateEvent(event) {
      if (event.detail) {
        status.value = normalizeStatus(event.detail)
      }
    }

    function handleStorageEvent(event) {
      if (event.key === REFERENCE_PREVIEW_STATE_EVENT) {
        refreshStatus()
      }
    }

    function refreshStatus() {
      status.value = readPersistedStatus()
    }

    return {
      status,
      bindModeText,
      enablePreview,
      closePreview
    }
  }
}

function readPersistedStatus() {
  try {
    const stored = window.localStorage.getItem(REFERENCE_PREVIEW_STATE_EVENT)
    if (stored) {
      return normalizeStatus(JSON.parse(stored))
    }
  } catch (error) {
    // 本地状态不可读时使用当前页面内存状态。
  }
  return normalizeStatus(getReferencePreviewState())
}

function normalizeStatus(status) {
  return {
    enabled: !!status.enabled,
    bindMode: status.bindMode || 'off',
    autoSplitCreated: !!status.autoSplitCreated,
    mainPaneBound: !!status.mainPaneBound || !!status.mainPane,
    previewPaneBound: !!status.previewPaneBound || !!status.previewPane,
    doubleClickEnabled: !!status.doubleClickEnabled,
    lastPreviewBookmarkName: status.lastPreviewBookmarkName || status.lastBookmarkName || '',
    lastError: status.lastError || ''
  }
}
</script>

<style scoped>
.preview-status {
  margin-top: 10px;
  border: 1px solid #d8dee8;
  border-radius: 6px;
  background: #fff;
  padding: 8px;
}
.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
}
.badge {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
}
.badge.on {
  background: #e9f8ef;
  color: #1f7a3f;
}
.badge.off {
  background: #eef2f7;
  color: #667085;
}
.preview-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-top: 8px;
}
button {
  min-height: 26px;
  border: 1px solid #c9ced6;
  border-radius: 4px;
  background: #fff;
  padding: 0 8px;
  color: #1f2328;
  font-size: 12px;
}
button:disabled {
  color: #98a2b3;
  background: #f2f4f7;
}
.primary:not(:disabled) {
  border-color: #1769e0;
  background: #1769e0;
  color: #fff;
}
dl {
  display: grid;
  gap: 5px;
  margin: 8px 0 0;
}
dl div {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 6px;
}
dt {
  color: #667085;
}
dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: #1f2328;
}
dd.error {
  color: #b42318;
}
</style>
