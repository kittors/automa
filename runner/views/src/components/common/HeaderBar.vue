<template>
  <header class="header">
    <div class="container header__inner">
      <div class="brand">{{ appName }}</div>
      <nav class="nav">
        <router-link to="/app" class="nav__link" active-class="is-active" exact-active-class="is-active">工作流执行</router-link>
        <router-link to="/scheduler" class="nav__link" active-class="is-active">定时器编排</router-link>
      </nav>
      <div class="spacer"></div>
      <slot></slot>
    </div>
  </header>
</template>

<script setup>
// 单一职责：固定顶栏（浅色蓝主题）+ 导航
import { APP_NAME } from '../../config/app.js';
const appName = APP_NAME;
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
.nav{ display:flex; align-items:center; gap: 10px; margin-left: 20px; }
.nav__link{ color:#334155; text-decoration:none; padding:6px 10px; border-radius:8px; }
.nav__link:hover{ background:#eef2ff; color:#1d4ed8; }
.nav__link.is-active{ background:#dbeafe; color:#1d4ed8; }
.spacer{ flex: 1 1 auto; }
</style>

