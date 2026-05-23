<template>
  <main class="manager">
    <header class="topbar">
      <div>
        <h1>引用助手</h1>
        <p>书签页码交叉引用管理</p>
      </div>
      <button class="ghost" @click="load">刷新</button>
    </header>

    <div class="toolbar">
      <button class="primary" @click="openCreateDialog">创建引用源</button>
      <button @click="openInsertDialog">插入页码引用</button>
      <button @click="updateFields">更新全部引用</button>
      <button @click="checkInvalidRefs">检查失效引用</button>
    </div>

    <input v-model.trim="keyword" class="search" placeholder="搜索名称、书签或预览" />

    <div class="density">
      <span>列表密度</span>
      <div>
        <button :class="{ active: densityMode === 'fold' }" @click="densityMode = 'fold'">折叠</button>
        <button :class="{ active: densityMode === 'compact' }" @click="setCompact">紧凑</button>
      </div>
    </div>

    <p v-if="message" :class="['message', messageType]">{{ message }}</p>
    <p class="summary">
      共 <strong>{{ filteredSources.length }}</strong> 个引用源，失效引用
      <strong :class="{ danger: invalidRefs.length }">{{ invalidRefs.length }}</strong> 个。
    </p>

    <section class="list">
      <article
        v-for="source in filteredSources"
        :key="source.bookmarkName"
        :class="['row', { expanded: isExpanded(source), lost: source.status === '书签丢失' }]"
        @click="toggle(source)"
      >
        <div class="row-main">
          <div class="row-text">
            <div class="title-line">
              <input
                v-if="editingBookmark === source.bookmarkName"
                v-model.trim="editingName"
                class="rename-input"
                @click.stop
                @keyup.enter="saveRename(source)"
              />
              <strong v-else>{{ source.displayName }}</strong>
              <span :class="['status', source.status === '正常' ? 'ok' : 'warn']">{{ source.status }}</span>
            </div>
            <div class="meta">
              {{ source.bookmarkName }} · 第 {{ source.page || '未知' }} 页 · 引用
              {{ source.referenceCount }} 次
            </div>
          </div>

          <div class="quick-actions" @click.stop>
            <button class="insert" :disabled="source.status === '书签丢失'" @click="insert(source)">插入</button>
            <button v-if="editingBookmark === source.bookmarkName" class="icon" @click="saveRename(source)">
              保存
            </button>
            <button v-else-if="densityMode === 'fold'" class="icon" @click="toggle(source)">
              {{ isExpanded(source) ? '收起' : '编辑' }}
            </button>
          </div>
        </div>

        <div v-if="isExpanded(source)" class="details" @click.stop>
          <p>{{ source.preview || '无预览' }}</p>
          <div class="detail-actions">
            <button @click="gotoSource(source)">跳转</button>
            <button @click="refreshOne(source)">刷新页码</button>
            <button @click="startRename(source)">改名</button>
            <button class="danger-button" @click="remove(source)">删除</button>
          </div>
        </div>
      </article>

      <div v-if="!filteredSources.length" class="empty">当前文档还没有引用源。</div>
    </section>

    <section v-if="invalidRefs.length" class="invalid">
      <h2>失效引用</h2>
      <button v-for="item in invalidRefs" :key="item.index" @click="gotoInvalid(item)">
        第 {{ item.index }} 个字段：{{ item.bookmarkName }}
      </button>
    </section>
  </main>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  deleteBookmark,
  getBookmarkInfo,
  gotoBookmark,
  gotoField,
  insertPageRef,
  listInvalidRefs,
  updateAllFields
} from '../services/wpsApi'
import { refSourceStore } from '../services/refSourceStore'
import { getRefSourcesChangeTick, REF_SOURCE_REFRESH_KEY } from '../services/refSourceEvents'

export default {
  name: 'RefManager',
  setup() {
    const sources = ref([])
    const invalidRefs = ref([])
    const keyword = ref('')
    const message = ref('')
    const messageType = ref('info')
    const expandedBookmark = ref('')
    const densityMode = ref('fold')
    const editingBookmark = ref('')
    const editingName = ref('')
    const lastRefreshTick = ref(getRefSourcesChangeTick())
    let refreshTimer = null

    const filteredSources = computed(() => {
      const word = keyword.value.toLowerCase()
      return sources.value.filter((item) => {
        return [item.displayName, item.bookmarkName, item.preview, item.status]
          .join(' ')
          .toLowerCase()
          .includes(word)
      })
    })

    onMounted(() => {
      load()
      window.addEventListener('storage', handleStorageRefresh)
      window.addEventListener('focus', refreshIfChanged)
      refreshTimer = window.setInterval(refreshIfChanged, 1200)
    })

    onUnmounted(() => {
      window.removeEventListener('storage', handleStorageRefresh)
      window.removeEventListener('focus', refreshIfChanged)
      if (refreshTimer) {
        window.clearInterval(refreshTimer)
      }
    })

    async function load() {
      try {
        sources.value = await refSourceStore.listWithStatus()
        invalidRefs.value = listInvalidRefs()
        lastRefreshTick.value = getRefSourcesChangeTick()
      } catch (error) {
        showError(error.message || error)
      }
    }

    function handleStorageRefresh(event) {
      if (event.key === REF_SOURCE_REFRESH_KEY) {
        load()
      }
    }

    function refreshIfChanged() {
      const tick = getRefSourcesChangeTick()
      if (tick && tick !== lastRefreshTick.value) {
        load()
      }
    }

    function openCreateDialog() {
      window.Application.ShowDialog(`${baseUrl()}/#/create-ref-source`, '创建引用源', 420, 380, true)
    }

    function openInsertDialog() {
      window.Application.ShowDialog(`${baseUrl()}/#/insert-ref`, '插入页码引用', 520, 520, true)
    }

    function isExpanded(source) {
      return densityMode.value === 'fold' && expandedBookmark.value === source.bookmarkName
    }

    function toggle(source) {
      if (densityMode.value !== 'fold') {
        return
      }
      expandedBookmark.value = isExpanded(source) ? '' : source.bookmarkName
      editingBookmark.value = ''
    }

    function setCompact() {
      densityMode.value = 'compact'
      expandedBookmark.value = ''
      editingBookmark.value = ''
    }

    function gotoSource(source) {
      try {
        gotoBookmark(source.bookmarkName)
      } catch (error) {
        showError(error.message || error)
      }
    }

    async function insert(source) {
      try {
        insertPageRef(source.bookmarkName)
        showInfo(`已插入“${source.displayName}”的页码引用。`)
        await load()
      } catch (error) {
        showError(error.message || error)
      }
    }

    function startRename(source) {
      editingBookmark.value = source.bookmarkName
      editingName.value = source.displayName
      expandedBookmark.value = source.bookmarkName
    }

    async function saveRename(source) {
      if (!editingName.value) {
        showError('显示名称不能为空。')
        return
      }
      try {
        await refSourceStore.updateDisplayName(source.bookmarkName, editingName.value)
        editingBookmark.value = ''
        showInfo('显示名称已更新。真实书签名保持不变。')
        await load()
      } catch (error) {
        showError(error.message || error)
      }
    }

    async function remove(source) {
      const confirmed = window.confirm(
        `确定删除引用源“${source.displayName}”？这会删除书签“${source.bookmarkName}”，已插入的页码引用可能变为失效。`
      )
      if (!confirmed) {
        return
      }
      try {
        deleteBookmark(source.bookmarkName)
        await refSourceStore.remove(source.bookmarkName)
        showInfo('引用源已删除。')
        await load()
      } catch (error) {
        showError(error.message || error)
      }
    }

    async function refreshOne(source) {
      try {
        const info = getBookmarkInfo(source.bookmarkName)
        await refSourceStore.add({ ...source, page: info.page, preview: info.preview })
        showInfo('页码和预览已刷新。')
        await load()
      } catch (error) {
        showError(error.message || error)
      }
    }

    async function updateFields() {
      try {
        updateAllFields()
        showInfo('已更新全部引用字段。')
        await load()
      } catch (error) {
        showError(error.message || error)
      }
    }

    function checkInvalidRefs() {
      try {
        invalidRefs.value = listInvalidRefs()
        showInfo(`检查完成，发现 ${invalidRefs.value.length} 个失效引用。`)
      } catch (error) {
        showError(error.message || error)
      }
    }

    function gotoInvalid(item) {
      try {
        gotoField(item.index)
      } catch (error) {
        showError(error.message || error)
      }
    }

    function showError(text) {
      messageType.value = 'error'
      message.value = text
    }

    function showInfo(text) {
      messageType.value = 'info'
      message.value = text
    }

    function baseUrl() {
      const { protocol, hostname, port } = window.location
      if (protocol === 'file:') {
        return window.location.href.split('/#/')[0]
      }
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`
    }

    return {
      invalidRefs,
      keyword,
      message,
      messageType,
      filteredSources,
      expandedBookmark,
      densityMode,
      editingBookmark,
      editingName,
      load,
      openCreateDialog,
      openInsertDialog,
      isExpanded,
      toggle,
      setCompact,
      gotoSource,
      insert,
      startRename,
      saveRename,
      remove,
      refreshOne,
      updateFields,
      checkInvalidRefs,
      gotoInvalid
    }
  }
}
</script>

<style scoped>
.manager {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 10px;
  color: #1f2328;
  background: #f8fafc;
  font-size: 12px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
}
.topbar p {
  margin: 2px 0 0;
  color: #667085;
}
h2 {
  margin: 10px 0 6px;
  font-size: 14px;
  font-weight: 700;
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
.ghost {
  background: #fff;
}
.toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 10px;
}
.primary,
.insert {
  border-color: #1769e0;
  background: #1769e0;
  color: #fff;
}
.insert:disabled {
  border-color: #d0d5dd;
  background: #eef2f7;
  color: #98a2b3;
}
.search {
  box-sizing: border-box;
  width: 100%;
  min-height: 30px;
  margin-top: 10px;
  border: 1px solid #c9ced6;
  border-radius: 4px;
  padding: 0 9px;
  background: #fff;
  font-size: 12px;
}
.density {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  border: 1px solid #e4e7ec;
  border-radius: 5px;
  background: #fff;
  padding: 6px 8px;
}
.density span {
  color: #667085;
}
.density div {
  display: flex;
  gap: 4px;
}
.density button {
  min-height: 22px;
  padding: 0 7px;
}
.density button.active {
  border-color: #1769e0;
  background: #e8f1ff;
  color: #1769e0;
  font-weight: 700;
}
.message,
.summary,
.empty {
  margin: 8px 0 0;
  border-radius: 5px;
  padding: 7px 8px;
  background: #eef2f7;
}
.message.error {
  color: #b42318;
  background: #fff1f0;
}
.summary strong {
  font-weight: 800;
}
.summary .danger {
  color: #b42318;
}
.list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.row {
  border: 1px solid #b8c0cc;
  border-left: 4px solid #1769e0;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
  overflow: hidden;
  cursor: pointer;
}
.row:hover {
  border-color: #8ea4c0;
  border-left-color: #1256ba;
  box-shadow: 0 2px 5px rgba(16, 24, 40, 0.12);
}
.row.expanded {
  border-color: #84b6f4;
  border-left-color: #1769e0;
  box-shadow: 0 2px 6px rgba(23, 105, 224, 0.16);
}
.row.lost {
  border-color: #f7c6c7;
  border-left-color: #d92d20;
  background: #fffafa;
}
.row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px;
}
.row-text {
  min-width: 0;
}
.title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.title-line strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 800;
}
.rename-input {
  width: 130px;
  min-height: 24px;
  border: 1px solid #1769e0;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
}
.status {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 1px 5px;
  font-size: 11px;
}
.status.ok {
  background: #e9f8ef;
  color: #1f7a3f;
}
.status.warn {
  background: #fff7e6;
  color: #ad6800;
}
.meta {
  overflow: hidden;
  margin-top: 2px;
  color: #667085;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}
.icon {
  min-width: 42px;
}
.details {
  border-top: 1px solid #e4e7ec;
  background: #f9fafb;
  padding: 8px 9px 9px;
}
.details p {
  margin: 0 0 7px;
  color: #4b5563;
  line-height: 1.45;
}
.detail-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.danger-button {
  border-color: #f7c6c7;
  color: #b42318;
}
.invalid {
  margin-top: 10px;
}
.invalid button {
  width: 100%;
  margin-bottom: 5px;
  text-align: left;
}
</style>
