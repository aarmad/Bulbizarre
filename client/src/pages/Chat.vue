<template>
  <div class="chat-container">
    <h1>Fact-Checking Chatbot</h1>
    <div class="messages">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role]"
      >
        <strong>{{ msg.role === 'user' ? 'Vous: ' : 'Vérificateur: ' }}</strong>
        {{ msg.content }}
      </div>
      <div v-if="loading">Recherche de sources...</div>
    </div>
    <div class="input-area">
      <input
        v-model="input"
        type="text"
        placeholder="Posez votre question pour vérification..."
        :disabled="loading"
        @keyup.enter="handleSend"
      />
      <button :disabled="loading" @click="handleSend">Vérifier</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { verifyApi } from '../services/api'

const messages = ref([])
const input = ref('')
const loading = ref(false)

const handleSend = async () => {
  if (!input.value.trim() || loading.value) return

  messages.value.push({ role: 'user', content: input.value })
  const query = input.value
  input.value = ''
  loading.value = true

  try {
    const userId = localStorage.getItem('userId') || undefined
    const response = await verifyApi.chat(query, userId)
    messages.value.push({ role: 'bot', content: response.data.result })
  } catch (error) {
    console.error(error)
    messages.value.push({ role: 'error', content: 'Erreur lors de la vérification.' })
  } finally {
    loading.value = false
  }
}
</script>
