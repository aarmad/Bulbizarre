const { Router } = require('express')
const { handleChat, handleURLVerify, handleHistory } = require('../controllers/VerifyController')

const router = Router()

router.post('/chat', handleChat)
router.post('/url', handleURLVerify)
router.get('/history', handleHistory)

module.exports = router
