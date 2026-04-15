/**
 * Vercel Serverless Entry Point
 * Handles all /api/* requests and routes them through Express.
 * MongoDB connection is cached between invocations.
 */
const dotenv = require('dotenv')
dotenv.config()

const mongoose = require('mongoose')

// ─── Cached MongoDB connection ────────────────────────────────────────────────
let cachedConn = null

async function connectDB() {
  if (cachedConn && mongoose.connection.readyState === 1) return cachedConn
  cachedConn = await mongoose.connect(process.env.MONGODB_URI)
  return cachedConn
}

// ─── Express app (no listen) ──────────────────────────────────────────────────
const app = require('../server/src/app')

// ─── Serverless handler ───────────────────────────────────────────────────────
module.exports = async (req, res) => {
  await connectDB()
  return app(req, res)
}
