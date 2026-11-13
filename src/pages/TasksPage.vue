
<script setup>
import { computed, nextTick, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppTabbar from '../components/AppTabbar.vue'
import TaskCard from '../components/TaskCard.vue'
import TaskForm from '../components/TaskForm.vue'
import TaskListControls from '../components/TaskListControls.vue'
import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'
import { persistenceState, retrySave } from '../services/persistence'
import '../css/task-components.css'
import '../css/task-form.css'
import '../css/task-list.css'
import '../css/persistence.css'

const taskStore = useTasksStore()
const projectStore = useProjectsStore()

const {
  tasks,
  visibleTasks,
  searchText,
  selectedStatus,
  selectedPriority,
  selectedProject,
  sortOrder,
  unfinishedOnly,
  withoutDueDateOnly,
  completionPercent,
} = storeToRefs(taskStore)

const { projects, projectStats } = storeToRefs(projectStore)

const formVisible = ref(false)
const editingId = ref(null)
const formAnchor = ref(null)
const importInput = ref(null)
const feedback = ref('')
const newProjectTitle = ref('')
const newProjectError = ref('')

const isTaskListEmpty = computed(() => tasks.value.length === 0)

const editingTask = computed(() =>
  tasks.value.find((task) => task.id === editingId.value) ?? null
)

const currentProject = computed(() =>
  projects.value.find(
    (project) => project.id === selectedProject.value
  ) ?? null
)

const currentProjectTaskCount = computed(() => {
  if (!currentProject.value) return 0

  return tasks.value.filter(
    (task) => task.projectId === currentProject.value.id
  ).length
})

// Повідомлення про стан локального збереження.
const saveMessage = computed(() => {
  if (persistenceState.status === 'loading') {
    return 'Завантаження локальних даних…'
  }

  if (persistenceState.status === 'saving') {
    return 'Збереження змін у IndexedDB…'
  }

  if (persistenceState.status === 'saved') {
    return 'Усі зміни збережено в цьому браузері.'
  }

  return persistenceState.error || 'Помилка локального збереження.'
})

// КП 2/10. Додаткове завдання № 4.
// Відображаємо дату та час останнього підтвердження даних.
const lastSavedTime = computed(() => {
  if (!persistenceState.lastSavedAt) {
    return ''
  }

  const date = new Date(persistenceState.lastSavedAt)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})

function resetFilters() {
  taskStore.resetFilters()
}

function handleStatusChange(payload) {
  taskStore.setTaskStatus(payload)
}

function handlePriorityChange(payload) {
  taskStore.setTaskPriority(payload)
}

async function scrollToForm() {
  await nextTick()
  formAnchor.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function createTask() {
  editingId.value = null
  formVisible.value = true
  feedback.value = ''
  await scrollToForm()
}

async function editTask(id) {
  editingId.value = id
  formVisible.value = true
  feedback.value = ''
  await scrollToForm()
}

function cancelForm() {
  formVisible.value = false
  editingId.value = null
}

function saveTask(data) {
  const isEditing = editingId.value !== null

  const saved = isEditing
    ? taskStore.updateTask({ ...data, id: editingId.value })
    : taskStore.addTask(data)

  if (!saved) {
    feedback.value =
      'Не вдалося зберегти завдання. Перевірте дані форми.'
    return
  }

  feedback.value = isEditing
    ? `Завдання «${saved.title}» оновлено.`
    : `Завдання «${saved.title}» створено.`

  cancelForm()
  resetFilters()
}

function handleDelete(id) {
  const task = tasks.value.find(
    (item) => item.id === Number(id)
  )

  if (!task) return

  const confirmed = window.confirm(
    `Видалити завдання «${task.title}»?`
  )

  if (!confirmed) return

  if (taskStore.deleteTask(id)) {
    if (editingId.value === Number(id)) {
      cancelForm()
    }

    feedback.value = `Завдання «${task.title}» видалено.`
  }
}

function createProject() {
  const project = projectStore.addProject(newProjectTitle.value)

  if (!project) {
    newProjectError.value =
      'Назва має містити 3–40 символів і не повторювати назви інших проєктів.'
    return
  }

  newProjectTitle.value = ''
  newProjectError.value = ''
  selectedProject.value = project.id

  feedback.value = `Проєкт «${project.title}» створено.`
}

// Групова зміна статусу завдань проєкту.
function moveProjectTasksToProgress() {
  const project = currentProject.value

  if (!project) {
    feedback.value = 'Спочатку виберіть конкретний проєкт.'
    return
  }

  if (currentProjectTaskCount.value === 0) {
    feedback.value = `У проєкті «${project.title}» немає завдань.`
    return
  }

  const confirmed = window.confirm(
    `Перевести всі завдання проєкту «${project.title}» ` +
    `(${currentProjectTaskCount.value}) у статус «У роботі»?\n\n` +
    'Це також змінить статус уже виконаних завдань.'
  )

  if (!confirmed) return

  const updatedCount = taskStore.setProjectTasksInProgress(
    project.id
  )

  feedback.value = updatedCount > 0
    ? `У проєкті «${project.title}» змінено статус ${updatedCount} завдань.`
    : `Усі завдання проєкту «${project.title}» уже мають статус «У роботі».`
}

// Додаткове завдання № 1 — експорт JSON.
async function exportJSON() {
  try {
    const exportData = {
      exportedAt: new Date().toISOString(),
      tasks: JSON.parse(JSON.stringify(tasks.value)),
      projects: JSON.parse(JSON.stringify(projects.value)),
    }

    const json = JSON.stringify(exportData, null, 2)

    const filename = `taskflow-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`

    if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'JSON-файл',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      })

      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()

      feedback.value =
        `JSON-файл збережено: ${tasks.value.length} завдань, ` +
        `${projects.value.length} проєктів.`

      return
    }

    const blob = new Blob([json], {
      type: 'application/json;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename

    document.body.appendChild(link)
    link.click()
    link.remove()

    setTimeout(() => URL.revokeObjectURL(url), 10000)

    feedback.value =
      'Запит на завантаження JSON передано браузеру.'
  } catch (error) {
    if (error.name === 'AbortError') {
      feedback.value = 'Збереження JSON скасовано.'
      return
    }

    console.error('Помилка експорту JSON:', error)
    feedback.value = 'Не вдалося зберегти JSON-файл.'
  }
}

// Перевіряємо, що значення є звичайним об'єктом.
function isObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
}

// Перевірка формату дати завдання.
function isValidDueDate(value) {
  if (value === '' || value === null) return true

  if (typeof value !== 'string') return false

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
}

// Додаткове завдання № 2 — перевірка JSON перед імпортом.
function validateImport(data) {
  if (!isObject(data)) {
    throw new Error('JSON повинен містити об’єкт.')
  }

  if (
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.projects)
  ) {
    throw new Error(
      'У JSON повинні бути масиви tasks і projects.'
    )
  }

  if (
    typeof data.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(data.exportedAt))
  ) {
    throw new Error(
      'Відсутня або некоректна дата exportedAt.'
    )
  }

  const projectIds = new Set()
  const projectNames = new Set()

  for (const project of data.projects) {
    if (!isObject(project)) {
      throw new Error('Некоректний запис проєкту.')
    }

    if (
      typeof project.id !== 'string' ||
      !/^(general|study|personal|project-[1-9]\d*)$/.test(
        project.id
      )
    ) {
      throw new Error('Некоректний ID проєкту.')
    }

    if (
      typeof project.title !== 'string' ||
      project.title.trim().length < 3 ||
      project.title.trim().length > 40
    ) {
      throw new Error('Некоректна назва проєкту.')
    }

    const normalizedName = project.title.trim().toLowerCase()

    if (
      projectIds.has(project.id) ||
      projectNames.has(normalizedName)
    ) {
      throw new Error(
        'У JSON повторюються ID або назви проєктів.'
      )
    }

    projectIds.add(project.id)
    projectNames.add(normalizedName)
  }

  const taskIds = new Set()
  const allowedStatuses = ['todo', 'progress', 'done']
  const allowedPriorities = ['low', 'medium', 'high']
  const allowedCategories = ['study', 'work', 'personal']

  for (const task of data.tasks) {
    if (!isObject(task)) {
      throw new Error('Некоректний запис завдання.')
    }

    if (
      !Number.isSafeInteger(task.id) ||
      task.id <= 0 ||
      taskIds.has(task.id)
    ) {
      throw new Error(
        'ID завдань мають бути унікальними додатними числами.'
      )
    }

    if (
      typeof task.title !== 'string' ||
      task.title.trim().length < 3 ||
      task.title.trim().length > 80
    ) {
      throw new Error(
        `Некоректна назва завдання з ID ${task.id}.`
      )
    }

    if (
      typeof task.description !== 'string' ||
      task.description.length > 300
    ) {
      throw new Error(
        `Некоректний опис завдання з ID ${task.id}.`
      )
    }

    if (!allowedStatuses.includes(task.status)) {
      throw new Error(
        `Некоректний статус завдання з ID ${task.id}.`
      )
    }

    if (!allowedPriorities.includes(task.priority)) {
      throw new Error(
        `Некоректний пріоритет завдання з ID ${task.id}.`
      )
    }

    if (!allowedCategories.includes(task.category)) {
      throw new Error(
        `Некоректна категорія завдання з ID ${task.id}.`
      )
    }

    if (!isValidDueDate(task.dueDate)) {
      throw new Error(
        `Некоректна дата завдання з ID ${task.id}.`
      )
    }

    if (
      typeof task.projectId !== 'string' ||
      !projectIds.has(task.projectId)
    ) {
      throw new Error(
        `Завдання з ID ${task.id} посилається на неіснуючий проєкт.`
      )
    }

    taskIds.add(task.id)
  }

  const nextProjectId = Math.max(
    0,
    ...data.projects.map((project) => {
      const match = /^project-(\d+)$/.exec(project.id)
      return match ? Number(match[1]) : 0
    })
  ) + 1

  if (!Number.isSafeInteger(nextProjectId)) {
    throw new Error('Некоректна нумерація проєктів.')
  }

  return {
    tasks: data.tasks,
    projects: data.projects,
    nextProjectId,
  }
}

// Відкриття вікна вибору JSON-файлу.
function openImportDialog() {
  importInput.value?.click()
}

// Зчитування та перевірка вибраного JSON.
async function importJSON(event) {
  const file = event.target.files?.[0]

  event.target.value = ''

  if (!file) return

  try {
    if (!file.name.toLowerCase().endsWith('.json')) {
      throw new Error('Потрібно вибрати JSON-файл.')
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error(
        'Розмір JSON-файлу не повинен перевищувати 5 МБ.'
      )
    }

    const text = await file.text()
    const data = JSON.parse(text)
    const validated = validateImport(data)

    const confirmed = window.confirm(
      `Імпортувати дані з файлу «${file.name}»?\n\n` +
      `Завдань: ${validated.tasks.length}\n` +
      `Проєктів: ${validated.projects.length}\n\n` +
      'УВАГА! Поточні завдання та проєкти будуть замінені. ' +
      'Продовжити?'
    )

    if (!confirmed) {
      feedback.value = 'Імпорт JSON скасовано.'
      return
    }

    if (persistenceState.status === 'error') {
      throw new Error(
        'Локальне збереження недоступне. Імпорт не виконано.'
      )
    }

    projectStore.$patch({
      projects: validated.projects,
      nextProjectId: validated.nextProjectId,
    })

    taskStore.$patch({
      tasks: validated.tasks,
    })

    cancelForm()
    resetFilters()

    feedback.value =
      `Дані імпортовано: ${validated.tasks.length} завдань, ` +
      `${validated.projects.length} проєктів. ` +
      'Дочекайтеся підтвердження локального збереження.'
  } catch (error) {
    console.error('Помилка імпорту JSON:', error)

    feedback.value =
      `Не вдалося імпортувати JSON: ${error.message}`
  }
}
</script>

<template>
  <f7-page name="tasks" class="tf3-page">
    <f7-navbar title="Мої завдання" />

    <div class="tf3-container">
      <section class="tf3-hero">
        <div class="tf3-eyebrow">TASKFLOW / TASK MANAGER</div>

        <h1>Мої завдання</h1>

        <p>
          Створюйте, редагуйте, знаходьте, сортуйте
          завдання та керуйте проєктами через Pinia.
          IndexedDB зберігає дані локально.
        </p>

        <button
          type="button"
          class="tf4-new-task"
          @click="createTask"
        >
          + Додати завдання
        </button>
      </section>

      <p v-if="feedback" class="tf4-feedback" role="status">
        {{ feedback }}
      </p>

      <!-- Індикатор IndexedDB із часом останнього підтвердження -->
      <section
        class="tf7-persistence"
        :class="`tf7-persistence--${persistenceState.status}`"
        role="status"
        aria-live="polite"
      >
        <strong>Локальне збереження</strong>

        <span>{{ saveMessage }}</span>

        <span
          v-if="lastSavedTime"
          style="flex-basis: 100%; font-size: 12px; opacity: 0.85;"
        >
          Останнє збереження / відновлення: {{ lastSavedTime }}
        </span>

        <button
          v-if="persistenceState.canRetry"
          type="button"
          class="tf5-btn"
          @click="retrySave"
        >
          Повторити збереження
        </button>
      </section>

      <!-- Експорт та імпорт JSON -->
      <section
        class="tf5-panel"
        aria-label="Експорт та імпорт даних"
      >
        <h2>Експорт та імпорт даних TaskFlow</h2>

        <p>
          Збережіть копію завдань і проєктів у JSON-файл
          або відновіть дані з раніше збереженої копії.
        </p>

        <button
          type="button"
          class="tf5-btn tf5-btn--primary"
          @click="exportJSON"
        >
          Експорт JSON
        </button>

        <button
          type="button"
          class="tf5-btn"
          style="margin-top: 12px;"
          @click="openImportDialog"
        >
          Імпорт JSON
        </button>

        <input
          ref="importInput"
          type="file"
          accept=".json,application/json"
          style="display: none;"
          @change="importJSON"
        />
      </section>

      <!-- Мої проєкти -->
      <section
        class="tf5-panel tf6-project-panel"
        aria-label="Проєкти"
      >
        <h2>Мої проєкти</h2>

        <div class="tf6-project-list">
          <span
            v-for="project in projectStats"
            :key="project.id"
            class="tf6-project-pill"
          >
            {{ project.title }}
            <strong>{{ project.taskCount }}</strong>
          </span>
        </div>

        <form
          class="tf6-project-form"
          @submit.prevent="createProject"
        >
          <label>
            Назва нового проєкту

            <input
              v-model="newProjectTitle"
              type="text"
              maxlength="40"
              placeholder="Наприклад: Лабораторні"
              @input="newProjectError = ''"
            />
          </label>

          <button
            type="submit"
            class="tf5-btn tf5-btn--primary"
          >
            Створити проєкт
          </button>
        </form>

        <p
          v-if="newProjectError"
          class="tf5-error"
          role="alert"
        >
          {{ newProjectError }}
        </p>
      </section>

      <!-- Форма створення та редагування -->
      <section
        v-if="formVisible"
        ref="formAnchor"
        class="tf4-form-section"
      >
        <TaskForm
          :key="editingId ?? 'new'"
          :task="editingTask"
          :projects="projects"
          @save="saveTask"
          @cancel="cancelForm"
        />
      </section>

      <!-- Фільтри -->
      <TaskListControls
        v-model:search="searchText"
        v-model:status="selectedStatus"
        v-model:priority="selectedPriority"
        v-model:project="selectedProject"
        v-model:sort="sortOrder"
        v-model:unfinishedOnly="unfinishedOnly"
        v-model:withoutDueDateOnly="withoutDueDateOnly"
        :projects="projects"
        @reset="resetFilters"
      />

      <!-- Групове керування -->
      <section
        class="tf5-panel"
        aria-label="Групове керування завданнями"
      >
        <h2>Групове керування завданнями</h2>

        <p v-if="currentProject">
          Обраний проєкт:
          <strong>{{ currentProject.title }}</strong>.
          Завдань: {{ currentProjectTaskCount }}.
        </p>

        <p v-else>
          Виберіть конкретний проєкт у фільтрі вище.
        </p>

        <button
          type="button"
          class="tf5-btn tf5-btn--primary"
          :disabled="!currentProject || currentProjectTaskCount === 0"
          @click="moveProjectTasksToProgress"
        >
          Перевести всі у роботу
        </button>
      </section>

      <!-- Список завдань -->
      <section class="tf3-section">
        <div class="tf3-section-heading">
          <div>
            <div class="tf3-eyebrow">TASK LIST</div>
            <h2>Список завдань</h2>
          </div>

          <div class="tf3-counter">
            Показано: {{ visibleTasks.length }}
            із {{ tasks.length }}
            | Виконано: {{ completionPercent }}%
          </div>
        </div>

        <div v-if="isTaskListEmpty" class="tf5-empty">
          <p>Список завдань порожній. Усі завдання видалено.</p>
          <p>Щоб продовжити роботу, створіть нове завдання.</p>

          <button
            type="button"
            class="tf5-btn"
            @click="createTask"
          >
            + Створити завдання
          </button>
        </div>

        <div
          v-else-if="visibleTasks.length"
          class="tf3-task-grid"
        >
          <TaskCard
            v-for="task in visibleTasks"
            :key="task.id"
            :task="task"
            :project-title="projectStore.projectTitle(task.projectId)"
            :editable="true"
            @status-change="handleStatusChange"
            @priority-change="handlePriorityChange"
            @edit="editTask"
            @delete="handleDelete"
          />
        </div>

        <div v-else class="tf5-empty">
          <p>За поточними умовами завдань не знайдено.</p>

          <button
            type="button"
            class="tf5-btn"
            @click="resetFilters"
          >
            Показати всі завдання
          </button>
        </div>
      </section>
    </div>

    <AppTabbar active="tasks" />
  </f7-page>
</template>
