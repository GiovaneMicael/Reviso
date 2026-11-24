import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const emailConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

const RATE_KEY = "reviso:bug-hits";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 3;

const cleanLine = (value = "", max = 200) => String(value).replace(/\s+/g, " ").trim().slice(0, max);

function readHits() {
  try {
    const hits = JSON.parse(localStorage.getItem(RATE_KEY) || "[]");
    return hits.filter((t) => Date.now() - t < WINDOW_MS);
  } catch {
    return [];
  }
}

function saveHits(hits) {
  try {
    localStorage.setItem(RATE_KEY, JSON.stringify(hits));
  } catch {
    /* armazenamento indisponível: segue sem limite local */
  }
}

/**
 * Envia o relato de bug para a caixa de entrada configurada no EmailJS.
 * Lança Error com `code`: "not_configured" | "rate_limited" | "send_failed".
 */
export async function sendBugReport({ titulo, tela, descricao, user }) {
  if (!emailConfigured) {
    const err = new Error("O envio de e-mail ainda não está configurado.");
    err.code = "not_configured";
    throw err;
  }

  const hits = readHits();
  if (hits.length >= MAX_HITS) {
    const err = new Error("Você enviou muitos relatos agora há pouco. Tente novamente em alguns minutos.");
    err.code = "rate_limited";
    throw err;
  }

  const params = {
    title: cleanLine(titulo, 120),
    screen: cleanLine(tela, 60) || "não informada",
    message: String(descricao || "").trim().slice(0, 3000),
    user_email: user?.email || "sem e-mail",
    user_uid: user?.uid || "desconhecido",
    reply_to: user?.email || "",
    device: cleanLine(navigator.userAgent, 300),
    sent_at: new Date().toLocaleString("pt-BR"),
  };

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, params, { publicKey: PUBLIC_KEY });
  } catch (cause) {
    console.error("Falha ao enviar e-mail via EmailJS:", cause?.text || cause);
    const err = new Error("Não foi possível enviar o relato agora. Tente novamente.");
    err.code = "send_failed";
    throw err;
  }

  saveHits([...hits, Date.now()]);
}
