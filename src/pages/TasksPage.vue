
<script setup>
import { computed, nextTick, ref } from 'vue'
import AppTabbar from '../components/AppTabbar.vue'
import TaskCard from '../components/TaskCard.vue'
import TaskForm from '../components/TaskForm.vue'
import TaskListControls from '../components/TaskListControls.vue'
import {
  taskState,
  addTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  setTaskPriority,
} from '../store/tasks'
import '../css/task-components.css'
import '../css/task-form.css'
import '../css/task-list.css'

const selectedStatus = ref('all')
const selectedPriority = ref('all')
const searchQuery = ref('')
const sortOrder = ref('newest')
const unfinishedOnly = ref(false)

const formVisible = ref(false)
const editingId = ref(null)
const formAnchor = ref(null)
const feedback = ref('')

const visibleTasks = computed(() => {
  const term = searchQuery.value.trim().toLocaleLowerCase('uk-UA')
  const priorityWeight = { high: 3, medium: 2, low: 1 }
  const statusWeight = { progress: 1, todo: 2, done: 3 }

  // Фільтрація за пошуком, статусом, пріоритетом і швидким фільтром.
  const result = taskState.tasks.filter((task) => {
    const matchesText = !term ||
      `${task.title} ${task.description ?? ''}`
        .toLocaleLowerCase('uk-UA')
        .includes(term)

    const matchesStatus =
      selectedStatus.value === 'all' ||
      task.status === selectedStatus.value

    const matchesPriority =
      selectedPriority.value === 'all' ||
      task.priority === selectedPriority.value

    const matchesUnfinished =
      !unfinishedOnly.value || task.status !== 'done'

    return matchesText &&
      matchesStatus &&
      matchesPriority &&
      matchesUnfinished
  })

  // Сортуємо результат filter(), не змінюючи спільний масив.
  return result.sort((a, b) => {
    if (sortOrder.value === 'title') {
      return a.title.localeCompare(b.title, 'uk-UA') || a.id - b.id
    }

    if (sortOrder.value === 'priority') {
      return priorityWeight[b.priority] - priorityWeight[a.priority] ||
        b.id - a.id
    }

    if (sortOrder.value === 'dueDate') {
      const first = a.dueDate || '9999-12-31'
      const second = b.dueDate || '9999-12-31'

      return first.localeCompare(second) || b.id - a.id
    }

    if (sortOrder.value === 'status') {
      return statusWeight[a.status] - statusWeight[b.status] ||
        b.id - a.id
    }

    // Зворотне сортування за датою.
    // Завдання без дати завжди залишаються наприкінці.
    if (sortOrder.value === 'dueDateDesc') {
      if (!a.dueDate && !b.dueDate) return b.id - a.id
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1

      return b.dueDate.localeCompare(a.dueDate) || b.id - a.id
    }

    return b.id - a.id
  })
})

// Частка виконаних завдань серед знайдених.
const completionPercent = computed(() => {
  if (visibleTasks.value.length === 0) return 0

  const completed = visibleTasks.value.filter(
    (task) => task.status === 'done'
  ).length

  return Math.round((completed / visibleTasks.value.length) * 100)
})

// Перевірка повністю порожнього списку.
const isTaskListEmpty = computed(() => taskState.tasks.length === 0)

const editingTask = computed(() =>
  taskState.tasks.find((task) => task.id === editingId.value) ?? null
)

function resetFilters() {
  searchQuery.value = ''
  selectedStatus.value = 'all'
  selectedPriority.value = 'all'
  sortOrder.value = 'newest'
  unfinishedOnly.value = false
}

function handleStatusChange(payload) {
  setTaskStatus(payload)
}

function handlePriorityChange(payload) {
  setTaskPriority(payload)
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
    ? updateTask({ id: editingId.value, ...data })
    : addTask(data)

  if (!saved) {
    feedback.value = 'Не вдалося зберегти завдання. Перевірте дані форми.'
    return
  }

  feedback.value = isEditing
    ? `Завдання «${saved.title}» оновлено.`
    : `Завдання «${saved.title}» створено.`

  cancelForm()
  resetFilters()
}

function handleDelete(id) {
  const task = taskState.tasks.find((item) => item.id === id)
  if (!task) return

  const confirmed = window.confirm(
    `Видалити завдання «${task.title}»?`
  )

  if (!confirmed) return

  if (deleteTask(id)) {
    if (editingId.value === id) cancelForm()
    feedback.value = `Завдання «${task.title}» видалено.`
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
          Створюйте, редагуйте, знаходьте,
          сортуйте та видаляйте завдання.
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

      <section
        v-if="formVisible"
        ref="formAnchor"
        class="tf4-form-section"
      >
        <TaskForm
          :key="editingId ?? 'new'"
          :task="editingTask"
          @save="saveTask"
          @cancel="cancelForm"
        />
      </section>

      <TaskListControls
        v-model:search="searchQuery"
        v-model:status="selectedStatus"
        v-model:priority="selectedPriority"
        v-model:sort="sortOrder"
        v-model:unfinishedOnly="unfinishedOnly"
        @reset="resetFilters"
      />

      <section class="tf3-section">
        <div class="tf3-section-heading">
          <div>
            <div class="tf3-eyebrow">TASK LIST</div>
            <h2>Список завдань</h2>
          </div>

          <div class="tf3-counter">
            Показано: {{ visibleTasks.length }}
            із {{ taskState.tasks.length }}
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

        <div v-else-if="visibleTasks.length" class="tf3-task-grid">
          <TaskCard
            v-for="task in visibleTasks"
            :key="task.id"
            :task="task"
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
