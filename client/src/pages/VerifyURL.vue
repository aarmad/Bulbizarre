<template>
  <div class="verify-page">
    <!-- Header card -->
    <div class="verify-header card">
      <div class="verify-header-inner">
        <div class="verify-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <div>
          <p class="verify-label">Analyse de source</p>
          <h1 class="verify-title">Vérification d'Article</h1>
        </div>
      </div>
      <p class="verify-desc">
        Entrez l'URL d'un article pour analyser sa fiabilité et obtenir un score de crédibilité.
      </p>
    </div>

    <!-- Input card -->
    <div class="input-card card">
      <label class="field-label">URL de l'article</label>
      <div class="input-row">
        <div class="input-wrapper">
          <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <input
            v-model="url"
            type="text"
            placeholder="https://..."
            :disabled="loading"
            @keyup.enter="handleVerify"
            class="url-input"
          />
        </div>
        <button
          class="btn-primary analyze-btn"
          :disabled="loading || !url.trim()"
          @click="handleVerify"
        >
          <svg v-if="!loading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {{ loading ? 'Analyse...' : 'Analyser' }}
        </button>
      </div>
    </div>

    <!-- Result card -->
    <transition name="result">
      <div v-if="result" class="result-card card">
        <!-- Score -->
        <div class="score-section">
          <div class="score-ring" :style="{ '--score-color': scoreColor }">
            <span class="score-number">{{ result.score }}</span>
            <span class="score-unit">%</span>
          </div>
          <div class="score-info">
            <p class="field-label">Score de fiabilité</p>
            <div class="verdict-chip" :style="{ background: scoreColor + '22', borderColor: scoreColor, color: scoreColor }">
              <span class="verdict-dot" :style="{ background: scoreColor }"></span>
              {{ result.verdict }}
            </div>
            <p class="score-desc">{{ scoreDescription }}</p>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: result.score + '%', background: scoreColor }"
          ></div>
        </div>
        <div class="progress-labels">
          <span>Non fiable</span>
          <span>Fiable</span>
        </div>
      </div>
    </transition>

    <!-- Error message -->
    <div v-if="error" class="error-toast">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { verifyApi } from '../services/api'

const url = ref('')
const result = ref(null)
const loading = ref(false)
const error = ref('')

const scoreColor = computed(() => {
  if (!result.value) return '#888'
  const s = result.value.score
  if (s >= 70) return '#00C851'
  if (s >= 40) return '#ffbb33'
  return '#ff4444'
})

const scoreDescription = computed(() => {
  if (!result.value) return ''
  const s = result.value.score
  if (s >= 70) return 'Cet article est considéré comme fiable.'
  if (s >= 40) return 'Cet article présente des incertitudes.'
  return 'Cet article semble peu fiable.'
})

const handleVerify = async () => {
  if (!url.value.trim() || loading.value) return
  loading.value = true
  result.value = null
  error.value = ''

  try {
    const userId = localStorage.getItem('userId') || undefined
    const response = await verifyApi.url(url.value, userId)
    result.value = response.data
  } catch (err) {
    console.error(err)
    error.value = "Erreur lors de l'analyse du lien. Vérifiez l'URL et réessayez."
    setTimeout(() => { error.value = '' }, 4000)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.verify-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 720px;
  margin: 0 auto;
}

/* ─── HEADER ──────────────────────────────────── */
.verify-header {
  padding: 28px 32px;
}

.verify-header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.verify-icon {
  width: 50px;
  height: 50px;
  background: var(--text);
  color: var(--bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.verify-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 4px;
}

.verify-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -1px;
}

.verify-desc {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  line-height: 1.6;
  margin-left: 66px;
}

/* ─── INPUT CARD ──────────────────────────────── */
.input-card {
  padding: 24px 28px;
}

.field-label {
  display: block;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 12px;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 2px solid var(--accent);
  padding-bottom: 8px;
}

.input-icon {
  color: var(--muted);
  flex-shrink: 0;
}

.url-input {
  flex: 1;
  border: none;
  padding: 8px 0;
  font-size: 15px;
  font-weight: 600;
  background: transparent;
  color: var(--text);
  outline: none;
  font-family: inherit;
}

.url-input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.url-input:disabled {
  opacity: 0.5;
}

.analyze-btn {
  padding: 12px 22px;
  flex-shrink: 0;
}

/* ─── RESULT CARD ─────────────────────────────── */
.result-card {
  padding: 28px 32px;
  animation: fadeIn 0.3s ease;
}

.score-section {
  display: flex;
  align-items: center;
  gap: 28px;
  margin-bottom: 24px;
}

.score-ring {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 4px solid var(--score-color, #888);
  box-shadow: 0 0 0 2px var(--card), 0 0 0 6px var(--score-color, #888);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.4s, box-shadow 0.4s;
}

.score-number {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -2px;
  line-height: 1;
}

.score-unit {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.score-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.verdict-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 40px;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid;
  width: fit-content;
}

.verdict-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.score-desc {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

/* ─── PROGRESS BAR ────────────────────────────── */
.progress-track {
  width: 100%;
  height: 10px;
  background: var(--bg);
  border: var(--border);
  border-radius: 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
}

/* ─── ERROR TOAST ─────────────────────────────── */
.error-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: #ff4444;
  color: white;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
  box-shadow: var(--shadow);
  animation: slideIn 0.3s ease;
}

/* ─── TRANSITIONS ─────────────────────────────── */
.result-enter-active { transition: all 0.3s ease; }
.result-enter-from { opacity: 0; transform: translateY(16px); }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── SPIN ────────────────────────────────────── */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>
