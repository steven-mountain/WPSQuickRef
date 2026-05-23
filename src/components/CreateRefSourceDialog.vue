<template>
  <main class="dialog-page">
    <h1>创建引用源</h1>

    <label class="field">
      <span>引用源名称</span>
      <input v-model.trim="displayName" autofocus placeholder="例如：项目建设期说明" />
    </label>

    <p class="hint">
      默认使用该名称作为 WPS 真实书签名。若名称重复，会自动追加序号。
    </p>

    <p v-if="existingBookmark" class="notice">
      当前选区已包含书签：{{ existingBookmark }}。创建时可复用该书签。
    </p>

    <p v-if="message" :class="['message', messageType]">{{ message }}</p>

    <section v-if="created" class="result">
      <div><strong>显示名称：</strong>{{ created.displayName }}</div>
      <div><strong>书签名：</strong>{{ created.bookmarkName }}</div>
      <div><strong>所在页码：</strong>{{ created.page || '未知' }}</div>
      <div><strong>附近文本：</strong>{{ created.preview || '无预览' }}</div>
    </section>

    <footer>
      <button class="primary" :disabled="submitting" @click="submit">
        {{ submitting ? '正在创建...' : '确认创建' }}
      </button>
    </footer>
  </main>
</template>

<script>
import { onMounted, ref } from 'vue'
import {
  createBookmarkForDisplayName,
  getBookmarkInfo,
  getSelectionRefBookmark
} from '../services/wpsApi'
import { refSourceStore } from '../services/refSourceStore'
import { notifyAndClose } from '../services/dialogHost'
import { notifyRefSourcesChanged } from '../services/refSourceEvents'

export default {
  name: 'CreateRefSourceDialog',
  setup() {
    const displayName = ref('')
    const existingBookmark = ref('')
    const message = ref('')
    const messageType = ref('info')
    const submitting = ref(false)
    const created = ref(null)

    onMounted(() => {
      try {
        existingBookmark.value = getSelectionRefBookmark()
      } catch (error) {
        showError(error.message || error)
      }
    })

    async function submit() {
      if (!displayName.value) {
        showError('请输入引用源名称。')
        return
      }

      submitting.value = true
      try {
        let info
        let bookmarkName = existingBookmark.value
        if (bookmarkName) {
          const reuse = window.confirm(`当前选区已存在书签“${bookmarkName}”，是否复用？`)
          if (!reuse) {
            bookmarkName = ''
          }
        }

        if (bookmarkName) {
          info = getBookmarkInfo(bookmarkName)
        } else {
          info = createBookmarkForDisplayName(displayName.value)
        }

        created.value = await refSourceStore.add({
          displayName: displayName.value,
          bookmarkName: info.bookmarkName,
          page: info.page,
          preview: info.preview
        })
        notifyRefSourcesChanged()

        notifyAndClose(
          `创建成功\n\n显示名称：${created.value.displayName}\n书签名：${created.value.bookmarkName}\n所在页码：${created.value.page || '未知'}`
        )
      } catch (error) {
        showError(error.message || error)
      } finally {
        submitting.value = false
      }
    }

    function showError(text) {
      messageType.value = 'error'
      message.value = text
    }

    return {
      displayName,
      existingBookmark,
      message,
      messageType,
      submitting,
      created,
      submit
    }
  }
}
</script>

<style scoped>
.dialog-page {
  min-height: 100vh;
  padding: 18px;
  color: #1f2328;
  background: #f8fafc;
  font-size: 14px;
}
h1 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 700;
}
.field {
  display: grid;
  gap: 8px;
}
.field span {
  font-weight: 600;
}
input {
  min-height: 34px;
  border: 1px solid #c9ced6;
  border-radius: 4px;
  padding: 0 10px;
  background: #fff;
}
.hint {
  margin-top: 8px;
  color: #667085;
  font-size: 12px;
}
.notice,
.message,
.result {
  margin-top: 12px;
  border-radius: 6px;
  padding: 10px;
  background: #eef2f7;
}
.message.error {
  color: #b42318;
  background: #fff1f0;
}
.result {
  display: grid;
  gap: 6px;
}
footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
button {
  min-height: 32px;
  border: 1px solid #1769e0;
  border-radius: 4px;
  background: #1769e0;
  color: #fff;
  padding: 0 14px;
}
button:disabled {
  opacity: 0.6;
}
</style>
