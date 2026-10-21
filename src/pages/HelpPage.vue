<template>
  <f7-page name="help">
    <f7-navbar title="Допомога" back-link="Назад" />

    <div class="app-content">
      <div class="page-heading">
        <h1>Допомога</h1>
        <p>Правила використання TaskFlow</p>
      </div>

      <div class="info-card">
        <h3>Як користуватися TaskFlow</h3>

        <p>
          1. На головній сторінці можна переглянути загальну
          кількість завдань і кількість виконаних.
        </p>

        <p>
          2. У розділі «Завдання» відображається список
          поточних завдань з описами та статусами.
        </p>

        <p>
          3. Виконані завдання позначаються зеленою іконкою,
          а завдання, що очікують виконання, — порожнім колом.
        </p>

        <p>
          4. Для переходу між основними сторінками
          використовуйте нижню навігаційну панель.
        </p>
      </div>

      <f7-button fill href="/about/" class="page-action">
        Повернутися до застосунку
      </f7-button>
    </div>

    <AppTabbar active="about" />
  </f7-page>
</template>

<script setup>
import AppTabbar from '../components/AppTabbar.vue';
</script>