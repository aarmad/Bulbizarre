const { HfInference } = require("@huggingface/inference");
const dotenv = require("dotenv");

dotenv.config();

const hf = new HfInference(process.env.HF_TOKEN);

const checkInformation = async (query) => {
  try {
    const response = await hf.chatCompletion({
      model: "HuggingFaceH4/zephyr-7b-beta",
      messages: [
        {
          role: "system",
          content:
            "Il faut vérifier les informations suivantes et répondre de manière concise et claire. Si l'information est fausse, indiquez clairement que c'est le cas. Si elle est vraie, confirmez-le. Si vous n'êtes pas sûr, dites que c'est indéterminé.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("HuggingFace Error:", error);
    throw new Error("Failed to fetch from Hugging Face");
  }
};

const verifyHeadline = async (headline) => {
  try {
    // Améliorer le prompt pour vérifier spécifiquement un titre
    const systemPrompt = `Tu es un expert en détection de fausses nouvelles. 
Analyse le titre donné et :
1. Donne un verdict : VRAI, FAUX ou INDÉTERMINÉ
2. Explique brièvement pourquoi
3. Donne un score de fiabilité (0-100)
Réponds au format JSON: {"verdict": "VRAI|FAUX|INDÉTERMINÉ", "score": 0-100, "explanation": "description"}`;

    const response = await hf.chatCompletion({
      model: "HuggingFaceH4/zephyr-7b-beta",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Vérifiez ce titre : "${headline}"` },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;

    // Essayer de parser la réponse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback : vérification basique du contenu
    const isFake =
      content.toLowerCase().includes("faux") ||
      content.toLowerCase().includes("fake") ||
      content.toLowerCase().includes("pas vrai");

    return {
      verdict: isFake ? "FAUX" : "VRAI",
      score: isFake ? 30 : 75,
      explanation: content,
    };
  } catch (error) {
    console.error("HuggingFace Error:", error);
    throw new Error("Failed to verify headline");
  }
};

const scoreArticleCredibility = async (url) => {
  return {
    score: Math.floor(Math.random() * 40) + 60,
    verdict: "Analyse en cours (Skeleton)",
  };
};

module.exports = { checkInformation, scoreArticleCredibility, verifyHeadline };
