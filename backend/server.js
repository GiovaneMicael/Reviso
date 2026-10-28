import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// O Genkit lê GEMINI_API_KEY ao ser importado; por isso ele deve entrar
// somente depois do dotenv carregar Backend/.env.
const { corrigirRedacaoFlow, planoAulasFlow, textosApoioFlow, sugerirTemasFlow } = await import("./genkit.js");

let firestore = null;
let firebaseAuth = null;
let firebaseReady = false;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");

    const adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        });

    firebaseAuth = getAuth(adminApp);
    firestore = getFirestore(adminApp);
    firebaseReady = true;
    console.log("Firebase Admin conectado.");
  } catch (error) {
    console.warn("Firebase Admin indisponível:", error.message);
  }
}

const app = express();
const port = Number(process.env.PORT || 3001);
const memoryEssays = new Map();
const memorySupport = new Map();

// Camadas de acesso: Firestore quando configurado, memória em desenvolvimento.
const userCol = (uid, name) => firestore.collection("usuarios").doc(uid).collection(name);

async function getEssay(uid, id) {
  if (firestore) {
    const doc = await userCol(uid, "redacoes").doc(String(id)).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }
  return (memoryEssays.get(uid) || []).find((e) => String(e.id) === String(id)) || null;
}

async function patchEssay(uid, id, data) {
  if (firestore) {
    await userCol(uid, "redacoes").doc(String(id)).update(data);
    return;
  }
  const list = memoryEssays.get(uid) || [];
  memoryEssays.set(uid, list.map((e) => (String(e.id) === String(id) ? { ...e, ...data } : e)));
}

const cleanTheme = (value = "") => String(value).replace(/\s+/g, " ").trim().slice(0, 200);

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: false,
}));
app.use(express.json({ limit: "150kb" }));

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) return res.status(401).json({ error: "Faça login para continuar." });
  if (!firebaseAuth) return res.status(503).json({ error: "Firebase Admin não está configurado no servidor." });

  try {
    req.user = await firebaseAuth.verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Sua sessão expirou. Entre novamente." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    firebase: firebaseReady,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  });
});

app.get("/api/essays", requireAuth, async (req, res) => {
  try {
    if (firestore) {
      const snapshot = await firestore
        .collection("usuarios")
        .doc(req.user.uid)
        .collection("redacoes")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }

    return res.json(memoryEssays.get(req.user.uid) || []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível carregar seu histórico." });
  }
});

app.post("/api/correct", requireAuth, async (req, res) => {
  const { tema = "", texto = "" } = req.body || {};
  const words = texto.trim().split(/\s+/).filter(Boolean);

  if (words.length < 30) {
    return res.status(400).json({ error: "Escreva pelo menos 30 palavras para corrigir." });
  }

  try {
    const result = await corrigirRedacaoFlow({ tema, texto });
    const essay = {
      ...result,
      tema: tema || "Sem tema",
      texto,
      favorito: false,
      createdAt: new Date().toISOString(),
    };

    if (firestore) {
      const ref = await firestore
        .collection("usuarios")
        .doc(req.user.uid)
        .collection("redacoes")
        .add({
          ...essay,
          createdAt: new Date(),
        });

      essay.id = ref.id;
    } else {
      const userEssays = memoryEssays.get(req.user.uid) || [];
      essay.id = Date.now();
      memoryEssays.set(req.user.uid, [essay, ...userEssays].slice(0, 100));
    }

    return res.json(essay);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: error.message || "Não foi possível corrigir a redação." });
  }
});


app.patch("/api/essays/:id/favorite", requireAuth, async (req, res) => {
  try {
    const essay = await getEssay(req.user.uid, req.params.id);
    if (!essay) return res.status(404).json({ error: "Redação não encontrada." });
    const favorito = Boolean(req.body?.favorito);
    await patchEssay(req.user.uid, req.params.id, { favorito });
    return res.json({ id: req.params.id, favorito });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível atualizar o favorito." });
  }
});

app.post("/api/essays/:id/plan", requireAuth, async (req, res) => {
  try {
    const essay = await getEssay(req.user.uid, req.params.id);
    if (!essay) return res.status(404).json({ error: "Redação não encontrada." });
    if (essay.plano && !req.body?.force) return res.json(essay.plano);
    if (!essay.texto) {
      return res.status(400).json({ error: "Esta redação foi salva antes do texto ser guardado. Corrija-a novamente para gerar o plano." });
    }

    const plano = await planoAulasFlow({
      tema: essay.tema || "",
      texto: essay.texto,
      correcao: {
        notaTotal: essay.notaTotal,
        competencias: essay.competencias,
        positivos: essay.positivos || [],
        melhorar: essay.melhorar || [],
        geral: essay.geral || "",
      },
    });

    await patchEssay(req.user.uid, req.params.id, { plano });
    return res.json(plano);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: error.message || "Não foi possível gerar o plano de aulas." });
  }
});

app.post("/api/themes", requireAuth, async (req, res) => {
  try {
    const eixo = cleanTheme(req.body?.eixo);
    const evitar = Array.isArray(req.body?.evitar) ? req.body.evitar.slice(0, 20).map(cleanTheme) : [];
    const result = await sugerirTemasFlow({ eixo, evitar });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: error.message || "Não foi possível sugerir temas." });
  }
});

app.get("/api/support-texts", requireAuth, async (req, res) => {
  try {
    if (firestore) {
      const snapshot = await userCol(req.user.uid, "apoios").orderBy("createdAt", "desc").limit(50).get();
      return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }
    return res.json(memorySupport.get(req.user.uid) || []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível carregar seus textos de apoio." });
  }
});

app.post("/api/support-texts", requireAuth, async (req, res) => {
  const tema = cleanTheme(req.body?.tema);
  if (tema.length < 8) return res.status(400).json({ error: "Informe um tema com pelo menos 8 caracteres." });

  try {
    const result = await textosApoioFlow({ tema });
    const item = { tema, textos: result.textos, createdAt: new Date().toISOString() };

    if (firestore) {
      const ref = await userCol(req.user.uid, "apoios").add({ ...item, createdAt: new Date() });
      item.id = ref.id;
    } else {
      item.id = String(Date.now());
      memorySupport.set(req.user.uid, [item, ...(memorySupport.get(req.user.uid) || [])].slice(0, 50));
    }
    return res.json(item);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: error.message || "Não foi possível gerar os textos de apoio." });
  }
});

app.delete("/api/support-texts/:id", requireAuth, async (req, res) => {
  try {
    if (firestore) {
      await userCol(req.user.uid, "apoios").doc(String(req.params.id)).delete();
    } else {
      memorySupport.set(req.user.uid, (memorySupport.get(req.user.uid) || []).filter((x) => String(x.id) !== String(req.params.id)));
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Não foi possível excluir." });
  }
});


// ---- Suporte: relato de bugs por e-mail (SMTP) ----
const bugHits = new Map();
const cleanLine = (value = "", max = 200) => String(value).replace(/\s+/g, " ").trim().slice(0, max);

app.post("/api/support/bug", requireAuth, async (req, res) => {
  const titulo = cleanLine(req.body?.titulo, 120);
  const tela = cleanLine(req.body?.tela, 60);
  const dispositivo = cleanLine(req.body?.dispositivo, 300);
  const descricao = String(req.body?.descricao || "").trim().slice(0, 3000);

  if (titulo.length < 5) return res.status(400).json({ error: "Dê um título ao problema (mínimo 5 caracteres)." });
  if (descricao.length < 20) return res.status(400).json({ error: "Descreva o problema com pelo menos 20 caracteres." });

  // limite simples: 3 relatos a cada 10 minutos por usuário
  const now = Date.now();
  const recent = (bugHits.get(req.user.uid) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 3) return res.status(429).json({ error: "Você enviou muitos relatos agora há pouco. Tente novamente em alguns minutos." });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(501).json({ error: "O envio automático de e-mail ainda não está configurado no servidor." });
  }

  try {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Revisô AI" <${process.env.SMTP_USER}>`,
      to: process.env.SUPPORT_TO || "suporte.reviso@gmail.com",
      replyTo: req.user.email || undefined,
      subject: `[Bug] ${titulo}`,
      text: [
        `Usuário: ${req.user.email || "sem e-mail"} (uid ${req.user.uid})`,
        `Tela: ${tela || "não informada"}`,
        `Dispositivo: ${dispositivo || "não informado"}`,
        `Enviado em: ${new Date().toISOString()}`,
        "",
        descricao,
      ].join("\n"),
    });

    bugHits.set(req.user.uid, [...recent, now]);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao enviar e-mail de suporte:", error.message);
    return res.status(502).json({ error: "Não foi possível enviar o e-mail agora." });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve(__dirname, "../dist")));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.resolve(__dirname, "../dist/index.html")));
}

if (!process.env.VERCEL) {
  const server = app.listen(port, () => console.log(`Revisô API em http://localhost:${port}`));

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `\n[ERRO] A porta ${port} já está em uso por outro processo.\n` +
        `Feche o programa que está usando essa porta ou rode com outra porta, ex:\nPORT=3002 npm run server\n`
      );
    } else {
      console.error("[ERRO] Falha ao iniciar o servidor backend:", error.message);
    }
    process.exit(1);
  });
}

export default app;