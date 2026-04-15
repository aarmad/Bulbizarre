<template>
  <div class="auth-page">
    <div class="auth-card card">
      <!-- Header -->
      <div class="auth-header">
        <div class="auth-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div>
          <p class="auth-label">{{ mode === 'login' ? 'Accès sécurisé' : 'Nouveau compte' }}</p>
          <h1 class="auth-title">{{ mode === 'login' ? 'Connexion' : 'Inscription' }}</h1>
        </div>
      </div>

      <!-- Message de retour -->
      <div v-if="message" :class="['auth-message', messageType]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ message }}
      </div>

      <!-- Formulaire -->
      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="vous@example.com"
            class="form-input"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="••••••••"
            class="form-input"
            :disabled="loading"
          />
        </div>

        <button type="submit" class="btn-primary submit-btn" :disabled="loading">
          <svg v-if="!loading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {{ loading ? 'Chargement...' : (mode === 'login' ? 'Se connecter' : "S'inscrire") }}
        </button>
      </form>

      <!-- Switch -->
      <div class="auth-switch">
        <span v-if="mode === 'login'">
          Pas encore de compte ?
          <button class="switch-link" @click="router.push('/register')">S'inscrire</button>
        </span>
        <span v-else>
          Déjà un compte ?
          <button class="switch-link" @click="router.push('/login')">Se connecter</button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../services/api'

const props = defineProps({
  mode: {
    type: String,
    required: true,
  },
})

const router = useRouter()
const email = ref('')
const password = ref('')
const message = ref('')
const messageType = ref('error')
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  message.value = ''
  try {
    if (props.mode === 'register') {
      await authApi.register({ email: email.value, password: password.value })
      message.value = 'Inscription réussie ! Vous pouvez vous connecter.'
      messageType.value = 'success'
    } else {
      const response = await authApi.login({ email: email.value, password: password.value })
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('userId', response.data.userId)
      router.push('/')
    }
  } catch (error) {
    console.error(error)
    message.value = 'Erreur : vérifiez vos identifiants.'
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ─── CARD ──────────────────────────────────── */
.auth-card {
  width: 100%;
  max-width: 440px;
  padding: 36px;
  animation: fadeIn 0.3s ease;
}

/* ─── HEADER ────────────────────────────────── */
.auth-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.auth-badge {
  width: 48px;
  height: 48px;
  background: var(--text);
  color: var(--bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.auth-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 4px;
}

.auth-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--text);
}

/* ─── MESSAGE ────────────────────────────────── */
.auth-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 24px;
  animation: slideIn 0.25s ease;
}

.auth-message.error {
  background: rgba(255, 68, 68, 0.1);
  border: 2px solid #ff4444;
  color: #ff4444;
}

.auth-message.success {
  background: rgba(0, 200, 81, 0.1);
  border: 2px solid #00C851;
  color: #00C851;
}

/* ─── FORM ───────────────────────────────────── */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
}

.form-input {
  border: none;
  border-bottom: 2px solid var(--accent);
  padding: 10px 0;
  font-size: 16px;
  font-weight: 700;
  background: transparent;
  color: var(--text);
  outline: none;
  font-family: inherit;
  transition: var(--transition);
  width: 100%;
}

.form-input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.form-input:focus {
  border-bottom-color: var(--text);
}

.form-input:disabled {
  opacity: 0.5;
}

/* ─── SUBMIT ─────────────────────────────────── */
.submit-btn {
  width: 100%;
  justify-content: center;
  padding: 16px;
  font-size: 14px;
  border-radius: 12px;
  margin-top: 8px;
}

/* ─── SWITCH ─────────────────────────────────── */
.auth-switch {
  margin-top: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.switch-link {
  background: none;
  border: none;
  color: var(--text);
  font-weight: 800;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: var(--transition);
  padding: 0;
}

.switch-link:hover {
  opacity: 0.7;
}

/* ─── SPIN ────────────────────────────────────── */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
