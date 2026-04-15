<template>
  <div class="verify-container">
    <h1>Vérification d'Article</h1>
    <p>Entrez l'URL d'un article pour vérifier sa fiabilité.</p>
    <div class="input-area">
      <input
        v-model="url"
        type="text"
        placeholder="https://..."
        :disabled="loading"
        @keyup.enter="handleVerify"
      />
      <button :disabled="loading" @click="handleVerify">
        {{ loading ? 'Analyse...' : 'Analyser' }}
      </button>
    </div>
    <div v-if="result" class="result-area">
      <h2>Score de fiabilité : {{ result.score }}%</h2>
      <p>Verdict : {{ result.verdict }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { verifyApi } from '../services/api'

const url = ref('')
const result = ref(null)
const loading = ref(false)

const handleVerify = async () => {
  if (!url.value.trim() || loading.value) return
  loading.value = true

  try {
    const userId = localStorage.getItem('userId') || undefined
    const response = await verifyApi.url(url.value, userId)
    result.value = response.data
  } catch (error) {
    console.error(error)
    alert("Erreur lors de l'analyse du lien.")
  } finally {
    loading.value = false
  }
}
</script>
