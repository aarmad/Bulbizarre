const { Router } = require('express');
const { handleChat, handleURLVerify } = require('../controllers/VerifyController');

const router = Router();

router.post('/chat', handleChat);
router.post('/url', handleURLVerify);

module.exports = router;
