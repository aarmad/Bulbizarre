const History = require("../models/History");
const User = require("../models/User");

// GET - Dashboard stats (global)
const getDashboardStats = async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      totalVerifications: await History.countDocuments(),
      verificationsByType: await History.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),
      verificationsThisMonth: await History.countDocuments({
        timestamp: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des statistiques" });
  }
};

// GET - Mes stats personnelles
const getMyStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    // Total de vérifications
    const totalVerifications = await History.countDocuments({ userId });

    // Vérifications par type
    const byType = await History.aggregate([
      { $match: { userId: require("mongoose").Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Vérifications ce mois-ci
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const thisMonthCount = await History.countDocuments({
      userId,
      timestamp: { $gte: thisMonthStart },
    });

    // Vérifications cette semaine
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekCount = await History.countDocuments({
      userId,
      timestamp: { $gte: weekAgo },
    });

    // Vérifications aujourd'hui
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await History.countDocuments({
      userId,
      timestamp: { $gte: todayStart },
    });

    // Dernières vérifications
    const recentVerifications = await History.find({ userId })
      .sort({ timestamp: -1 })
      .limit(5);

    const stats = {
      total: totalVerifications,
      byType,
      thisMonth: thisMonthCount,
      thisWeek: thisWeekCount,
      today: todayCount,
      recentVerifications,
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching personal stats:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération de vos statistiques" });
  }
};

module.exports = {
  getDashboardStats,
  getMyStats,
};
