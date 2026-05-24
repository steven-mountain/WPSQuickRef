import { getBookmarkInfo, getDocumentKey, listAllBookmarks, listFields } from './wpsApi'

const STORAGE_PREFIX = 'quickref.refSources.'

function now() {
  return new Date().toISOString()
}

function makeId(bookmarkName) {
  return `${bookmarkName}-${Date.now()}`
}

function countReferenceFieldsByBookmark() {
  const counts = new Map()
  listFields().forEach((field) => {
    if (!/^(PAGEREF|REF)$/i.test(field.kind) || !field.bookmarkName) {
      return
    }

    counts.set(field.bookmarkName, (counts.get(field.bookmarkName) || 0) + 1)
  })
  return counts
}

function shouldRecoverBookmark(bookmarkName, referencedNames) {
  if (!bookmarkName) {
    return false
  }

  if (referencedNames.has(bookmarkName)) {
    return true
  }

  return !isSystemBookmark(bookmarkName)
}

function isSystemBookmark(bookmarkName) {
  return /^_/.test(bookmarkName) || /^OLE_LINK/i.test(bookmarkName) || /^Toc\d+/i.test(bookmarkName)
}

export class RefSourceStore {
  constructor() {
    this.storage = window.localStorage
  }

  async list() {
    return this.readRaw()
  }

  async recoverFromDocumentBookmarks() {
    const saved = this.readRaw()
    const recovered = await this.recoverFromBookmarks(saved)
    this.writeRaw(recovered)
    return {
      list: recovered,
      recoveredCount: Math.max(0, recovered.length - saved.length)
    }
  }

  async add(source) {
    const list = this.readRaw()
    const next = {
      id: source.id || makeId(source.bookmarkName),
      displayName: source.displayName,
      bookmarkName: source.bookmarkName,
      page: source.page,
      preview: source.preview,
      createdAt: source.createdAt || now(),
      updatedAt: source.updatedAt || now()
    }
    const filtered = list.filter((item) => item.bookmarkName !== next.bookmarkName)
    filtered.unshift(next)
    this.writeRaw(filtered)
    return next
  }

  async updateDisplayName(bookmarkName, displayName) {
    const list = this.readRaw()
    const updatedAt = now()
    const next = list.map((item) =>
      item.bookmarkName === bookmarkName ? { ...item, displayName, updatedAt } : item
    )
    this.writeRaw(next)
    return next.find((item) => item.bookmarkName === bookmarkName)
  }

  async remove(bookmarkName) {
    const list = this.readRaw()
    const next = list.filter((item) => item.bookmarkName !== bookmarkName)
    this.writeRaw(next)
  }

  async removeMany(bookmarkNames) {
    const names = new Set(bookmarkNames)
    const list = this.readRaw()
    const next = list.filter((item) => !names.has(item.bookmarkName))
    this.writeRaw(next)
  }

  async refreshRuntimeInfo() {
    const list = this.readRaw()
    const next = list.map((item) => {
      try {
        const info = getBookmarkInfo(item.bookmarkName)
        return {
          ...item,
          page: info.page,
          preview: info.preview,
          updatedAt: now()
        }
      } catch (error) {
        return item
      }
    })
    this.writeRaw(next)
    return next
  }

  async listWithStatus() {
    const list = this.readRaw()
    if (!list.length) {
      return []
    }

    const referenceCounts = countReferenceFieldsByBookmark()
    const next = list.map((item) => {
      let exists = false
      let runtimeInfo = {}
      try {
        runtimeInfo = getBookmarkInfo(item.bookmarkName)
        exists = true
      } catch (error) {
        exists = false
      }
      const referenceCount = exists ? referenceCounts.get(item.bookmarkName) || 0 : 0
      return {
        ...item,
        page: runtimeInfo.page || item.page,
        preview: runtimeInfo.preview || item.preview,
        referenceCount,
        status: exists ? (referenceCount > 0 ? '正常' : '未被引用') : '书签丢失'
      }
    })
    this.writeRaw(next.map(({ referenceCount, status, ...item }) => item))
    return next
  }

  getStorageKey() {
    try {
      return STORAGE_PREFIX + encodeURIComponent(getDocumentKey())
    } catch (error) {
      return STORAGE_PREFIX + 'no-active-document'
    }
  }

  readRaw() {
    try {
      const raw = this.storage.getItem(this.getStorageKey())
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('读取引用源元数据失败', error)
      return []
    }
  }

  writeRaw(list) {
    this.storage.setItem(this.getStorageKey(), JSON.stringify(list))
  }

  async recoverFromBookmarks(saved) {
    const map = new Map(saved.map((item) => [item.bookmarkName, item]))
    const referencedNames = new Set()

    listFields().forEach((item) => {
      if (/^(PAGEREF|REF)$/i.test(item.kind) && item.bookmarkName) {
        referencedNames.add(item.bookmarkName)
      }
    })

    listAllBookmarks().forEach((item) => {
      if (map.has(item.bookmarkName)) {
        return
      }

      const shouldRecover = shouldRecoverBookmark(item.bookmarkName, referencedNames)
      if (shouldRecover) {
        map.set(item.bookmarkName, {
          id: makeId(item.bookmarkName),
          displayName: item.bookmarkName,
          bookmarkName: item.bookmarkName,
          page: item.page,
          preview: item.preview,
          createdAt: now()
        })
      }
    })

    return Array.from(map.values())
  }
}

export const refSourceStore = new RefSourceStore()
