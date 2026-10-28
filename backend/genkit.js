import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY não configurada — a correção via IA vai falhar até você definir essa variável no .env.");
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
  model: googleAI.model(process.env.GEMINI_MODEL || "gemini-2.5-flash"),
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

async function generateComRetry(promptConfig, tentativas = 2) {
  for (let i = 0; i <= tentativas; i++) {
    try {
      return await ai.generate(promptConfig);
    } catch (error) {
      const isUltimaTentativa = i === tentativas;
      const isSobrecarga = error.status === "UNAVAILABLE" || error.code === 503;

      if (!isSobrecarga || isUltimaTentativa) throw error;

      console.warn(`Modelo indisponível (tentativa ${i + 1}/${tentativas + 1}), tentando novamente...`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * (i + 1)));
    }
  }
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
    const { output } = await generateComRetry({
      system: "Siga rigorosamente o formato JSON e os critérios da matriz ENEM.",
      prompt: promptFor(tema, texto),
      output: { schema: CorrecaoSchema },
      config: { temperature: 0.2 },
    });

    if (!output) throw new Error("A IA não retornou uma correção válida.");
    return output;
  }
);

/* ------------------------------------------------------------------ */
/* Plano de aulas: análise geral + análise e plano por competência     */
/* ------------------------------------------------------------------ */

export const PlanoSchema = z.object({
  analiseGeral: z.string(),
  competencias: z
    .array(
      z.object({
        n: z.number().int().min(1).max(5),
        nome: z.string(),
        nota: z.number(),
        analise: z.string(),
        comoMelhorar: z.array(z.string()).min(2).max(5),
        exercicio: z.string(),
      })
    )
    .length(5),
});

export const planoAulasFlow = ai.defineFlow(
  {
    name: "planoAulas",
    inputSchema: z.object({
      tema: z.string(),
      texto: z.string(),
      correcao: CorrecaoSchema,
    }),
    outputSchema: PlanoSchema,
  },
  async ({ tema, texto, correcao }) => {
    const prompt = `Você é um professor de redação do ENEM. Com base na redação e na correção abaixo, monte um plano de estudo.

1) "analiseGeral": um parágrafo (4 a 6 frases) com visão geral da redação: estrutura, argumentação, pontos fortes e principal ponto a evoluir.
2) "competencias": EXATAMENTE 5 itens (C1 a C5). Em cada um: "analise" (o que aconteceu naquela competência, citando trechos curtos do texto como evidência), "comoMelhorar" (2 a 5 ações práticas e específicas para ESTE texto) e "exercicio" (uma atividade curta para treinar).
Mantenha "nota" igual à da correção. Não invente dados externos. Retorne SOMENTE JSON válido.

Tema: ${tema || "não informado"}
Notas da correção: ${JSON.stringify(correcao.competencias.map((c) => ({ n: c.n, nota: c.nota, comentario: c.comentario })))}

REDAÇÃO:
${texto}`;

    const { output } = await generateComRetry({
      system: "Você é um professor de redação ENEM, pedagógico e específico. Siga rigorosamente o formato JSON.",
      prompt,
      output: { schema: PlanoSchema },
      config: { temperature: 0.3 },
    });

    if (!output) throw new Error("A IA não retornou um plano válido.");
    return output;
  }
);

/* ------------------------------------------------------------------ */
/* Textos de apoio (3 a 4, cada um com título, no estilo da prova)     */
/* ------------------------------------------------------------------ */

const TIPOS_APOIO = ["noticia", "grafico", "literario", "legislacao", "dados"];

export const ApoioSchema = z.object({
  tema: z.string(),
  textos: z
    .array(
      z.object({
        titulo: z.string(),
        tipo: z.enum(TIPOS_APOIO),
        fonte: z.string(),
        conteudo: z.string(),
      })
    )
    .min(3)
    .max(4),
});

export const textosApoioFlow = ai.defineFlow(
  {
    name: "textosApoio",
    inputSchema: z.object({ tema: z.string() }),
    outputSchema: ApoioSchema,
  },
  async ({ tema }) => {
    const prompt = `Crie a coletânea de textos motivadores de uma proposta de redação do ENEM sobre o tema: "${tema}".

Regras obrigatórias:
- Gere de 3 a 4 textos de apoio, cada um com "titulo" próprio.
- Os textos NÃO são redações nem dissertações sobre o tema. Eles servem para ajudar o estudante a COMPREENDER o tema: use formatos variados, como notícia, descrição de gráfico/infográfico com dados (descreva os dados em texto ou tabela simples), trecho de texto literário/poético, trecho de legislação ou documento oficial, dados de pesquisa.
- Varie o "tipo" entre os textos (${TIPOS_APOIO.join(", ")}).
- Cada "conteudo" deve ter de 60 a 140 palavras.
- Em "fonte", deixe claro que o texto foi gerado por IA para treino (ex.: "Texto gerado por IA, inspirado em reportagens sobre o tema"). NÃO atribua o texto a veículos, autores, órgãos ou obras reais como se fossem citações verdadeiras. Se citar números, avise no próprio texto que são ilustrativos.
- Não tome partido político e não dê a solução do problema.
Retorne SOMENTE JSON válido, com "tema" igual ao tema recebido.`;

    const { output } = await generateComRetry({
      system: "Você elabora propostas de redação no padrão ENEM, com textos motivadores claros e variados.",
      prompt,
      output: { schema: ApoioSchema },
      config: { temperature: 0.7 },
    });

    if (!output) throw new Error("A IA não retornou os textos de apoio.");
    return output;
  }
);

/* ------------------------------------------------------------------ */
/* Sugestão automática de temas                                        */
/* ------------------------------------------------------------------ */

export const TemasSchema = z.object({
  temas: z.array(z.object({ tema: z.string(), eixo: z.string() })).min(3).max(6),
});

export const sugerirTemasFlow = ai.defineFlow(
  {
    name: "sugerirTemas",
    inputSchema: z.object({ eixo: z.string(), evitar: z.array(z.string()) }),
    outputSchema: TemasSchema,
  },
  async ({ eixo, evitar }) => {
    const prompt = `Sugira 4 temas de redação no formato do ENEM (ex.: "Desafios para ... no Brasil"), como frase temática que exija proposta de intervenção.
Eixo desejado: ${eixo || "variado (social, educação, saúde, meio ambiente, tecnologia, cultura)"}.
Não repita estes temas: ${evitar.length ? evitar.join(" | ") : "nenhum"}.
Em "eixo", informe a área do tema. Retorne SOMENTE JSON válido.`;

    const { output } = await generateComRetry({
      system: "Você elabora temas de redação no padrão ENEM.",
      prompt,
      output: { schema: TemasSchema },
      config: { temperature: 0.9 },
    });

    if (!output) throw new Error("A IA não retornou temas.");
    return output;
  }
);
