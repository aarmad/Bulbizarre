const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connexion à MongoDB Atlas réussie !");
  } catch (err) {
    console.error("❌ Erreur de connexion :", err.message);
    process.exit(1);
  }
};