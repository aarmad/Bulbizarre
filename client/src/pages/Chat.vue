<template>
  <div class="chat-page">
    <!-- Header -->
    <div class="chat-header card">
      <div class="chat-header-left">
        <div class="chat-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div>
          <p class="chat-label">Intelligence artificielle</p>
          <h1 class="chat-title">Fact-Checking Chatbot</h1>
        </div>
      </div>
      <div class="status-chip" :class="loading ? 'active' : 'idle'">
        <span class="status-dot"></span>
        {{ loading ? 'Analyse en cours...' : 'Prêt' }}
      </div>
    </div>

    <!-- Messages -->
    <div class="messages-container" ref="messagesEl">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <p class="empty-title">Aucun message</p>
        <p class="empty-sub">Posez une question pour lancer la vérification des faits.</p>
      </div>

      <!-- Message list -->
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message-wrapper', msg.role]"
      >
        <div :class="['message-bubble', msg.role]">
          <div class="message-role">
            {{ msg.role === 'user' ? 'Vous' : msg.role === 'bot' ? 'Vérificateur' : 'Erreur' }}
          </div>
          <p class="message-content">{{ msg.content }}</p>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="loading" class="message-wrapper bot">
        <div class="message-bubble bot loading-bubble">
          <div class="message-role">Vérificateur</div>
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="input-area card">
      <input
        v-model="input"
        type="text"
        placeholder="Posez votre question pour vérification..."
        :disabled="loading"
        @keyup.enter="handleSend"
        class="chat-input"
      />
      <button
        class="btn-primary send-btn"
        :disabled="loading || !input.trim()"
        @click="handleSend"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Vérifier
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { verifyApi } from '../services/api'

const messages = ref([])
const input = ref('')
const loading = ref(false)
const messagesEl = ref(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

const handleSend = async () => {
  if (!input.value.trim() || loading.value) return

  messages.value.push({ role: 'user', content: input.value })
  const query = input.value
  input.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const userId = localStorage.getItem('userId') || undefined
    const response = await verifyApi.chat(query, userId)
    messages.value.push({ role: 'bot', content: response.data.result })
  } catch (error) {
    console.error(error)
    messages.value.push({ role: 'error', content: 'Erreur lors de la vérification.' })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 860px;
  margin: 0 auto;
  height: calc(100vh - 180px);
}

/* ─── HEADER ──────────────────────────────────── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.chat-icon {
  width: 44px;
  height: 44px;
  background: var(--text);
  color: var(--bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 2px;
}

.chat-title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 40px;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid;
}

.status-chip.idle {
  background: rgba(136, 136, 136, 0.15);
  border-color: var(--muted);
  color: var(--muted);
}

.status-chip.active {
  background: rgba(255, 187, 51, 0.15);
  border-color: #ffbb33;
  color: #ffbb33;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-chip.active .status-dot {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ─── MESSAGES ────────────────────────────────── */
.messages-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

/* ─── EMPTY STATE ─────────────────────────────── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  margin-bottom: 8px;
}

.empty-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.empty-sub {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  max-width: 280px;
}

/* ─── MESSAGE BUBBLES ─────────────────────────── */
.message-wrapper {
  display: flex;
  animation: fadeIn 0.25s ease;
}

.message-wrapper.user {
  justify-content: flex-end;
}

.message-wrapper.bot,
.message-wrapper.error {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 72%;
  padding: 14px 18px;
  border-radius: var(--radius);
  border: var(--border);
  box-shadow: var(--shadow);
}

.message-bubble.user {
  background: var(--text);
  color: var(--bg);
  border-radius: var(--radius) var(--radius) 4px var(--radius);
}

.message-bubble.bot {
  background: var(--card);
  color: var(--text);
  border-radius: var(--radius) var(--radius) var(--radius) 4px;
}

.message-bubble.error {
  background: rgba(255, 68, 68, 0.08);
  border-color: #ff4444;
  color: #ff4444;
  border-radius: var(--radius) var(--radius) var(--radius) 4px;
}

.message-role {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 6px;
  opacity: 0.6;
}

.message-content {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}

/* ─── LOADING DOTS ────────────────────────────── */
.loading-bubble {
  min-width: 80px;
}

.loading-dots {
  display: flex;
  gap: 6px;
  padding: 4px 0;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  animation: bounce 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.15s; }
.loading-dots span:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

/* ─── INPUT AREA ──────────────────────────────── */
.input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  flex-shrink: 0;
  align-items: center;
}

.chat-input {
  flex: 1;
  border: none;
  border-bottom: 2px solid var(--accent);
  padding: 10px 0;
  font-size: 15px;
  font-weight: 600;
  background: transparent;
  color: var(--text);
  outline: none;
  font-family: inherit;
  transition: var(--transition);
}

.chat-input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.chat-input:disabled {
  opacity: 0.5;
}

.send-btn {
  flex-shrink: 0;
  padding: 12px 20px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
