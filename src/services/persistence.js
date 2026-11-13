
import { reactive } from 'vue'
import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'
import { readSnapshot, writeSnapshot } from './database'

export const persistenceState = reactive({
  status: 'loading', // loading | saving | saved | error
  error: '',
  canRetry: false,
  lastSavedAt: null,
})

let taskStore = null
let projectStore = null
let enabled = false
let writing = false
let revision = 0
let savedRevision = 0
let lastRequestedSnapshot = ''
let scheduled = false

// Перетворюємо реактивні дані Pinia на звичайний об'єкт.
function makeSnapshot() {
  return JSON.parse(JSON.stringify({
    tasks: taskStore.tasks,
    projects: projectStore.projects,
    nextProjectId: projectStore.nextProjectId,
  }))
}

// Перевіряємо дату, яку отримали з IndexedDB.
function parseSavedDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

// Виконуємо збереження змін в IndexedDB.
async function flushChanges() {
  if (!enabled || writing) return

  writing = true

  try {
    while (savedRevision < revision) {
      const targetRevision = revision
      const snapshot = makeSnapshot()

      try {
        // writeSnapshot повертає час успішного запису.
        const savedAt = await writeSnapshot(snapshot)

        savedRevision = targetRevision

        // Час беремо з підтвердженої транзакції IndexedDB.
        persistenceState.lastSavedAt = parseSavedDate(savedAt)
      } catch (error) {
        console.error(
          'TaskFlow: збереження не вдалося:',
          error
        )

        persistenceState.status = 'error'
        persistenceState.error =
          'Зміни поки що залишилися лише в пам’яті.'
        persistenceState.canRetry = true

        return
      }
    }

    persistenceState.status = 'saved'
    persistenceState.error = ''
    persistenceState.canRetry = false
  } finally {
    writing = false
  }
}

// Запит на збереження тільки у випадку зміни даних.
function requestSave(force = false) {
  if (!enabled) return

  const fingerprint = JSON.stringify(makeSnapshot())

  if (!force && fingerprint === lastRequestedSnapshot) {
    return
  }

  lastRequestedSnapshot = fingerprint
  revision += 1

  persistenceState.status = 'saving'
  persistenceState.error = ''
  persistenceState.canRetry = false

  void flushChanges()
}

// Об'єднуємо синхронні зміни в один запит.
function onStoreChanged() {
  if (scheduled) return

  scheduled = true

  queueMicrotask(() => {
    scheduled = false
    requestSave()
  })
}

// Повторне збереження після помилки.
export function retrySave() {
  if (
    !enabled ||
    persistenceState.status !== 'error'
  ) {
    return
  }

  requestSave(true)
}

// Ініціалізація локального збереження.
export async function initializePersistence(pinia) {
  taskStore = useTasksStore(pinia)
  projectStore = useProjectsStore(pinia)

  try {
    const snapshot = await readSnapshot()

    if (snapshot.initialized) {
      if (
        !Array.isArray(snapshot.tasks) ||
        !Array.isArray(snapshot.projects)
      ) {
        throw new Error(
          'Некоректний формат локальних даних.'
        )
      }

      const calculatedNextId = Math.max(
        0,
        ...snapshot.projects.map((project) => {
          const match = /^project-(\d+)$/.exec(
            String(project.id)
          )

          return match ? Number(match[1]) : 0
        })
      ) + 1

      projectStore.$patch({
        projects: snapshot.projects,

        nextProjectId:
          Number.isSafeInteger(snapshot.nextProjectId) &&
          snapshot.nextProjectId >= calculatedNextId
            ? snapshot.nextProjectId
            : calculatedNextId,
      })

      taskStore.$patch({
        tasks: snapshot.tasks,
      })

      // Відновлюємо час із metadata.
      // Після F5 поточний час замість нього не встановлюємо.
      persistenceState.lastSavedAt =
        parseSavedDate(snapshot.lastSavedAt)
    } else {
      // Демонстраційні дані записуємо лише при першому запуску.
      const savedAt = await writeSnapshot(makeSnapshot())

      persistenceState.lastSavedAt =
        parseSavedDate(savedAt)
    }

    persistenceState.status = 'saved'
    persistenceState.error = ''
    persistenceState.canRetry = false

    lastRequestedSnapshot =
      JSON.stringify(makeSnapshot())

    enabled = true

    // Стежимо за змінами завдань і проєктів.
    // Пошукові фільтри не спричиняють зайвих записів.
    taskStore.$subscribe(onStoreChanged, {
      detached: true,
      flush: 'sync',
    })

    projectStore.$subscribe(onStoreChanged, {
      detached: true,
      flush: 'sync',
    })
  } catch (error) {
    console.error(
      'TaskFlow: IndexedDB недоступна:',
      error
    )

    persistenceState.status = 'error'
    persistenceState.error =
      'Не вдалося відкрити або відновити локальні дані. ' +
      'Працює лише тимчасовий стан; ' +
      'наявну базу не перезаписано.'

    persistenceState.canRetry = false
  }
}
