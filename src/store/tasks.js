
import { defineStore } from 'pinia'
import initialTasks from '../data/tasks'
import { useProjectsStore } from './projects'

const allowedStatuses = ['todo', 'progress', 'done']
const allowedPriorities = ['low', 'medium', 'high']
const allowedCategories = ['study', 'work', 'personal']

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T12:00:00`)

  return !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

function todayDate() {
  const today = new Date()

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function normalizeTaskData(data, projects, originalDueDate = null) {
  if (!data || typeof data !== 'object') return null

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const description = typeof data.description === 'string'
    ? data.description.trim()
    : ''

  const requestedProject = String(data.projectId ?? 'general')
  const projectId = projects.some(
    (project) => project.id === requestedProject
  ) ? requestedProject : 'general'

  if (title.length < 3 || title.length > 80) return null
  if (description.length > 300) return null
  if (!allowedStatuses.includes(data.status)) return null
  if (!allowedPriorities.includes(data.priority)) return null
  if (!allowedCategories.includes(data.category ?? 'study')) return null

  // Дата завершення тепер необов'язкова.
  const dueDate = data.dueDate ?? ''

  if (dueDate !== '' && !validDate(dueDate)) return null

  // Минулу дату дозволяємо лише без змін.
  if (
    dueDate !== '' &&
    dueDate < todayDate() &&
    dueDate !== originalDueDate
  ) {
    return null
  }

  return {
    title,
    description,
    status: data.status,
    priority: data.priority,
    category: data.category ?? 'study',
    dueDate,
    projectId,
  }
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: initialTasks.map((task) => ({
      ...task,
      category: task.category ?? 'study',
      projectId: task.projectId ?? 'general',
      dueDate: task.dueDate ?? '',
    })),

    searchText: '',
    selectedStatus: 'all',
    selectedPriority: 'all',
    selectedProject: 'all',
    sortOrder: 'newest',
    unfinishedOnly: false,

    // Додаткове завдання №5.
    withoutDueDateOnly: false,
  }),

  getters: {
    totalTasks: (state) => state.tasks.length,

    completedTasks: (state) =>
      state.tasks.filter((task) => task.status === 'done').length,

    progressTasks: (state) =>
      state.tasks.filter((task) => task.status === 'progress').length,

    plannedTasks: (state) =>
      state.tasks.filter((task) => task.status === 'todo').length,

    completionRate() {
      if (this.totalTasks === 0) return 0

      return Math.round((this.completedTasks / this.totalTasks) * 100)
    },

    activeTasks: (state) => {
      const rank = { high: 3, medium: 2, low: 1 }

      return state.tasks
        .filter((task) => task.status !== 'done')
        .sort((a, b) =>
          rank[b.priority] - rank[a.priority] || b.id - a.id
        )
        .slice(0, 3)
    },

    visibleTasks: (state) => {
      const term = state.searchText.trim().toLocaleLowerCase('uk-UA')
      const priorityWeight = { high: 3, medium: 2, low: 1 }
      const statusWeight = { progress: 1, todo: 2, done: 3 }

      const filtered = state.tasks.filter((task) => {
        const text = `${task.title} ${task.description ?? ''}`
          .toLocaleLowerCase('uk-UA')

        const matchesText = !term || text.includes(term)

        const matchesStatus =
          state.selectedStatus === 'all' ||
          task.status === state.selectedStatus

        const matchesPriority =
          state.selectedPriority === 'all' ||
          task.priority === state.selectedPriority

        const matchesProject =
          state.selectedProject === 'all' ||
          task.projectId === state.selectedProject

        const matchesUnfinished =
          !state.unfinishedOnly || task.status !== 'done'

        // Показуємо лише завдання без дати завершення.
        const matchesWithoutDueDate =
          !state.withoutDueDateOnly || !task.dueDate

        return matchesText &&
          matchesStatus &&
          matchesPriority &&
          matchesProject &&
          matchesUnfinished &&
          matchesWithoutDueDate
      })

      // Сортуємо окремий масив, не змінюючи state.tasks.
      return filtered.sort((a, b) => {
        if (state.sortOrder === 'title') {
          return a.title.localeCompare(b.title, 'uk-UA') || a.id - b.id
        }

        if (state.sortOrder === 'priority') {
          return priorityWeight[b.priority] - priorityWeight[a.priority] ||
            b.id - a.id
        }

        if (state.sortOrder === 'dueDate') {
          const first = a.dueDate || '9999-12-31'
          const second = b.dueDate || '9999-12-31'

          return first.localeCompare(second) || b.id - a.id
        }

        if (state.sortOrder === 'status') {
          return statusWeight[a.status] - statusWeight[b.status] ||
            b.id - a.id
        }

        if (state.sortOrder === 'dueDateDesc') {
          if (!a.dueDate && !b.dueDate) return b.id - a.id
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1

          return b.dueDate.localeCompare(a.dueDate) || b.id - a.id
        }

        return b.id - a.id
      })
    },

    completionPercent() {
      if (this.visibleTasks.length === 0) return 0

      const completed = this.visibleTasks.filter(
        (task) => task.status === 'done'
      ).length

      return Math.round((completed / this.visibleTasks.length) * 100)
    },
  },

  actions: {
    addTask(data) {
      const projectStore = useProjectsStore()
      const normalized = normalizeTaskData(data, projectStore.projects)

      if (!normalized) return null

      // Унікальність назви без урахування регістру.
      const exists = this.tasks.some(
        (task) =>
          task.title.trim().toLocaleLowerCase('uk-UA') ===
          normalized.title.toLocaleLowerCase('uk-UA')
      )

      if (exists) return null

      const nextId = this.tasks.reduce(
        (maxId, task) => Math.max(maxId, task.id), 0
      ) + 1

      const newTask = { id: nextId, ...normalized }
      this.tasks.push(newTask)

      return newTask
    },

    updateTask({ id, ...data }) {
      const task = this.tasks.find(
        (item) => item.id === Number(id)
      )

      if (!task) return null

      const projectStore = useProjectsStore()

      const normalized = normalizeTaskData(
        data,
        projectStore.projects,
        task.dueDate
      )

      if (!normalized) return null

      Object.assign(task, normalized)
      return task
    },

    deleteTask(id) {
      const index = this.tasks.findIndex(
        (task) => task.id === Number(id)
      )

      if (index === -1) return false

      this.tasks.splice(index, 1)
      return true
    },

    setTaskStatus({ id, status }) {
      if (!allowedStatuses.includes(status)) return false

      const task = this.tasks.find(
        (item) => item.id === Number(id)
      )

      if (!task) return false

      task.status = status
      return true
    },

    setTaskPriority({ id, priority }) {
      if (!allowedPriorities.includes(priority)) return false

      const task = this.tasks.find(
        (item) => item.id === Number(id)
      )

      if (!task) return false

      task.priority = priority
      return true
    },

    // Додаткове завдання №4.
    // Групова зміна статусу завдань вибраного проєкту.
    setProjectTasksInProgress(projectId) {
      const projectStore = useProjectsStore()

      const projectExists = projectStore.projects.some(
        (project) => project.id === projectId
      )

      if (!projectExists) return 0

      let updatedCount = 0

      this.tasks.forEach((task) => {
        if (
          task.projectId === projectId &&
          task.status !== 'progress'
        ) {
          task.status = 'progress'
          updatedCount++
        }
      })

      return updatedCount
    },

    resetFilters() {
      this.searchText = ''
      this.selectedStatus = 'all'
      this.selectedPriority = 'all'
      this.selectedProject = 'all'
      this.sortOrder = 'newest'
      this.unfinishedOnly = false
      this.withoutDueDateOnly = false
    },
  },
})
