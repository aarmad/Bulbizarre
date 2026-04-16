const dotenv = require('dotenv')
dotenv.config()

const mongoose = require('mongoose')
const app      = require('./app')

const PORT        = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bulbizarre'

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err))

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
