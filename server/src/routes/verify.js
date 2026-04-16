const { Router } = require('express')
const { handleChat, handleURLVerify, handleHistory } = require('../controllers/VerifyController')
const https = require('https')

const router = Router()

router.post('/chat',    handleChat)
router.post('/url',     handleURLVerify)
router.get('/history',  handleHistory)

// ─── Diagnostic : vérifie la connectivité HF ─────────────────────────────────
router.get('/ping', (_req, res) => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GROQ_API_KEY absent des variables d\'environnement' })
  }

  const payload = JSON.stringify({
    model   : 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: 'Reply with one word: pong' }],
    max_tokens: 5,
    stream  : false,
  })

  const options = {
    hostname: 'api.groq.com',
    path    : '/openai/v1/chat/completions',
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      Authorization   : `Bearer ${apiKey}`,
    },
  }

  const req2 = https.request(options, (r) => {
    let d = ''
    r.on('data', c => { d += c })
    r.on('end', () => {
      res.json({
        ok          : r.statusCode === 200,
        http_status : r.statusCode,
        groq_response: d.substring(0, 500),
        key_prefix  : apiKey.substring(0, 10) + '...',
        endpoint    : 'api.groq.com/openai/v1/chat/completions',
      })
    })
  })
  req2.on('error', (e) => res.status(500).json({ ok: false, error: e.message }))
  req2.setTimeout(15000, () => { req2.destroy(); res.status(500).json({ ok: false, error: 'timeout 15s' }) })
  req2.write(payload)
  req2.end()
})

module.exports = router
