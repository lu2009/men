<template>
  <svg
    class="app-nav-icon"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="name === 'orders'">
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" />
      <path d="M8 3.5v-1M16 3.5v-1" />
    </template>

    <template v-else-if="name === 'quote'">
      <path d="M6 3.5h9l3 3v14H6z" />
      <path d="M15 3.5v3h3M9 10h6M9 14h2.5M14.5 13v4M12.5 15h4" />
    </template>

    <template v-else-if="name === 'progress'">
      <path d="M12 4a8 8 0 1 0 7.45 5.08" />
      <path d="M12 4v8l4.5 2.5M16 3.5h4v4" />
    </template>

    <template v-else-if="name === 'scanner'">
      <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" />
      <path d="M7 12h10" />
      <path d="M9.5 8.5h5v7h-5z" />
    </template>

    <template v-else-if="name === 'formula'">
      <path d="M5 19 9.5 5h4M7.3 12h5.3" />
      <path d="m14 10 5 8M19 10l-5 8" />
    </template>

    <template v-else-if="name === 'clients'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19c.45-3.3 2.2-5 5.2-5s4.75 1.7 5.2 5" />
      <path d="M15.5 6.2a2.8 2.8 0 0 1 0 5.6M16.2 14c2.35.45 3.65 2.1 4 5" />
    </template>

    <template v-else-if="name === 'logout'">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="M14 8l4 4-4 4M9 12h9" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  name: 'orders' | 'quote' | 'progress' | 'scanner' | 'formula' | 'clients' | 'logout'
}>()
</script>

<style scoped>
.app-nav-icon {
  width: 100%;
  height: 100%;
  display: block;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
  vector-effect: non-scaling-stroke;
}
</style>
