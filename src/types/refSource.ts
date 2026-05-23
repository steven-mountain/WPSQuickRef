export interface RefSource {
  id: string
  displayName: string
  bookmarkName: string
  page?: number
  preview?: string
  createdAt: string
  updatedAt?: string
}

export interface RefSourceStatus extends RefSource {
  referenceCount: number
  status: '正常' | '书签丢失' | '未被引用'
}
