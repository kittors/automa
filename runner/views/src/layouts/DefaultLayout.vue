<template>
  <div class="page">
    <HeaderBar />
    <main class="container main">
      <slot />
    </main>
  </div>
</template>

<script setup>
import HeaderBar from '../components/common/HeaderBar.vue';
</script>

<style scoped>
.page{ min-height: 100%; display: flex; flex-direction: column; }
.main{ padding: 24px 20px 28px; }
</style>
