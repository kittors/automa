<template>
  <header class="header">
    <div class="container header__inner">
      <div class="brand">Automa Runner</div>
      <div class="spacer"></div>
      <slot></slot>
    </div>
  </header>
</template>

<script setup>
// 单一职责：显示固定在顶部的浅色蓝主题标题栏
</script>

<style scoped>
.header{
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  background: #fff;
  border-bottom: 1px solid var(--c-border);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.06);
  z-index: 1000;
}
.header__inner{
  height: 100%; display: flex; align-items: center; gap: 12px;
}
.brand{
  font-weight: 700; font-size: 18px; color: var(--c-blue);
}
.spacer{ flex: 1 1 auto; }
</style>
