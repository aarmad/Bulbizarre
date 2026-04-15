<template>
  <div id="app">
    <nav>
      <ul>
        <li><router-link to="/">Chatbot</router-link></li>
        <li><router-link to="/verify">Vérifier un Article</router-link></li>
        <li><router-link to="/login">Connexion</router-link></li>
      </ul>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>
