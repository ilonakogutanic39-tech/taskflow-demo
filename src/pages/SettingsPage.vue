
<script setup>
import { computed, ref } from 'vue'
import { persistenceState, retrySave } from '../services/persistence'
import { readSnapshot } from '../services/database'
import AppTabbar from '../components/AppTabbar.vue'
import '../css/task-list.css'
import '../css/persistence.css'


const databaseInfo = ref(null)
const loadingInfo = ref(false)
const infoError = ref('')

const statusText = computed(() => {
  switch (persistenceState.status) {
    case 'loading':
      return 'Завантаження локальних даних…'
    case 'saving':
      return 'Збереження змін у IndexedDB…'
    case 'saved':
      return 'Усі зміни збережено в цьому браузері.'
    default:
      return persistenceState.error || 'Помилка локального збереження.'
  }
})

const lastSavedTime = computed(() => {
  if (!persistenceState.lastSavedAt) return 'Немає даних'

  return new Date(persistenceState.lastSavedAt).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})

async function refreshDatabaseInfo() {
  loadingInfo.value = true
  infoError.value = ''

  try {
    const snapshot = await readSnapshot()

    databaseInfo.value = {
      tasksCount: snapshot.tasks.length,
      projectsCount: snapshot.projects.length,
      initialized: snapshot.initialized,
      nextProjectId: snapshot.nextProjectId,
    }
  } catch (error) {
    console.error('TaskFlow: помилка читання IndexedDB:', error)
    infoError.value = 'Не вдалося прочитати локальну базу даних.'
  } finally {
    loadingInfo.value = false
  }
}

refreshDatabaseInfo()
</script>

<template>
  <f7-page name="settings" class="tf3-page">
    <f7-navbar title="Налаштування збереження">
      <f7-nav-left>
        <f7-link back>Назад</f7-link>
      </f7-nav-left>
    </f7-navbar>

    <div class="tf3-container">
      <section class="tf5-panel">
        <h1>Налаштування локального збереження</h1>

        <p>
          TaskFlow зберігає завдання та проєкти локально
          в IndexedDB цього браузера.
        </p>
      </section>

      <section
        class="tf7-persistence"
        :class="`tf7-persistence--${persistenceState.status}`"
        role="status"
      >
        <strong>Стан збереження</strong>
        <span>{{ statusText }}</span>

        <p style="width: 100%; margin: 0;">
          Останнє збереження / відновлення:
          <strong>{{ lastSavedTime }}</strong>
        </p>

        <button
          v-if="persistenceState.canRetry"
          type="button"
          class="tf5-btn"
          @click="retrySave"
        >
          Повторити збереження
        </button>
      </section>

      <section class="tf5-panel">
        <h2>Інформація про IndexedDB</h2>

        <p><strong>Назва бази:</strong> taskflow-db</p>
        <p><strong>Версія бази:</strong> 1</p>

        <template v-if="databaseInfo">
          <p>
            <strong>Завдань у базі:</strong>
            {{ databaseInfo.tasksCount }}
          </p>

          <p>
            <strong>Проєктів у базі:</strong>
            {{ databaseInfo.projectsCount }}
          </p>

          <p>
            <strong>Ініціалізація:</strong>
            {{ databaseInfo.initialized ? 'Виконана' : 'Не виконана' }}
          </p>

          <p>
            <strong>Наступний номер проєкту:</strong>
            {{ databaseInfo.nextProjectId }}
          </p>
        </template>

        <p v-if="infoError" class="tf5-error" role="alert">
          {{ infoError }}
        </p>

        <button
          type="button"
          class="tf5-btn tf5-btn--primary"
          :disabled="loadingInfo"
          @click="refreshDatabaseInfo"
        >
          {{ loadingInfo ? 'Оновлення…' : 'Оновити інформацію' }}
        </button>
      </section>

      <section class="tf5-panel">
        <h2>Безпека даних</h2>
        <p>
          Дані зберігаються тільки в цьому браузері.
          Для резервного копіювання використовуйте
          експорт JSON на сторінці «Мої завдання».
        </p>

        <p>
          Очищення даних браузера може призвести до втрати
          локальних завдань і проєктів.
        </p>
      </section>
    </div>

    <AppTabbar active="settings" />
  </f7-page>
</template>
