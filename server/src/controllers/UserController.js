const User = require("../models/User");
const bcrypt = require("bcrypt");

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json(user);
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du profil" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { email, username } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Vérifier si l'email est déjà utilisé
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est déjà utilisé" });
      }
      user.email = email.toLowerCase();
    }

    if (username) {
      user.username = username;
    }

    await user.save();

    res.json({
      message: "Profil mis à jour",
      user: user.toObject(),
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Les deux mots de passe sont requis" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
          error: "Le nouveau mot de passe doit faire au moins 6 caractères",
        });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }

    // Hash le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: "Mot de passe changé avec succès" });
  } catch (error) {
    console.error("changePassword error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors du changement de mot de passe" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    if (!password) {
      return res.status(400).json({ error: "Le mot de passe est requis" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }

    // Supprimer aussi l'historique de l'utilisateur
    const History = require("../models/History");
    await History.deleteMany({ userId });

    // Supprimer l'utilisateur
    await User.findByIdAndDelete(userId);

    res.json({ message: "Compte supprimé avec succès" });
  } catch (error) {
    console.error("deleteAccount error:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du compte" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
