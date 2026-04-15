const express = require('express')
const cors    = require('cors')

const authRoutes   = require('./routes/auth')
const verifyRoutes = require('./routes/verify')

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => res.send('Fake News Verification API is running'))

app.use('/api/auth',   authRoutes)
app.use('/api/verify', verifyRoutes)

module.exports = app
