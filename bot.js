const { Client, GatewayIntentBits } = require('discord.js');
const { Configuration, OpenAIApi } = require("openai");
const faqs = require("./faqs.json");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

async function getEmbedding(text) {
  const response = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

client.once('ready', () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userQuestion = message.content;
  const userEmbedding = await getEmbedding(userQuestion);

  const faqEmbeddings = await Promise.all(
    faqs.map(async (faq) => {
      const embedding = await getEmbedding(faq.question);
      return { ...faq, embedding };
    })
  );

  const bestMatch = faqEmbeddings
    .map(faq => ({
      question: faq.question,
      answer: faq.answer,
      score: cosineSimilarity(userEmbedding, faq.embedding)
    }))
    .sort((a, b) => b.score - a.score)[0];

  const gptResponse = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [
      { role: "system", content: "Anda pembantu FAQ sistem tempahan bilik. Jawapan mestilah dalam Bahasa Malaysia dan berdasarkan FAQ berikut." },
      { role: "assistant", content: `Soalan FAQ: ${bestMatch.question}\nJawapan FAQ: ${bestMatch.answer}` },
      { role: "user", content: userQuestion }
    ],
  });

  const reply = gptResponse.data.choices[0].message.content;
  message.reply(reply);
});

client.login(process.env.DISCORD_TOKEN);