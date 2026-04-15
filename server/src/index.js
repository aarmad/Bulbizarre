const dotenv = require('dotenv');
dotenv.config(); // ← doit être avant tout autre require qui lit process.env

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const verifyRoutes = require('./routes/verify');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Fake News Verification API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bulbizarre';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
