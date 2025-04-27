import express from 'express';
import { Configuration, OpenAIApi } from 'openai';

const aiRouter = express.Router();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

aiRouter.post('/ask', async (req, res) => {
  const { question } = req.body;

  const systemPrompt = `You are a friendly, professional pediatric assistant in a health tracking app. Help parents understand their baby's vaccinations and health. Keep answers short, supportive, and medically cautious. Always recommend seeing a doctor when appropriate.`;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    });

    const answer = response.data.choices[0].message.content;
    res.json({ answer });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI assistant failed to respond' });
  }
});

export default aiRouter;