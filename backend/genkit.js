import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY não configurada — a correção via IA vai falhar até você definir essa variável no .env.");
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
  model: googleAI.model(process.env.GEMINI_MODEL || "gemini-3.6-flash"),
});

const NOTAS_VALIDAS = [0, 40, 80, 120, 160, 200];

export const CorrecaoSchema = z.object({
  notaTotal: z.number().int(),
  competencias: z
    .array(
      z.object({
        n: z.number().int().min(1).max(5),
        nome: z.string(),
        nota: z.number().refine((v) => NOTAS_VALIDAS.includes(v), {
          message: "Nota deve ser 0, 40, 80, 120, 160 ou 200.",
        }),
        comentario: z.string(),
      })
    )
    .length(5),
  positivos: z.array(z.string()),
  melhorar: z.array(z.string()),
  geral: z.string(),
});

function promptFor(tema, texto) {
  return `Você é um corretor especializado no modelo ENEM brasileiro. Avalie as cinco competências oficiais. Use somente notas 0, 40, 80, 120, 160 ou 200 em cada competência. Justifique com evidências do texto, seja pedagógico e não invente dados externos. Retorne SOMENTE JSON válido.

Tema: ${tema || "não informado"}

REDAÇÃO:
${texto}`;
}

export const corrigirRedacaoFlow = ai.defineFlow(
  {
    name: "corrigirRedacao",
    inputSchema: z.object({
      tema: z.string(),
      texto: z.string(),
    }),
    outputSchema: CorrecaoSchema,
  },
  async ({ tema, texto }) => {
    const { output } = await ai.generate({
      system: "Siga rigorosamente o formato JSON e os critérios da matriz ENEM.",
      prompt: promptFor(tema, texto),
      output: { schema: CorrecaoSchema },
      config: { temperature: 0.2 },
    });

    if (!output) throw new Error("A IA não retornou uma correção válida.");
    return output;
  }
);