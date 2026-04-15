const { Router } = require('express')
const { handleChat, handleURLVerify, handleHistory } = require('../controllers/VerifyController')
const https = require('https')

const router = Router()

router.post('/chat',    handleChat)
router.post('/url',     handleURLVerify)
router.get('/history',  handleHistory)

// ─── Diagnostic : vérifie la connectivité HF ─────────────────────────────────
router.get('/ping', (_req, res) => {
  const token = process.env.HF_TOKEN
  if (!token) {
    return res.status(500).json({ ok: false, error: 'HF_TOKEN absent des variables d\'environnement' })
  }

  // Nouveau router HF (depuis mi-2024)
  const payload = JSON.stringify({
    model   : 'mistralai/Mistral-7B-Instruct-v0.3',
    messages: [{ role: 'user', content: 'Reply with one word: pong' }],
    max_tokens: 10,
    stream  : false,
  })

  const options = {
    hostname: 'router.huggingface.co',
    path    : '/hf-inference/v1/chat/completions',
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      Authorization   : `Bearer ${token}`,
    },
  }

  const req2 = https.request(options, (r) => {
    let d = ''
    r.on('data', c => { d += c })
    r.on('end', () => {
      res.json({
        ok          : r.statusCode === 200,
        http_status : r.statusCode,
        hf_response : d.substring(0, 500),
        token_prefix: token.substring(0, 10) + '...',
        endpoint    : 'router.huggingface.co/hf-inference/v1/chat/completions',
      })
    })
  })
  req2.on('error', (e) => res.status(500).json({ ok: false, error: e.message }))
  req2.setTimeout(20000, () => { req2.destroy(); res.status(500).json({ ok: false, error: 'timeout 20s' }) })
  req2.write(payload)
  req2.end()
})

module.exports = router
