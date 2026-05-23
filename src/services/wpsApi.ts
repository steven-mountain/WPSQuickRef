const LEGACY_REF_PREFIX = 'WPSREF_'
const FIELD_TYPE_PAGE_REF = 37
const INFO_ACTIVE_END_PAGE_NUMBER = 3
const UNIT_CHARACTER = 1

function getApplication() {
  return window.Application
}

export function getActiveDocument() {
  const app = getApplication()
  if (!app || !app.ActiveDocument) {
    throw new Error('当前没有打开文档。')
  }
  return app.ActiveDocument
}

export function getDocumentKey() {
  const doc = getActiveDocument()
  return doc.FullName || doc.Name || '未命名文档'
}

export function getSelectionRange() {
  const app = getApplication()
  getActiveDocument()
  if (!app.Selection || !app.Selection.Range) {
    throw new Error('当前没有可用选区。')
  }
  return app.Selection.Range
}

export function bookmarkExists(bookmarkName) {
  const doc = getActiveDocument()
  try {
    return !!doc.Bookmarks.Exists(bookmarkName)
  } catch (error) {
    return false
  }
}

export function listAllBookmarks() {
  const doc = getActiveDocument()
  const result = []
  const count = doc.Bookmarks.Count || 0

  for (let index = 1; index <= count; index += 1) {
    try {
      const bookmark = doc.Bookmarks.Item(index)
      if (bookmark && bookmark.Name) {
        result.push({
          bookmarkName: bookmark.Name,
          page: getRangePage(bookmark.Range),
          preview: getRangePreview(bookmark.Range)
        })
      }
    } catch (error) {
      console.warn('读取书签失败', error)
    }
  }

  return result
}

export function listRefBookmarks() {
  return listAllBookmarks().filter((item) => item.bookmarkName.indexOf(LEGACY_REF_PREFIX) === 0)
}

export function getSelectionRefBookmark() {
  const app = getApplication()
  getActiveDocument()
  const bookmarks = app.Selection && app.Selection.Bookmarks
  const count = bookmarks ? bookmarks.Count || 0 : 0

  for (let index = 1; index <= count; index += 1) {
    try {
      const bookmark = bookmarks.Item(index)
      if (bookmark && bookmark.Name) {
        return bookmark.Name
      }
    } catch (error) {
      console.warn('读取选区书签失败', error)
    }
  }

  return ''
}

export function getBookmarkNameForDisplayName(displayName, existingNames = []) {
  const baseName = String(displayName || '').trim()
  if (!baseName) {
    throw new Error('请输入引用源显示名称。')
  }

  const names = new Set([...existingNames, ...listAllBookmarks().map((item) => item.bookmarkName)])
  const candidates = unique([
    baseName,
    baseName.replace(/\s+/g, '_'),
    baseName.replace(/[^\p{L}\p{N}_]/gu, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  ]).filter(Boolean)

  for (const candidate of candidates) {
    const available = getAvailableBookmarkName(candidate, names)
    if (available) {
      return available
    }
  }

  throw new Error('无法生成可用的书签名。')
}

export function createBookmarkForDisplayName(displayName, existingNames = []) {
  const attempts = unique([
    String(displayName || '').trim(),
    String(displayName || '').trim().replace(/\s+/g, '_'),
    getBookmarkNameForDisplayName(displayName, existingNames)
  ]).filter(Boolean)

  let lastError = null
  for (const baseName of attempts) {
    const bookmarkName = getBookmarkNameForDisplayName(baseName, existingNames)
    try {
      return createBookmark(bookmarkName)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('创建书签失败。')
}

export function createBookmark(bookmarkName) {
  const doc = getActiveDocument()
  const range = getSelectionRange()

  if (bookmarkExists(bookmarkName)) {
    throw new Error(`书签名 ${bookmarkName} 已存在。`)
  }

  try {
    doc.Bookmarks.Add(bookmarkName, range)
  } catch (error) {
    throw new Error(`创建书签失败：${error.message || error}`)
  }

  return getBookmarkInfo(bookmarkName)
}

export function getBookmarkInfo(bookmarkName) {
  const doc = getActiveDocument()
  if (!bookmarkExists(bookmarkName)) {
    throw new Error(`书签 ${bookmarkName} 不存在。`)
  }
  const bookmark = doc.Bookmarks.Item(bookmarkName)
  return {
    bookmarkName,
    page: getRangePage(bookmark.Range),
    preview: getRangePreview(bookmark.Range)
  }
}

export function insertPageRef(bookmarkName) {
  if (!bookmarkName) {
    throw new Error('缺少书签名。')
  }
  if (!bookmarkExists(bookmarkName)) {
    throw new Error(`书签 ${bookmarkName} 不存在，无法插入页码引用。`)
  }

  const doc = getActiveDocument()
  const range = getSelectionRange()
  const fieldName = quoteFieldBookmarkName(bookmarkName)

  try {
    const field = doc.Fields.Add(range, FIELD_TYPE_PAGE_REF, `${fieldName} \\h`, false)
    if (field && field.Update) {
      field.Update()
    }
    return field
  } catch (error) {
    try {
      const field = doc.Fields.Add(range, undefined, `PAGEREF ${fieldName} \\h`, false)
      if (field && field.Update) {
        field.Update()
      }
      return field
    } catch (fallbackError) {
      throw new Error(`插入 PAGEREF 字段失败：${fallbackError.message || fallbackError}`)
    }
  }
}

export function updateAllFields() {
  const doc = getActiveDocument()
  try {
    return doc.Fields.Update()
  } catch (error) {
    throw new Error(`更新全部引用失败：${error.message || error}`)
  }
}

export function gotoBookmark(bookmarkName) {
  if (!bookmarkExists(bookmarkName)) {
    throw new Error(`书签 ${bookmarkName} 不存在。`)
  }
  const doc = getActiveDocument()
  doc.Bookmarks.Item(bookmarkName).Select()
}

export function deleteBookmark(bookmarkName) {
  if (!bookmarkExists(bookmarkName)) {
    return
  }
  const doc = getActiveDocument()
  doc.Bookmarks.Item(bookmarkName).Delete()
}

export function countPageRefs(bookmarkName) {
  return listFields().filter((field) => {
    return field.bookmarkName === bookmarkName && /^(PAGEREF|REF)$/i.test(field.kind)
  }).length
}

export function listInvalidRefs() {
  return listFields().filter((field) => {
    return /^(PAGEREF|REF)$/i.test(field.kind) && field.bookmarkName && !bookmarkExists(field.bookmarkName)
  })
}

export function listFields() {
  const doc = getActiveDocument()
  const fields = doc.Fields
  const count = fields ? fields.Count || 0 : 0
  const result = []

  for (let index = 1; index <= count; index += 1) {
    try {
      const field = fields.Item(index)
      const code = normalizeFieldCode(field.Code && field.Code.Text)
      const parsed = parseRefFieldCode(code)
      result.push({
        index,
        code,
        kind: parsed.kind,
        bookmarkName: parsed.bookmarkName,
        field
      })
    } catch (error) {
      console.warn('读取字段失败', error)
    }
  }

  return result
}

export function gotoField(fieldIndex) {
  const doc = getActiveDocument()
  const field = doc.Fields.Item(fieldIndex)
  if (field && field.Select) {
    field.Select()
  }
}

function getAvailableBookmarkName(baseName, reservedNames) {
  if (!baseName) {
    return ''
  }
  if (!reservedNames.has(baseName) && !bookmarkExists(baseName)) {
    return baseName
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName}_${index}`
    if (!reservedNames.has(candidate) && !bookmarkExists(candidate)) {
      return candidate
    }
  }
  return ''
}

function parseRefFieldCode(code) {
  const match = code.match(/\b(PAGEREF|REF)\s+(?:"([^"]+)"|([^\s\\]+))/i)
  if (!match) {
    return { kind: '', bookmarkName: '' }
  }
  return {
    kind: match[1].toUpperCase(),
    bookmarkName: match[2] || match[3]
  }
}

function quoteFieldBookmarkName(bookmarkName) {
  return /[\s]/.test(bookmarkName) ? `"${bookmarkName.replace(/"/g, '')}"` : bookmarkName
}

function unique(items) {
  return Array.from(new Set(items))
}

function normalizeFieldCode(code) {
  return String(code || '').replace(/\s+/g, ' ').trim()
}

function getRangePage(range) {
  try {
    return Number(range.Information(INFO_ACTIVE_END_PAGE_NUMBER)) || undefined
  } catch (error) {
    return undefined
  }
}

function getRangePreview(range) {
  try {
    const duplicate = range.Duplicate
    duplicate.MoveStart(UNIT_CHARACTER, -30)
    duplicate.MoveEnd(UNIT_CHARACTER, 30)
    return normalizePreview(duplicate.Text)
  } catch (error) {
    return normalizePreview(range && range.Text)
  }
}

function normalizePreview(text) {
  return String(text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export const REF_SOURCE_PREFIX = LEGACY_REF_PREFIX
