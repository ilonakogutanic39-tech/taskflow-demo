
<script setup>
import { computed, nextTick, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppTabbar from '../components/AppTabbar.vue'
import TaskCard from '../components/TaskCard.vue'
import TaskForm from '../components/TaskForm.vue'
import TaskListControls from '../components/TaskListControls.vue'
import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'
import '../css/task-components.css'
import '../css/task-form.css'
import '../css/task-list.css'

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
  completionPercent,
} = storeToRefs(taskStore)

const { projects } = storeToRefs(projectStore)

const formVisible = ref(false)
const editingId = ref(null)
const formAnchor = ref(null)
const feedback = ref('')
const newProjectTitle = ref('')
const newProjectError = ref('')

// Кількість завдань у кожному проєкті.
const projectStats = computed(() =>
  projects.value.map((project) => ({
    ...project,
    taskCount: tasks.value.filter(
      (task) => task.projectId === project.id
    ).length,
  }))
)

// Частина інтерфейсу, яка потрібна тільки цій сторінці.
const isTaskListEmpty = computed(() => tasks.value.length === 0)

const editingTask = computed(() =>
  tasks.value.find((task) => task.id === editingId.value) ?? null
)

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
  const task = tasks.value.find((item) => item.id === Number(id))
  if (!task) return

  const confirmed = window.confirm(
    `Видалити завдання «${task.title}»?`
  )

  if (!confirmed) return

  if (taskStore.deleteTask(id)) {
    if (editingId.value === id) cancelForm()
    feedback.value = `Завдання «${task.title}» видалено.`
  }
}

// Створення нового проєкту через Pinia.
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

      <section class="tf5-panel tf6-project-panel" aria-label="Проєкти">
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

      <TaskListControls
        v-model:search="searchText"
        v-model:status="selectedStatus"
        v-model:priority="selectedPriority"
        v-model:project="selectedProject"
        v-model:sort="sortOrder"
        v-model:unfinishedOnly="unfinishedOnly"
        :projects="projects"
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

        <div v-else-if="visibleTasks.length" class="tf3-task-grid">
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
