
import { openDB } from 'idb'

const DB_NAME = 'taskflow-db'
const DB_VERSION = 1

let databasePromise = null

// Відкриваємо базу IndexedDB.
export function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('Цей браузер не підтримує IndexedDB.')
    )
  }

  if (!databasePromise) {
    databasePromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', {
            keyPath: 'id',
          })
        }

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', {
            keyPath: 'id',
          })
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata')
        }
      },
    }).catch((error) => {
      databasePromise = null
      throw error
    })
  }

  return databasePromise
}

// Читаємо всі дані, включно з часом останнього запису.
export async function readSnapshot() {
  const db = await getDatabase()

  const tx = db.transaction(
    ['tasks', 'projects', 'metadata'],
    'readonly'
  )

  const taskStore = tx.objectStore('tasks')
  const projectStore = tx.objectStore('projects')
  const metadataStore = tx.objectStore('metadata')

  const [
    tasks,
    projects,
    initialized,
    nextProjectId,
    lastSavedAt,
  ] = await Promise.all([
    taskStore.getAll(),
    projectStore.getAll(),
    metadataStore.get('initialized'),
    metadataStore.get('nextProjectId'),
    metadataStore.get('lastSavedAt'),
  ])

  await tx.done

  return {
    tasks,
    projects,
    initialized: initialized === true,
    nextProjectId,
    lastSavedAt: lastSavedAt ?? null,
  }
}

// Перевіряємо, чи змінився запис.
function recordsEqual(oldRecord, newRecord) {
  return JSON.stringify(oldRecord) === JSON.stringify(newRecord)
}

// Синхронізуємо тільки змінені записи.
function synchronizeStore(store, existingRecords, newRecords) {
  const operations = []

  const oldMap = new Map(
    existingRecords.map((record) => [record.id, record])
  )

  const newMap = new Map(
    newRecords.map((record) => [record.id, record])
  )

  // Створюємо нові та оновлюємо змінені записи.
  for (const record of newRecords) {
    const oldRecord = oldMap.get(record.id)

    if (!oldRecord || !recordsEqual(oldRecord, record)) {
      operations.push(store.put(record))
    }
  }

  // Видаляємо лише відсутні записи.
  for (const oldRecord of existingRecords) {
    if (!newMap.has(oldRecord.id)) {
      operations.push(store.delete(oldRecord.id))
    }
  }

  return operations
}

// Зберігаємо дані в одній атомарній транзакції.
export async function writeSnapshot(snapshot) {
  const db = await getDatabase()

  const tx = db.transaction(
    ['tasks', 'projects', 'metadata'],
    'readwrite'
  )

  const taskStore = tx.objectStore('tasks')
  const projectStore = tx.objectStore('projects')
  const metadataStore = tx.objectStore('metadata')

  const [existingTasks, existingProjects] =
    await Promise.all([
      taskStore.getAll(),
      projectStore.getAll(),
    ])

  const lastSavedAt = new Date().toISOString()

  const operations = [
    ...synchronizeStore(
      taskStore,
      existingTasks,
      snapshot.tasks
    ),

    ...synchronizeStore(
      projectStore,
      existingProjects,
      snapshot.projects
    ),

    metadataStore.put(true, 'initialized'),

    metadataStore.put(
      snapshot.nextProjectId,
      'nextProjectId'
    ),

    // Додаткове завдання № 4:
    // записуємо час успішного збереження в metadata.
    metadataStore.put(
      lastSavedAt,
      'lastSavedAt'
    ),
  ]

  await Promise.all(operations)
  await tx.done

  // Повертаємо час тільки після завершення транзакції.
  return lastSavedAt
}
