const { Router } = require('express')
const authMiddleware = require('../middleware/authMiddleware')
const { getMyStats, getDashboardStats } = require('../controllers/StatsController')

const router = Router()

router.get('/my-stats', authMiddleware, getMyStats)
router.get('/dashboard', getDashboardStats)

module.exports = router
