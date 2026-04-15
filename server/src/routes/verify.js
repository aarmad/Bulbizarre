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
  const mock  = process.env.MOCK_AI === 'true'

  if (!token) {
    return res.status(500).json({ ok: false, error: 'HF_TOKEN absent des variables d\'environnement' })
  }
  if (mock) {
    return res.json({ ok: true, mock: true, message: 'MOCK_AI=true — aucun appel réel à HuggingFace en mode dev local' })
  }

  // Endpoint text-generation (legacy, le plus fiable sur free tier)
  const payload = JSON.stringify({
    inputs    : '<s>[INST] Reply with exactly one word: pong [/INST]',
    parameters: { max_new_tokens: 10, return_full_text: false },
    options   : { wait_for_model: false },
  })

  const options = {
    hostname: 'api-inference.huggingface.co',
    path    : '/models/mistralai/Mistral-7B-Instruct-v0.3',
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
      const isHTML = d.trimStart().startsWith('<')
      res.json({
        ok          : r.statusCode === 200 && !isHTML,
        http_status : r.statusCode,
        hf_response : d.substring(0, 400),
        token_prefix: token.substring(0, 10) + '...',
        proxy_detected: isHTML,
      })
    })
  })
  req2.on('error', (e) => res.status(500).json({ ok: false, error: e.message }))
  req2.setTimeout(15000, () => { req2.destroy(); res.status(500).json({ ok: false, error: 'timeout 15s' }) })
  req2.write(payload)
  req2.end()
})

module.exports = router
