<script setup>
defineProps({
  count: {
    type: Number,
    required: true,
  },
})
</script>

<template>
  <div class="tf3-counter">
    Знайдено: {{ count }}
  </div>
</template>