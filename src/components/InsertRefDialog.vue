<template>
  <main class="dialog-page">
    <h1>插入页码引用</h1>
    <input v-model.trim="keyword" class="search" autofocus placeholder="搜索引用源" />

    <p v-if="message" :class="['message', messageType]">{{ message }}</p>

    <section class="list">
      <button
        v-for="source in filteredSources"
        :key="source.bookmarkName"
        class="item"
        @click="insert(source)"
      >
        <strong>{{ source.displayName }}</strong>
        <span>第 {{ source.page || '未知' }} 页 · {{ source.bookmarkName }}</span>
        <small>{{ source.preview || '无预览' }}</small>
      </button>
      <div v-if="!filteredSources.length" class="empty">没有可插入的引用源。</div>
    </section>
  </main>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { insertPageRef } from '../services/wpsApi'
import { refSourceStore } from '../services/refSourceStore'
import { notifyAndClose } from '../services/dialogHost'
import { notifyRefSourcesChanged } from '../services/refSourceEvents'

export default {
  name: 'InsertRefDialog',
  setup() {
    const sources = ref([])
    const keyword = ref('')
    const message = ref('')
    const messageType = ref('info')

    const filteredSources = computed(() => {
      const word = keyword.value.toLowerCase()
      return sources.value.filter((item) => {
        return [item.displayName, item.bookmarkName, item.preview]
          .join(' ')
          .toLowerCase()
          .includes(word)
      })
    })

    onMounted(load)

    async function load() {
      try {
        sources.value = await refSourceStore.list()
      } catch (error) {
        showError(error.message || error)
      }
    }

    function insert(source) {
      try {
        insertPageRef(source.bookmarkName)
        notifyRefSourcesChanged()
        notifyAndClose(`引用成功\n\n已插入“${source.displayName}”的页码引用。`)
      } catch (error) {
        showError(error.message || error)
      }
    }

    function showError(text) {
      messageType.value = 'error'
      message.value = text
    }

    return {
      keyword,
      message,
      messageType,
      filteredSources,
      insert
    }
  }
}
</script>

<style scoped>
.dialog-page {
  min-height: 100vh;
  padding: 16px;
  color: #1f2328;
  background: #f8fafc;
  font-size: 13px;
}
h1 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 700;
}
.search {
  width: 100%;
  box-sizing: border-box;
  min-height: 32px;
  border: 1px solid #c9ced6;
  border-radius: 4px;
  padding: 0 10px;
  background: #fff;
}
.message,
.empty {
  margin-top: 10px;
  border-radius: 6px;
  padding: 8px;
  background: #eef2f7;
}
.message.error {
  color: #b42318;
  background: #fff1f0;
}
.list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.item {
  display: grid;
  gap: 2px;
  width: 100%;
  border: 1px solid #d7dce3;
  border-radius: 5px;
  background: #fff;
  padding: 8px 10px;
  color: #1f2328;
  text-align: left;
}
.item strong {
  font-weight: 700;
}
.item span {
  color: #5b6472;
  font-size: 12px;
}
.item small {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.35;
}
</style>
