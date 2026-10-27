// Bookmarks and folders live in one ordered list (order = display order):
//   bookmark: { id, url, title, parent }          parent: folder id, or null for the bar
//   folder:   { id, type: 'folder', title, parent: null }
// Older bookmarks without `parent` simply sit on the bar.

// A tab being dragged (to the bookmarks bar): { url, title }
export const TAB_DRAG_TYPE = 'application/x-a4-tab'

export const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const isFolder = (item) => item?.type === 'folder'

export const parentOf = (item) => item.parent ?? null

export const childrenOf = (list, parent = null) => list.filter(item => parentOf(item) === parent)

export const folders = (list) => list.filter(isFolder)

export function addBookmark(list, { url, title, parent = null }) {
  return [...list, { id: newId('b'), url, title: title || url, parent }]
}

export function addFolder(list, title = 'New folder') {
  const folder = { id: newId('f'), type: 'folder', title, parent: null }
  return { list: [...list, folder], folder }
}

export function updateItem(list, id, changes) {
  return list.map(item => (item.id === id ? { ...item, ...changes } : item))
}

// Removing a folder removes the bookmarks inside it too
export function removeItem(list, id) {
  return list.filter(item => item.id !== id && item.parent !== id)
}

// Move an item into `parent` (folder id or null), placed before `beforeId` when given
export function moveItem(list, id, { parent = null, beforeId = null } = {}) {
  const item = list.find(i => i.id === id)
  if (!item || id === beforeId) return list
  if (isFolder(item) && parent) return list // folders stay on the bar (one level deep)
  const moved = { ...item, parent: isFolder(item) ? null : parent }
  const rest = list.filter(i => i.id !== id)
  const index = beforeId ? rest.findIndex(i => i.id === beforeId) : -1
  if (index === -1) return [...rest, moved]
  return [...rest.slice(0, index), moved, ...rest.slice(index)]
}

export const findByUrl = (list, url) => list.find(item => !isFolder(item) && item.url === url)
