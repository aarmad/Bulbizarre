const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const verifyRoutes = require('./routes/verify');

dotenv.config();

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
