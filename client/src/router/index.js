import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../pages/Chat.vue'
import VerifyURL from '../pages/VerifyURL.vue'
import Auth from '../pages/Auth.vue'

const routes = [
  { path: '/', name: 'Chat', component: Chat },
  { path: '/verify', name: 'VerifyURL', component: VerifyURL },
  { path: '/login', name: 'Login', component: Auth, props: { mode: 'login' } },
  { path: '/register', name: 'Register', component: Auth, props: { mode: 'register' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
