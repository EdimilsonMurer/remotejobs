import { GoogleGenAI } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texto é obrigatório' });
  }

  if (geminiApiKey) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Você é um tradutor profissional especializado em vagas de emprego internacionais na área de tecnologia, inteligência artificial e trabalho remoto.
Traduza o seguinte texto de descrição de vaga fielmente para o Português do Brasil (pt-BR).
Mantenha a formatação original em tópicos, parágrafos e clareza.
Termos técnicos consagrados como "Search Quality Rater", "Ads Rater", "Guidelines", "Feedback", "RLHF", "Freelance" podem ser mantidos ou acompanhados de explicação entre parênteses.
Não adicione saudações ou comentários, retorne apenas o texto traduzido.

TEXTO ORIGINAL:
${text.slice(0, 4500)}`
      });

      const translated = response.text?.trim() || '';
      if (translated) {
        return res.status(200).json({ translatedText: translated, source: 'gemini' });
      }
    } catch (err: any) {
      console.warn('[Vercel Translate API] Erro no Gemini:', err?.message);
    }
  }

  return res.status(200).json({ translatedText: text, source: 'fallback' });
}
