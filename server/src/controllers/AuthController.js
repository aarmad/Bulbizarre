const User = require('../models/User')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'

const register = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' })
  }

  try {
    // Vérifier si l'email est déjà utilisé avant de hasher
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({ email: email.toLowerCase(), password: hashedPassword })
    await user.save()

    res.status(201).json({ message: 'Compte créé avec succès !' })
  } catch (error) {
    console.error('[Auth] Erreur register:', error)
    // Doublon MongoDB (race condition)
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' })
    }
    res.status(500).json({ error: error.message || 'Erreur lors de la création du compte.' })
  }
}

const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' })
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, userId: user._id })
  } catch (error) {
    console.error('[Auth] Erreur login:', error)
    res.status(500).json({ error: error.message || 'Erreur lors de la connexion.' })
  }
}

module.exports = { register, login }
