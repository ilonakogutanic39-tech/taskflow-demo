
<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import AppTabbar from '../components/AppTabbar.vue'
import TaskCard from '../components/TaskCard.vue'
import { useTasksStore } from '../store/tasks'
import { useProjectsStore } from '../store/projects'
import '../css/task-components.css'
import '../css/task-list.css'

const taskStore = useTasksStore()
const projectStore = useProjectsStore()

const {
  tasks,
  totalTasks,
  completedTasks,
  progressTasks,
  plannedTasks,
  completionRate,
  activeTasks,
} = storeToRefs(taskStore)

const { projectCount, projectStats } = storeToRefs(projectStore)

// Статистика кожного проєкту.
const projectOverview = computed(() =>
  projectStats.value.map((project) => {
    const projectTasks = tasks.value.filter(
      (task) => task.projectId === project.id
    )

    const completed = projectTasks.filter(
      (task) => task.status === 'done'
    ).length

    const total = projectTasks.length

    return {
      ...project,
      unfinishedCount: total - completed,
      completionPercent: total === 0
        ? 0
        : Math.round((completed / total) * 100),
    }
  })
)

function handleStatusChange(payload) {
  taskStore.setTaskStatus(payload)
}

function handlePriorityChange(payload) {
  taskStore.setTaskPriority(payload)
}

function projectTitleFor(task) {
  return projectStore.projectTitle(task.projectId)
}
</script>

<template>
  <f7-page name="home" class="tf3-page">
    <f7-navbar title="TaskFlow">
      <f7-nav-right>
        <f7-link href="/about/">Про застосунок</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="tf3-container">
      <section class="tf3-hero">
        <div class="tf3-eyebrow">TASKFLOW / DASHBOARD</div>
        <h1>Панель керування</h1>
        <p>
          Контролюйте виконання завдань та їхні пріоритети.
          Проєктів: {{ projectCount }}.
        </p>
      </section>

      <section class="tf3-stat-grid">
        <div class="tf3-stat">
          <span class="tf3-stat-label">Усього завдань</span>
          <strong>{{ totalTasks }}</strong>
        </div>

        <div class="tf3-stat">
          <span class="tf3-stat-label">У роботі</span>
          <strong>{{ progressTasks }}</strong>
        </div>

        <div class="tf3-stat">
          <span class="tf3-stat-label">Виконано</span>
          <strong>{{ completedTasks }}</strong>
        </div>

        <div class="tf3-stat">
          <span class="tf3-stat-label">Заплановано</span>
          <strong>{{ plannedTasks }}</strong>
        </div>

        <div class="tf3-stat">
          <span class="tf3-stat-label">Відсоток виконання</span>
          <strong>{{ completionRate }}%</strong>
        </div>
      </section>

      <section class="tf5-panel" aria-label="Статистика проєктів">
        <h2>Проєкти та невиконані завдання</h2>

        <div class="tf6-project-list">
          <div
            v-for="project in projectOverview"
            :key="project.id"
            class="tf6-project-pill"
          >
            <div>
              <div>{{ project.title }}</div>
              <small>
                Виконано: {{ project.completionPercent }}%
              </small>
            </div>

            <strong>{{ project.unfinishedCount }}</strong>
          </div>
        </div>
      </section>

      <section class="tf3-section">
        <div class="tf3-section-heading">
          <div>
            <div class="tf3-eyebrow">PRIORITY TASKS</div>
            <h2>Актуальні завдання</h2>
          </div>

          <f7-button href="/tasks/" outline small>
            Переглянути всі
          </f7-button>
        </div>

        <div v-if="activeTasks.length" class="tf3-task-grid">
          <TaskCard
            v-for="task in activeTasks"
            :key="task.id"
            :task="task"
            :project-title="projectTitleFor(task)"
            @status-change="handleStatusChange"
            @priority-change="handlePriorityChange"
          />
        </div>

        <div v-else class="tf3-empty">
          Наразі всі завдання виконані.
        </div>
      </section>
    </div>

    <AppTabbar active="home" />
  </f7-page>
</template>
