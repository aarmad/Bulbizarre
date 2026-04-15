<template>
  <div class="auth-container">
    <h1>{{ mode === 'login' ? 'Connexion' : 'Inscription' }}</h1>
    <p v-if="message" class="auth-message">{{ message }}</p>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Email</label>
        <input v-model="email" type="email" required />
      </div>
      <div class="form-group">
        <label>Mot de passe</label>
        <input v-model="password" type="password" required />
      </div>
      <button type="submit">
        {{ mode === 'login' ? 'Se connecter' : "S'inscrire" }}
      </button>
    </form>
    <p class="auth-switch">
      <span v-if="mode === 'login'" @click="router.push('/register')">
        Pas de compte ? S'inscrire
      </span>
      <span v-else @click="router.push('/login')">
        Déjà un compte ? Se connecter
      </span>
    </p>
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

const handleSubmit = async () => {
  try {
    if (props.mode === 'register') {
      await authApi.register({ email: email.value, password: password.value })
      message.value = 'Inscription réussie ! Vous pouvez vous connecter.'
    } else {
      const response = await authApi.login({ email: email.value, password: password.value })
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('userId', response.data.userId)
      router.push('/')
    }
  } catch (error) {
    console.error(error)
    message.value = 'Erreur: Vérifiez vos identifiants.'
  }
}
</script>
