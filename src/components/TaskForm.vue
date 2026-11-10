
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useTasksStore } from '../store/tasks'

const props = defineProps({
  task: { type: Object, default: null },
  projects: { type: Array, required: true },
})

const emit = defineEmits(['save', 'cancel'])
const taskStore = useTasksStore()

// Копіюємо поля, щоб не змінювати завдання до збереження.
const form = reactive({
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: 'study',
  dueDate: '',
  projectId: 'general',
})

const showErrors = ref(false)
const isEditing = computed(() => props.task !== null)

watch(
  () => props.task,
  (task) => {
    form.title = task?.title ?? ''
    form.description = task?.description ?? ''
    form.status = task?.status ?? 'todo'
    form.priority = task?.priority ?? 'medium'
    form.category = task?.category ?? 'study'
    form.dueDate = task?.dueDate ?? ''
    form.projectId = task?.projectId ?? 'general'
    showErrors.value = false
  },
  { immediate: true }
)

const remainingTitle = computed(() => 80 - form.title.length)
const remainingDescription = computed(() => 300 - form.description.length)

const statusLabels = {
  todo: 'Заплановано',
  progress: 'У роботі',
  done: 'Виконано',
}

const priorityLabels = {
  low: 'Низький',
  medium: 'Середній',
  high: 'Високий',
}

const categoryLabels = {
  study: 'Навчання',
  work: 'Робота',
  personal: 'Особисте',
}

const selectedProjectTitle = computed(() =>
  props.projects.find(
    (project) => project.id === form.projectId
  )?.title ?? 'Загальні'
)

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T12:00:00`)

  return !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

function todayDate() {
  const today = new Date()

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const errors = computed(() => {
  const result = {}
  const title = form.title.trim()
  const description = form.description.trim()

  if (!title) {
    result.title = 'Вкажіть назву завдання.'
  } else if (title.length < 3) {
    result.title = 'Назва має містити щонайменше 3 символи.'
  } else if (title.length > 80) {
    result.title = 'Максимальна довжина — 80 символів.'
  } else if (!isEditing.value && taskStore.tasks.some(
    (task) =>
      task.title.trim().toLocaleLowerCase('uk-UA') ===
      title.toLocaleLowerCase('uk-UA')
  )) {
    result.title = 'Завдання з такою назвою вже існує.'
  }

  if (description.length > 300) {
    result.description = 'Опис не повинен перевищувати 300 символів.'
  }

  if (!['todo', 'progress', 'done'].includes(form.status)) {
    result.status = 'Оберіть коректний статус.'
  }

  if (!['low', 'medium', 'high'].includes(form.priority)) {
    result.priority = 'Оберіть коректний пріоритет.'
  }

  if (!['study', 'work', 'personal'].includes(form.category)) {
    result.category = 'Оберіть коректну категорію.'
  }

  if (!props.projects.some(
    (project) => project.id === form.projectId
  )) {
    result.projectId = 'Оберіть проєкт зі списку.'
  }

  // Дата необов'язкова. Якщо вона вказана, перевіряємо її.
  if (form.dueDate && !isValidDate(form.dueDate)) {
    result.dueDate = 'Укажіть коректну дату завершення.'
  } else if (
    form.dueDate &&
    form.dueDate < todayDate() &&
    form.dueDate !== props.task?.dueDate
  ) {
    result.dueDate = 'Дата завершення не може бути минулою.'
  }

  return result
})

function clearForm() {
  form.title = ''
  form.description = ''
  form.status = 'todo'
  form.priority = 'medium'
  form.category = 'study'
  form.dueDate = ''
  form.projectId = 'general'
  showErrors.value = false
}

function submitForm() {
  showErrors.value = true

  if (Object.keys(errors.value).length > 0) return

  emit('save', {
    id: props.task?.id ?? null,
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    category: form.category,
    dueDate: form.dueDate,
    projectId: form.projectId,
  })
}
</script>

<template>
  <div class="tf4-form-panel">
    <div class="tf4-form-heading">
      <div>
        <div class="tf3-eyebrow">TASKFLOW / FORM</div>
        <h2>{{ isEditing ? 'Редагування завдання' : 'Нове завдання' }}</h2>
      </div>

      <button type="button" class="tf4-close" @click="emit('cancel')">
        Закрити
      </button>
    </div>

    <form class="tf4-form" novalidate @submit.prevent="submitForm">
      <div class="tf4-field tf4-field--wide">
        <label for="tf4-title">Назва завдання *</label>

        <input
          id="tf4-title"
          v-model.trim="form.title"
          type="text"
          placeholder="Наприклад: Підготувати звіт"
          maxlength="80"
          :aria-invalid="showErrors && !!errors.title"
          :aria-describedby="showErrors && errors.title ? 'tf4-title-error' : undefined"
          aria-required="true"
        />

        <small>
          Від 3 до 80 символів. Введено: {{ form.title.length }}/80.
          Залишилося: {{ remainingTitle }}
        </small>

        <p
          v-if="showErrors && errors.title"
          id="tf4-title-error"
          class="tf4-error"
        >
          {{ errors.title }}
        </p>
      </div>

      <div class="tf4-field tf4-field--wide">
        <label for="tf4-description">Опис</label>

        <textarea
          id="tf4-description"
          v-model.trim="form.description"
          placeholder="Що потрібно зробити?"
          rows="3"
          maxlength="300"
          :aria-invalid="showErrors && !!errors.description"
          :aria-describedby="showErrors && errors.description ? 'tf4-description-error' : undefined"
        ></textarea>

        <small>
          Необов'язкове поле. Введено: {{ form.description.length }}/300.
          Залишилося: {{ remainingDescription }}
        </small>

        <p
          v-if="showErrors && errors.description"
          id="tf4-description-error"
          class="tf4-error"
        >
          {{ errors.description }}
        </p>
      </div>

      <div class="tf4-field">
        <label for="tf4-status">Статус *</label>

        <select
          id="tf4-status"
          v-model="form.status"
          :aria-invalid="showErrors && !!errors.status"
          :aria-describedby="showErrors && errors.status ? 'tf4-status-error' : undefined"
          aria-required="true"
        >
          <option value="todo">Заплановано</option>
          <option value="progress">У роботі</option>
          <option value="done">Виконано</option>
        </select>

        <p
          v-if="showErrors && errors.status"
          id="tf4-status-error"
          class="tf4-error"
        >
          {{ errors.status }}
        </p>
      </div>

      <div class="tf4-field">
        <label for="tf4-priority">Пріоритет *</label>

        <select
          id="tf4-priority"
          v-model="form.priority"
          :aria-invalid="showErrors && !!errors.priority"
          :aria-describedby="showErrors && errors.priority ? 'tf4-priority-error' : undefined"
          aria-required="true"
        >
          <option value="low">Низький</option>
          <option value="medium">Середній</option>
          <option value="high">Високий</option>
        </select>

        <p
          v-if="showErrors && errors.priority"
          id="tf4-priority-error"
          class="tf4-error"
        >
          {{ errors.priority }}
        </p>
      </div>

      <div class="tf4-field tf4-field--wide">
        <label for="tf4-category">Категорія *</label>

        <select
          id="tf4-category"
          v-model="form.category"
          :aria-invalid="showErrors && !!errors.category"
          :aria-describedby="showErrors && errors.category ? 'tf4-category-error' : undefined"
          aria-required="true"
        >
          <option value="study">Навчання</option>
          <option value="work">Робота</option>
          <option value="personal">Особисте</option>
        </select>

        <p
          v-if="showErrors && errors.category"
          id="tf4-category-error"
          class="tf4-error"
        >
          {{ errors.category }}
        </p>
      </div>

      <div class="tf4-field tf4-field--wide">
        <label for="tf4-project">Проєкт *</label>

        <select
          id="tf4-project"
          v-model="form.projectId"
          :aria-invalid="showErrors && !!errors.projectId"
          :aria-describedby="showErrors && errors.projectId ? 'tf4-project-error' : undefined"
          aria-required="true"
        >
          <option
            v-for="project in projects"
            :key="project.id"
            :value="project.id"
          >
            {{ project.title }}
          </option>
        </select>

        <p
          v-if="showErrors && errors.projectId"
          id="tf4-project-error"
          class="tf4-error"
        >
          {{ errors.projectId }}
        </p>
      </div>

      <div class="tf4-field tf4-field--wide">
        <label for="tf4-date">Дата завершення</label>

        <input
          id="tf4-date"
          v-model="form.dueDate"
          type="date"
          :aria-invalid="showErrors && !!errors.dueDate"
          :aria-describedby="showErrors && errors.dueDate ? 'tf4-date-error' : undefined"
        />

        <small>
          Необов'язкове поле. Залиште порожнім, якщо терміну немає.
        </small>

        <p
          v-if="showErrors && errors.dueDate"
          id="tf4-date-error"
          class="tf4-error"
        >
          {{ errors.dueDate }}
        </p>
      </div>

      <div class="tf4-preview tf4-field--wide" aria-live="polite">
        <strong>Попередній перегляд</strong>

        <p>{{ form.title || 'Назва нового завдання' }}</p>

        <span>
          {{ statusLabels[form.status] }} ·
          {{ priorityLabels[form.priority] }} ·
          {{ categoryLabels[form.category] }} ·
          {{ selectedProjectTitle }}
        </span>
      </div>

      <div class="tf4-actions tf4-field--wide">
        <button type="submit" class="tf4-save">
          {{ isEditing ? 'Зберегти зміни' : 'Створити завдання' }}
        </button>

        <button
          v-if="!isEditing"
          type="button"
          class="tf4-cancel"
          @click="clearForm"
        >
          Очистити форму
        </button>

        <button type="button" class="tf4-cancel" @click="emit('cancel')">
          Скасувати
        </button>
      </div>
    </form>
  </div>
</template>
