<template>
  <div class="verify-page">
    <!-- Header -->
    <div class="verify-header card">
      <div class="verify-header-inner">
        <div class="verify-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <div>
          <p class="field-label">Analyse de source · Mistral 7B</p>
          <h1 class="verify-title">Vérification d'Article</h1>
        </div>
      </div>
      <p class="verify-desc">
        Collez l'URL d'un article. Le système récupère le contenu, analyse le domaine, la structure et le style rédactionnel, puis génère un score de fiabilité.
      </p>
    </div>

    <!-- Input -->
    <div class="input-card card">
      <label class="field-label">URL de l'article à analyser</label>
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
          {{ loading ? 'Analyse en cours...' : 'Analyser' }}
        </button>
      </div>

      <!-- Steps de chargement -->
      <div v-if="loading" class="loading-steps">
        <div v-for="(step, i) in loadingSteps" :key="i" :class="['step', step.status]">
          <div class="step-dot">
            <svg v-if="step.status === 'done'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span v-else-if="step.status === 'active'" class="step-spinner"></span>
          </div>
          <span class="step-label">{{ step.label }}</span>
        </div>
      </div>
    </div>

    <!-- Résultat -->
    <transition name="result-fade">
      <div v-if="result" class="result-grid">
        <!-- Score -->
        <div class="score-card card">
          <p class="field-label">Score de fiabilité</p>
          <div class="score-display">
            <div class="score-ring" :style="{ '--color': scoreColor }">
              <span class="score-number">{{ result.score }}</span>
              <span class="score-unit">/ 100</span>
            </div>
            <div class="score-meta">
              <div class="verdict-chip" :style="{ background: scoreColor + '22', borderColor: scoreColor, color: scoreColor }">
                <span class="verdict-dot" :style="{ background: scoreColor }"></span>
                {{ result.verdict }}
              </div>
              <p class="score-domain">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                {{ result.domain }}
              </p>
            </div>
          </div>

          <!-- Barre de progression -->
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: result.score + '%', background: scoreColor }"></div>
          </div>
          <div class="progress-labels">
            <span>Non fiable</span>
            <span>Très fiable</span>
          </div>
        </div>

        <!-- Détails -->
        <div class="details-card card">
          <p class="field-label">Analyse détaillée</p>

          <!-- Critères structurels -->
          <div class="criteria-list">
            <div class="criterion" :class="result.metadata?.hasAuthor ? 'ok' : 'fail'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline v-if="result.metadata?.hasAuthor" points="20 6 9 17 4 12"/>
                <line v-else x1="18" y1="6" x2="6" y2="18"/>
                <line v-if="!result.metadata?.hasAuthor" x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Auteur identifié
            </div>
            <div class="criterion" :class="result.metadata?.hasDate ? 'ok' : 'fail'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline v-if="result.metadata?.hasDate" points="20 6 9 17 4 12"/>
                <line v-else x1="18" y1="6" x2="6" y2="18"/>
                <line v-if="!result.metadata?.hasDate" x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Date de publication
            </div>
            <div class="criterion" :class="result.metadata?.hasSourceLinks ? 'ok' : 'fail'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline v-if="result.metadata?.hasSourceLinks" points="20 6 9 17 4 12"/>
                <line v-else x1="18" y1="6" x2="6" y2="18"/>
                <line v-if="!result.metadata?.hasSourceLinks" x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Liens vers des sources
            </div>
          </div>

          <!-- Analyse IA -->
          <div class="analysis-block">
            <p class="analysis-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Analyse IA
            </p>
            <p class="analysis-text">{{ result.analysis }}</p>
          </div>
        </div>
      </div>
    </transition>

    <!-- Erreur -->
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

const url    = ref('')
const result = ref(null)
const loading = ref(false)
const error  = ref('')

const userId = localStorage.getItem('userId') || null

const loadingSteps = ref([
  { label: 'Récupération de l\'article',       status: 'pending' },
  { label: 'Analyse du domaine',               status: 'pending' },
  { label: 'Analyse IA du contenu',            status: 'pending' },
  { label: 'Calcul du score de fiabilité',     status: 'pending' },
])

let stepTimer = null

function animateSteps() {
  loadingSteps.value.forEach(s => s.status = 'pending')
  let i = 0
  stepTimer = setInterval(() => {
    if (i > 0) loadingSteps.value[i - 1].status = 'done'
    if (i < loadingSteps.value.length) {
      loadingSteps.value[i].status = 'active'
      i++
    } else {
      clearInterval(stepTimer)
    }
  }, 1800)
}

function stopSteps() {
  clearInterval(stepTimer)
  loadingSteps.value.forEach(s => s.status = 'done')
}

const scoreColor = computed(() => {
  if (!result.value) return '#888'
  const s = result.value.score
  if (s >= 70) return '#00C851'
  if (s >= 40) return '#ffbb33'
  return '#ff4444'
})

const handleVerify = async () => {
  if (!url.value.trim() || loading.value) return

  loading.value = true
  result.value  = null
  error.value   = ''
  animateSteps()

  try {
    const res = await verifyApi.url(url.value.trim(), userId)
    result.value = res.data
  } catch (err) {
    console.error(err)
    error.value = "Erreur lors de l'analyse. Vérifiez l'URL et que le serveur est démarré."
    setTimeout(() => { error.value = '' }, 5000)
  } finally {
    loading.value = false
    stopSteps()
  }
}
</script>

<style scoped>
.verify-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 820px;
  margin: 0 auto;
}

/* ─── HEADER ──────────────────────────────────── */
.verify-header { padding: 26px 30px; }
.verify-header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}
.verify-icon {
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
.verify-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.8px;
}
.verify-desc {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  line-height: 1.6;
  margin-left: 64px;
}

@media (max-width: 640px) {
  .verify-page      { gap: 14px; }
  .verify-header    { padding: 18px 18px; }
  .verify-desc      { margin-left: 0; margin-top: 10px; }
  .verify-header-inner { gap: 12px; }
  .verify-title     { font-size: 20px; }
  .verify-icon      { width: 40px; height: 40px; }
  .input-card       { padding: 16px 18px; }
  .input-row        { flex-direction: column; align-items: stretch; gap: 12px; }
  .analyze-btn      { width: 100%; justify-content: center; }
  .score-card,
  .details-card     { padding: 18px 18px; }
}

/* ─── INPUT CARD ──────────────────────────────── */
.input-card { padding: 22px 26px; }

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

.input-icon { color: var(--muted); flex-shrink: 0; }

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
.url-input::placeholder { color: var(--muted); font-weight: 400; }
.url-input:disabled     { opacity: .5; }

.analyze-btn { flex-shrink: 0; padding: 12px 22px; }

/* ─── LOADING STEPS ───────────────────────────── */
.loading-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 2px solid var(--bg);
}

.step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  transition: color .3s;
}
.step.active { color: var(--text); }
.step.done   { color: #00C851; }

.step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-spinner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: spin 0.7s linear infinite;
}

/* ─── RESULT GRID ─────────────────────────────── */
.result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 640px) {
  .result-grid { grid-template-columns: 1fr; }
}

/* ─── SCORE CARD ──────────────────────────────── */
.score-card { padding: 24px 28px; }

.score-display {
  display: flex;
  align-items: center;
  gap: 24px;
  margin: 16px 0 20px;
}

.score-ring {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 4px solid var(--color, #888);
  box-shadow: 0 0 0 3px var(--card), 0 0 0 7px var(--color, #888);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color .4s, box-shadow .4s;
}
.score-number { font-size: 28px; font-weight: 800; letter-spacing: -2px; line-height: 1; }
.score-unit   { font-size: 11px; font-weight: 700; color: var(--muted); }

.score-meta { display: flex; flex-direction: column; gap: 10px; }

.verdict-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 40px;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid;
  width: fit-content;
}
.verdict-dot { width: 7px; height: 7px; border-radius: 50%; }

.score-domain {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: var(--bg);
  border: var(--border);
  border-radius: 0;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  transition: width .7s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
}

/* ─── DETAILS CARD ────────────────────────────── */
.details-card { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; }

.criteria-list { display: flex; flex-direction: column; gap: 8px; }

.criterion {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid;
}
.criterion.ok   { background: rgba(0,200,81,.1);  border-color: #00C851; color: #00C851; }
.criterion.fail { background: rgba(136,136,136,.1); border-color: var(--muted); color: var(--muted); }

.analysis-block { margin-top: 4px; }
.analysis-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.analysis-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.65;
}

/* ─── ERROR ───────────────────────────────────── */
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
  animation: slideIn .3s ease;
}

/* ─── TRANSITIONS ─────────────────────────────── */
.result-fade-enter-active { transition: all .35s ease; }
.result-fade-enter-from   { opacity: 0; transform: translateY(18px); }

@keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.spin { animation: spin 1s linear infinite; }
</style>
