import { countPageRefs, getBookmarkInfo, getDocumentKey, listAllBookmarks } from './wpsApi'

const STORAGE_PREFIX = 'quickref.refSources.'

function now() {
  return new Date().toISOString()
}

function makeId(bookmarkName) {
  return `${bookmarkName}-${Date.now()}`
}

export class RefSourceStore {
  constructor() {
    this.storage = window.localStorage
  }

  async list() {
    const saved = this.readRaw()
    const recovered = await this.recoverFromBookmarks(saved)
    this.writeRaw(recovered)
    return recovered
  }

  async add(source) {
    const list = await this.list()
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
    const list = await this.list()
    const updatedAt = now()
    const next = list.map((item) =>
      item.bookmarkName === bookmarkName ? { ...item, displayName, updatedAt } : item
    )
    this.writeRaw(next)
    return next.find((item) => item.bookmarkName === bookmarkName)
  }

  async remove(bookmarkName) {
    const list = await this.list()
    const next = list.filter((item) => item.bookmarkName !== bookmarkName)
    this.writeRaw(next)
  }

  async refreshRuntimeInfo() {
    const list = await this.list()
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
    const list = await this.refreshRuntimeInfo()
    return list.map((item) => {
      let exists = false
      try {
        getBookmarkInfo(item.bookmarkName)
        exists = true
      } catch (error) {
        exists = false
      }
      const referenceCount = exists ? countPageRefs(item.bookmarkName) : 0
      return {
        ...item,
        referenceCount,
        status: exists ? (referenceCount > 0 ? '正常' : '未被引用') : '书签丢失'
      }
    })
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
    const knownNames = new Set(saved.map((item) => item.bookmarkName))
    const referencedNames = new Set()

    saved.forEach((item) => {
      if (item.bookmarkName) {
        referencedNames.add(item.bookmarkName)
      }
    })

    listAllBookmarks().forEach((item) => {
      if (map.has(item.bookmarkName)) {
        return
      }

      const shouldRecover = knownNames.size === 0 || referencedNames.has(item.bookmarkName)
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
