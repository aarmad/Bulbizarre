<template>
  <div class="chat-page">
    <!-- Sidebar historique -->
    <aside class="history-sidebar card" v-if="userId">
      <div class="history-header">
        <span class="section-label">Historique</span>
        <button class="btn-icon" @click="loadHistory" title="Actualiser">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      <div class="history-list" v-if="history.length > 0">
        <button
          v-for="item in history"
          :key="item._id"
          class="history-item"
          @click="loadHistoryItem(item)"
        >
          <div class="history-item-type" :class="item.type">
            <svg v-if="item.type === 'chat'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div class="history-item-text">
            <p class="history-query">{{ item.content.query || item.content.url }}</p>
            <p class="history-date">{{ formatDate(item.timestamp) }}</p>
          </div>
        </button>
      </div>

      <p class="history-empty" v-else>
        Aucun historique pour l'instant.
      </p>
    </aside>

    <!-- Zone principale -->
    <div class="chat-main">
      <!-- Header -->
      <div class="chat-header card">
        <div class="chat-header-left">
          <div class="chat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <p class="chat-label">Intelligence artificielle · Mistral 7B</p>
            <h1 class="chat-title">Fact-Checking Chatbot</h1>
          </div>
        </div>
        <div class="status-chip" :class="loading ? 'active' : 'idle'">
          <span class="status-dot"></span>
          {{ loading ? 'Recherche en cours...' : 'Prêt' }}
        </div>
      </div>

      <!-- Messages -->
      <div class="messages-container" ref="messagesEl">
        <!-- État vide -->
        <div v-if="messages.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <p class="empty-title">Posez une question</p>
          <p class="empty-sub">Le chatbot recherche des sources sur internet et analyse la véracité de vos affirmations.</p>
          <div class="suggestions">
            <button
              v-for="s in suggestions"
              :key="s"
              class="suggestion-pill"
              @click="input = s"
            >{{ s }}</button>
          </div>
        </div>

        <!-- Messages -->
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['message-wrapper', msg.role]"
        >
          <div :class="['message-bubble', msg.role]">
            <div class="message-role-row">
              <span class="message-role">
                {{ msg.role === 'user' ? 'Vous' : msg.role === 'bot' ? 'Vérificateur' : 'Erreur' }}
              </span>
              <span class="message-time">{{ formatTime(msg.time) }}</span>
            </div>

            <p class="message-content" v-html="formatContent(msg.content)"></p>

            <!-- Sources -->
            <div v-if="msg.sources && msg.sources.length > 0" class="sources-block">
              <p class="sources-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Sources
              </p>
              <a
                v-for="(source, i) in msg.sources"
                :key="i"
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link"
              >
                <span class="source-num">[{{ i + 1 }}]</span>
                {{ source.title }}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Loading dots -->
        <div v-if="loading" class="message-wrapper bot">
          <div class="message-bubble bot loading-bubble">
            <div class="message-role">Vérificateur</div>
            <p class="loading-text">Recherche sur internet...</p>
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="input-area card">
        <input
          v-model="input"
          type="text"
          placeholder="Ex: La Terre est plate ? · Macron a démissionné ?"
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
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { verifyApi } from '../services/api'

const messages  = ref([])
const input     = ref('')
const loading   = ref(false)
const history   = ref([])
const messagesEl = ref(null)

const userId = localStorage.getItem('userId') || null

const suggestions = [
  'La Terre est plate ?',
  'Les vaccins causent l\'autisme ?',
  'Le réchauffement climatique est un complot ?',
  'Einstein a-t-il raté ses examens ?',
]

function formatTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/** Surligne les verdicts avec des couleurs */
function formatContent(text) {
  if (!text) return ''
  return text
    .replace(/✅\s*VRAI/g, '<span class="verdict-true">✅ VRAI</span>')
    .replace(/❌\s*FAUX/g, '<span class="verdict-false">❌ FAUX</span>')
    .replace(/⚠️\s*INCERTAIN/g, '<span class="verdict-uncertain">⚠️ INCERTAIN</span>')
    .replace(/\n/g, '<br/>')
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

const loadHistory = async () => {
  if (!userId) return
  try {
    const res = await verifyApi.history(userId)
    history.value = res.data.filter((h) => h.type === 'chat')
  } catch (_) {}
}

const loadHistoryItem = (item) => {
  messages.value = [
    { role: 'user',  content: item.content.query,    time: item.timestamp },
    { role: 'bot',   content: item.content.response, sources: item.content.sources || [], time: item.timestamp },
  ]
  scrollToBottom()
}

const handleSend = async () => {
  if (!input.value.trim() || loading.value) return

  const query = input.value.trim()
  input.value = ''

  messages.value.push({ role: 'user', content: query, time: new Date() })
  loading.value = true
  await scrollToBottom()

  try {
    const res = await verifyApi.chat(query, userId)
    messages.value.push({
      role: 'bot',
      content: res.data.result,
      sources: res.data.sources || [],
      time: new Date(),
    })
    await loadHistory()
  } catch (error) {
    console.error(error)
    messages.value.push({
      role: 'error',
      content: 'Erreur lors de la vérification. Vérifiez que le serveur est démarré.',
      time: new Date(),
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.chat-page {
  display: flex;
  gap: 20px;
  height: calc(100vh - 160px);
}

/* ─── SIDEBAR HISTORIQUE ─────────────────────── */
.history-sidebar {
  width: 260px;
  flex-shrink: 0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
}
.btn-icon:hover { transform: rotate(180deg); }

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: var(--transition);
  width: 100%;
  font-family: inherit;
}

.history-item:hover {
  border-color: var(--text);
  background: var(--bg);
  transform: translateX(4px);
}

.history-item-type {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.history-item-type.chat {
  background: rgba(114, 137, 218, 0.2);
  color: #7289da;
}

.history-item-type.url_verify {
  background: rgba(255, 187, 51, 0.2);
  color: #ffbb33;
}

.history-item-text {
  flex: 1;
  min-width: 0;
}

.history-query {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.history-date {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-empty {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-align: center;
  padding: 20px 0;
}

/* ─── ZONE PRINCIPALE ────────────────────────── */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* ─── HEADER ──────────────────────────────────── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.chat-icon {
  width: 42px;
  height: 42px;
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
  letter-spacing: 1px;
  color: var(--muted);
  margin-bottom: 2px;
}

.chat-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 40px;
  font-size: 11px;
  font-weight: 700;
  border: 2px solid;
}
.status-chip.idle   { background: rgba(136,136,136,.12); border-color: var(--muted); color: var(--muted); }
.status-chip.active { background: rgba(255,187,51,.12); border-color: #ffbb33; color: #ffbb33; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.status-chip.active .status-dot { animation: pulse 1s ease-in-out infinite; }

@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

/* ─── MESSAGES ────────────────────────────────── */
.messages-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
}

/* ─── ÉTAT VIDE ───────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  flex: 1;
  padding: 40px 20px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  margin-bottom: 4px;
}

.empty-title { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
.empty-sub   { font-size: 13px; font-weight: 600; color: var(--muted); max-width: 320px; }

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
  max-width: 500px;
}

.suggestion-pill {
  padding: 8px 14px;
  border: var(--border);
  border-radius: 40px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: var(--transition);
}
.suggestion-pill:hover {
  background: var(--text);
  color: var(--bg);
  transform: scale(0.97);
}

/* ─── BULLES ──────────────────────────────────── */
.message-wrapper { display: flex; animation: fadeIn .25s ease; }
.message-wrapper.user  { justify-content: flex-end; }
.message-wrapper.bot, .message-wrapper.error { justify-content: flex-start; }

.message-bubble {
  max-width: 76%;
  padding: 14px 18px;
  border-radius: var(--radius);
  border: var(--border);
  box-shadow: var(--shadow);
}

.message-bubble.user  {
  background: var(--text);
  color: var(--bg);
  border-radius: var(--radius) var(--radius) 4px var(--radius);
}
.message-bubble.bot   {
  background: var(--card);
  border-radius: var(--radius) var(--radius) var(--radius) 4px;
}
.message-bubble.error {
  background: rgba(255,68,68,.07);
  border-color: #ff4444;
  color: #ff4444;
  border-radius: var(--radius) var(--radius) var(--radius) 4px;
}

.message-role-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.message-role {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  opacity: 0.6;
}
.message-time {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.4;
}

.message-content {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.65;
}

/* verdicts colorés */
:deep(.verdict-true)     { color: #00C851; font-weight: 800; }
:deep(.verdict-false)    { color: #ff4444; font-weight: 800; }
:deep(.verdict-uncertain){ color: #ffbb33; font-weight: 800; }

/* ─── SOURCES ─────────────────────────────────── */
.sources-block {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 2px solid var(--border-color, #eee);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sources-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.source-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: var(--transition);
  line-height: 1.3;
}
.source-link:hover {
  border-color: var(--text);
  background: var(--bg);
  transform: translateX(4px);
}
.source-num {
  font-size: 10px;
  font-weight: 800;
  color: var(--muted);
  flex-shrink: 0;
}

/* ─── LOADING ─────────────────────────────────── */
.loading-bubble { min-width: 160px; }
.loading-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
}
.loading-dots { display: flex; gap: 6px; }
.loading-dots span {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--muted);
  animation: bounce 1.2s ease-in-out infinite;
}
.loading-dots span:nth-child(2) { animation-delay: .15s; }
.loading-dots span:nth-child(3) { animation-delay: .3s; }

@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }

/* ─── INPUT ───────────────────────────────────── */
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
  font-size: 14px;
  font-weight: 600;
  background: transparent;
  color: var(--text);
  outline: none;
  font-family: inherit;
}
.chat-input::placeholder { color: var(--muted); font-weight: 400; }
.chat-input:disabled     { opacity: .5; }

.send-btn { flex-shrink: 0; padding: 12px 20px; }

@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
</style>
