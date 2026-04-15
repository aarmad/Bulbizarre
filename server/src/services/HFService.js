const { HfInference } = require('@huggingface/inference');
const dotenv = require('dotenv');

dotenv.config();

const hf = new HfInference(process.env.HF_TOKEN);

const checkInformation = async (query) => {
    try {
        const response = await hf.chatCompletion({
            model: "HuggingFaceH4/zephyr-7b-beta",
            messages: [
                { role: "system", content: "Tu es un expert en vérification de faits (Fact-checking). Ta mission est de vérifier la véracité des informations fournies par l'utilisateur en citant des sources si possible." },
                { role: "user", content: query }
            ],
            max_tokens: 500,
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('HuggingFace Error:', error);
        throw new Error('Failed to fetch from Hugging Face');
    }
};

const scoreArticleCredibility = async (url) => {
    return {
        score: Math.floor(Math.random() * 40) + 60,
        verdict: "Analyse en cours (Skeleton)"
    };
};

module.exports = { checkInformation, scoreArticleCredibility };
