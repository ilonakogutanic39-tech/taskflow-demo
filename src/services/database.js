
import { openDB } from 'idb'

const DB_NAME = 'taskflow-db'
const DB_VERSION = 1

let databasePromise = null

// Відкриваємо базу даних IndexedDB.
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

// Зчитуємо завдання, проєкти та службові значення.
export async function readSnapshot() {
  const db = await getDatabase()

  const tx = db.transaction(
    ['tasks', 'projects', 'metadata'],
    'readonly'
  )

  const [tasks, projects, initialized, nextProjectId] =
    await Promise.all([
      tx.objectStore('tasks').getAll(),
      tx.objectStore('projects').getAll(),
      tx.objectStore('metadata').get('initialized'),
      tx.objectStore('metadata').get('nextProjectId'),
    ])

  await tx.done

  return {
    tasks,
    projects,
    initialized: initialized === true,
    nextProjectId,
  }
}

// Порівнюємо старі та нові записи.
function recordsEqual(oldRecord, newRecord) {
  return JSON.stringify(oldRecord) === JSON.stringify(newRecord)
}

// Оновлюємо тільки записи, які змінилися.
// Видалені записи прибираємо через delete().
function synchronizeStore(store, existingRecords, newRecords) {
  const operations = []

  const oldMap = new Map(
    existingRecords.map((record) => [record.id, record])
  )

  const newMap = new Map(
    newRecords.map((record) => [record.id, record])
  )

  // Додаємо нові та оновлюємо змінені записи.
  for (const record of newRecords) {
    const oldRecord = oldMap.get(record.id)

    if (!oldRecord || !recordsEqual(oldRecord, record)) {
      operations.push(store.put(record))
    }
  }

  // Видаляємо записи, яких більше немає у Pinia.
  for (const oldRecord of existingRecords) {
    if (!newMap.has(oldRecord.id)) {
      operations.push(store.delete(oldRecord.id))
    }
  }

  return operations
}

// Атомарно синхронізуємо Pinia з IndexedDB.
export async function writeSnapshot(snapshot) {
  const db = await getDatabase()

  const tx = db.transaction(
    ['tasks', 'projects', 'metadata'],
    'readwrite'
  )

  const taskStore = tx.objectStore('tasks')
  const projectStore = tx.objectStore('projects')
  const metadataStore = tx.objectStore('metadata')

  // Читаємо поточні записи без очищення сховищ.
  const [existingTasks, existingProjects] =
    await Promise.all([
      taskStore.getAll(),
      projectStore.getAll(),
    ])

  // Змінюємо лише необхідні записи.
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
  ]

  // Очікуємо завершення всіх операцій і транзакції.
  await Promise.all([...operations, tx.done])
}
