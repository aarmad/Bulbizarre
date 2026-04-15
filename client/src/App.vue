<template>
  <div class="app-root">
    <nav class="navbar">
      <div class="nav-inner">
        <!-- Logo -->
        <div class="nav-logo">
          <img src="/favicon.png" alt="Bulbizarre" class="logo-img" />
          <span>Bulbizarre</span>
        </div>

        <!-- Links -->
        <ul class="nav-links">
          <li>
            <router-link to="/">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chatbot
            </router-link>
          </li>
          <li>
            <router-link to="/verify">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Vérifier URL
            </router-link>
          </li>
          <li>
            <router-link to="/login">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Connexion
            </router-link>
          </li>
        </ul>

        <!-- Dark mode toggle -->
        <button class="theme-toggle" @click="toggleDark" :title="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'">
          <svg v-if="!isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
      </div>
    </nav>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isDark = ref(false)

const toggleDark = () => {
  isDark.value = !isDark.value
  document.body.classList.toggle('dark-mode', isDark.value)
}
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ─── NAVBAR ──────────────────────────────────── */
.navbar {
  background: var(--card);
  border-bottom: var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s;
}

.nav-inner {
  max-width: 1400px;
  width: 95%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  gap: 24px;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}

.logo-img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}

/* ─── NAV LINKS ───────────────────────────────── */
.nav-links {
  display: flex;
  list-style: none;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.nav-links a {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--muted);
  border-radius: 10px;
  border: 2px solid transparent;
  transition: var(--transition);
}

.nav-links a:hover {
  color: var(--text);
  background: var(--bg);
}

.nav-links a.router-link-active {
  color: var(--text);
  background: var(--bg);
  border: var(--border);
  box-shadow: var(--shadow);
}

/* ─── THEME TOGGLE ────────────────────────────── */
.theme-toggle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: var(--border);
  box-shadow: var(--shadow);
  background: var(--text);
  color: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
}

.theme-toggle:hover {
  transform: scale(0.95);
}

/* ─── MAIN CONTENT ────────────────────────────── */
.main-content {
  flex: 1;
  max-width: 1400px;
  width: 95%;
  margin: 0 auto;
  padding: 40px 0 60px;
  width: 100%;
  max-width: 1400px;
  padding-left: max(2.5%, 20px);
  padding-right: max(2.5%, 20px);
}
</style>
