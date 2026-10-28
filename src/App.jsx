import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider, configured } from "./lib/firebase";
import { requestApi } from "./lib/api";
import { useTheme, setTheme } from "./lib/theme";
import Icon from "./components/Icon";
import { TEMAS_ANTERIORES, EIXOS_PROVAVEIS, LIVROS_AUTORES, LEIS_DOCUMENTOS } from "./data/repertorio";
import "./App.css";

const COMP_NAMES = {
  1: "Domínio da norma-padrão",
  2: "Compreensão do tema e repertório",
  3: "Seleção e organização dos argumentos",
  4: "Coesão e mecanismos linguísticos",
  5: "Proposta de intervenção",
};

function initials(user) {
  const name = user?.displayName?.trim() || user?.email?.split("@")[0] || "Aluno";
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/email-already-in-use": "Este e-mail já possui uma conta.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/popup-closed-by-user": "O login com Google foi cancelado.",
    "auth/network-request-failed": "Não foi possível conectar ao Firebase.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
  };
  return messages[code] || "Não foi possível concluir a autenticação.";
}

function scoreMeta(score) {
  if (score >= 800) return { label: "Excelente", tone: "positive" };
  if (score >= 600) return { label: "Bom caminho", tone: "info" };
  if (score >= 400) return { label: "Em evolução", tone: "warning" };
  return { label: "Vamos evoluir", tone: "danger" };
}

function toDate(value) {
  if (!value) return null;
  // Firestore serializa Timestamp como { _seconds } ou { seconds }
  const seconds = value._seconds ?? value.seconds;
  const date = seconds != null ? new Date(seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Data não disponível";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function averageScore(essays) {
  if (!essays.length) return 0;
  return Math.round(essays.reduce((sum, e) => sum + Number(e.notaTotal || e.nota_total || 0), 0) / essays.length);
}

function normalizeEssay(item) {
  return {
    ...item,
    notaTotal: item.notaTotal ?? item.nota_total ?? 0,
    competencias: (item.competencias || []).map((c) => ({
      ...c,
      n: c.n ?? c.numero,
      nota: Number(c.nota || 0),
      nome: c.nome || COMP_NAMES[c.n ?? c.numero] || `Competência ${c.n ?? c.numero}`,
      comentario: c.comentario || c.justificativa || "",
    })),
    date: toDate(item.date || item.createdAt || item.created_at)?.toISOString() || new Date().toISOString(),
    texto: item.texto || "",
    favorito: Boolean(item.favorito),
    plano: item.plano || null,
    positivos: item.positivos || [],
    melhorar: item.melhorar || [],
    geral: item.geral || item.diagnostico_geral || "",
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("home");
  const [authScreen, setAuthScreen] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [essays, setEssays] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draftTema, setDraftTema] = useState("");
  const selectedEssay = essays.find((e) => e.id === selectedId) || null;

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return undefined;
    }

    getRedirectResult(auth).catch((error) => {
      setAuthMessage(friendlyAuthError(error));
    });

    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      setAuthLoading(false);
      if (current) {
        try {
          const token = await current.getIdToken();
          const data = await requestApi("/api/essays", {}, token);
          setEssays(Array.isArray(data) ? data.map(normalizeEssay) : []);
        } catch {
          setEssays([]);
        }
      } else {
        setEssays([]);
      }
    });
  }, []);

  async function handleLogout() {
    if (auth) await signOut(auth);
    setPage("home");
    setSidebarOpen(false);
  }

  async function saveEssay(essay) {
    const normalized = normalizeEssay(essay);
    setEssays((prev) => [normalized, ...prev.filter((e) => e.id !== normalized.id)]);
  }

  // Navegação única: opcionalmente leva um tema para a próxima tela (ex.: do repertório para a correção).
  function navigate(next, tema = "") {
    setDraftTema(tema);
    setPage(next);
    setSidebarOpen(false);
  }

  function updateEssay(id, patch) {
    setEssays((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function toggleFavorite(essay) {
    const next = !essay.favorito;
    updateEssay(essay.id, { favorito: next });
    try {
      const token = await user.getIdToken();
      await requestApi(`/api/essays/${essay.id}/favorite`, { method: "PATCH", body: JSON.stringify({ favorito: next }) }, token);
    } catch {
      updateEssay(essay.id, { favorito: !next });
    }
  }

  if (authLoading) return <Splash />;

  if (!user) {
    if (page === "landing") {
      return <Landing onLogin={() => { setAuthScreen("login"); setPage("auth"); }} />;
    }
    return (
      <AuthScreen
        screen={authScreen}
        setScreen={setAuthScreen}
        message={authMessage}
        setMessage={setAuthMessage}
        onBack={() => setPage("landing")}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={navigate}
        user={user}
        onLogout={handleLogout}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />
      <main className="main-area">
        <Topbar
          page={page}
          user={user}
          onMenu={() => setSidebarOpen(true)}
          onProfile={() => navigate("profile")}
        />
        <div className="page-container">
          {page === "home" && <Dashboard user={user} essays={essays} setPage={navigate} />}
          {page === "correct" && <Correction key={draftTema} user={user} onSave={saveEssay} initialTema={draftTema} onNavigate={navigate} />}
          {page === "history" && (
            <History essays={essays} onView={(e) => setSelectedId(e.id)} onToggleFav={toggleFavorite} setPage={navigate} />
          )}
          {page === "lessons" && <LessonPlan user={user} essays={essays} onEssayUpdate={updateEssay} setPage={navigate} />}
          {page === "support" && <SupportTexts key={draftTema} user={user} initialTema={draftTema} onNavigate={navigate} />}
          {page === "settings" && <Settings user={user} />}
          {page === "profile" && <Profile user={user} essays={essays} onView={(e) => setSelectedId(e.id)} onToggleFav={toggleFavorite} setPage={navigate} />}
        </div>
      </main>
      {selectedEssay && <EssayModal essay={selectedEssay} onToggleFav={toggleFavorite} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="brand-mark large"><Icon name="spark" size={25} /></div>
      <strong>Revisô</strong>
      <div className="spinner small" />
    </div>
  );
}

function Landing({ onLogin }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <button className="btn btn-ghost" onClick={onLogin}>Entrar <Icon name="arrow" size={17} /></button>
      </header>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow"><Icon name="spark" size={15} /> Inteligência para aprender a escrever</span>
          <h1>Não receba apenas uma nota.<br /><span>Entenda como evoluir.</span></h1>
          <p>
            O Revisô transforma sua redação em um diagnóstico pedagógico claro:
            competências, pontos fortes, lacunas e um plano de estudo para sua próxima versão.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onLogin}>Começar agora <Icon name="arrow" size={18} /></button>
            <div className="trust-line"><Icon name="shield" size={16} /> Seus dados ficam protegidos</div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="glow" />
          <div className="ai-panel">
            <div className="ai-panel-head">
              <span className="status-dot" /> Revisô AI <span>análise concluída</span>
            </div>
            <div className="ai-score">
              <div className="score-ring-mini"><b>840</b><small>/1000</small></div>
              <div><span className="tag positive">Excelente evolução</span><h3>Seu texto tem potencial.</h3><p>O próximo ganho está em C3 e C5.</p></div>
            </div>
            <div className="mini-bars">
              {[["C1", 88], ["C2", 92], ["C3", 68], ["C4", 84], ["C5", 72]].map(([n, v]) => (
                <div key={n}><b>{n}</b><div><i style={{ width: `${v}%` }} /></div></div>
              ))}
            </div>
            <div className="ai-insight"><Icon name="spark" size={16} /><span>Plano personalizado gerado a partir das suas maiores lacunas.</span></div>
          </div>
        </div>
      </section>
      <section className="landing-features">
        {[
          ["target", "Correção por competência", "C1 a C5 com justificativas técnicas e objetivas."],
          ["chart", "Evolução real", "Compare suas redações e acompanhe seu desempenho."],
          ["book", "Plano de aulas", "Transforme seus pontos fracos em uma trilha de estudo."],
        ].map(([icon, title, text]) => (
          <article key={title} className="feature-card">
            <div className="feature-icon"><Icon name={icon} size={21} /></div>
            <h3>{title}</h3><p>{text}</p>
          </article>
        ))}
      </section>
      <footer className="landing-footer">Revisô · seu laboratório inteligente de escrita</footer>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <div className="brand-mark"><Icon name="spark" size={18} /></div>
      <div><strong>Revisô</strong>{!compact && <small>AI · escrita inteligente</small>}</div>
    </div>
  );
}

function AuthScreen({ screen, setScreen, message, setMessage, onBack }) {
  const isRegister = screen === "register";
  const isForgot = screen === "forgot";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => { setMessage(""); setDone(""); }, [screen, setMessage]);

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setDone("");
    setBusy(true);
    try {
      if (!configured || !auth) throw new Error("Firebase Auth ainda não foi configurado. Preencha o .env do frontend.");
      if (isForgot) {
        await sendPasswordResetEmail(auth, email);
        setDone("Enviamos as instruções de recuperação para o seu e-mail.");
      } else if (isRegister) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setMessage(error.message?.startsWith("Firebase Auth") ? error.message : friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMessage("");
    setBusy(true);
    try {
      if (!configured || !auth || !googleProvider) throw new Error("Firebase Auth ainda não foi configurado. Preencha o .env do frontend.");

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        // A página recarrega e o resultado é tratado no useEffect do componente App
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      setMessage(error.message?.startsWith("Firebase Auth") ? error.message : friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <div className="auth-card">
        <button className="back-link" onClick={onBack}>← Voltar para apresentação</button>
        <div className="auth-heading">
          <span className="eyebrow">{isForgot ? "Recuperação" : isRegister ? "Sua conta" : "Bem-vindo de volta"}</span>
          <h1>{isForgot ? "Recupere o acesso." : isRegister ? "Crie seu espaço de estudo." : "Entre no Revisô."}</h1>
          <p>{isForgot ? "Informe seu e-mail e enviaremos um link seguro." : "Acesse seu histórico, suas correções e seu plano personalizado."}</p>
        </div>

        {message && <div className="alert error">{message}</div>}
        {done && <div className="alert success">{done}</div>}

        {!isForgot && (
          <>
            <button className="google-btn" onClick={google} disabled={busy}><Icon name="google" size={18} /> Continuar com Google</button>
            <div className="or"><span>ou</span></div>
          </>
        )}

        <form onSubmit={submit}>
          {isRegister && (
            <Field label="Seu nome" value={name} onChange={setName} placeholder="Como você quer ser chamado?" icon="user" />
          )}
          <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" icon="mail" required />
          {!isForgot && <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="Digite sua senha" icon="lock" required minLength={6} />}
          <button className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? <span className="btn-loading"><span className="spinner" /> Aguarde...</span> : isForgot ? "Enviar link de recuperação" : isRegister ? "Criar minha conta" : "Entrar"}
          </button>
        </form>

        {!isForgot && (
          <div className="auth-switch">
            {isRegister ? "Já possui uma conta?" : "Ainda não possui uma conta?"}
            <button onClick={() => setScreen(isRegister ? "login" : "register")}>{isRegister ? "Entrar" : "Criar conta"}</button>
          </div>
        )}
        {!isRegister && !isForgot && <button className="forgot-link" onClick={() => setScreen("forgot")}>Esqueci minha senha</button>}
        {isForgot && <button className="forgot-link" onClick={() => setScreen("login")}>Voltar para o login</button>}
      </div>
      <p className="auth-foot"><Icon name="shield" size={14} /> Autenticação segura pelo Firebase</p>
    </div>
  );
}

function Field({ label, icon, onChange, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <Icon name={icon} size={18} />
        <input {...props} onChange={(e) => onChange?.(e.target.value)} />
      </div>
    </label>
  );
}

function Sidebar({ page, setPage, user, onLogout, open, setOpen }) {
  const primary = [
    ["home", "Início"],
    ["correct", "Corrigir redação"],
    ["history", "Histórico"],
    ["lessons", "Plano de aulas"],
    ["support", "Textos de apoio"],
    ["settings", "Configurações"],
  ];
  return (
    <>
      <div className={`mobile-overlay ${open ? "visible" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-btn mobile-close" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <button className="new-correction" onClick={() => setPage("correct")}><span><Icon name="plus" size={17} /></span> Nova correção</button>
        <nav className="side-nav">
          <span className="nav-label">Workspace</span>
          {primary.map(([id, label]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>
              <Icon name={{ correct: "pen", support: "library", settings: "settings" }[id] || id} size={19} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`profile-mini ${page === "profile" ? "active" : ""}`} onClick={() => setPage("profile")}>
            <div className="avatar">{initials(user)}</div>
            <div><b>{user.displayName || "Aluno Revisô"}</b><span>{user.email}</span></div>
            <Icon name="chevron" size={15} />
          </button>
          <button className="logout-btn" onClick={onLogout}><Icon name="logout" size={17} /> Sair da conta</button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ page, user, onMenu, onProfile }) {
  const titles = { home: "Visão geral", correct: "Corrigir redação", history: "Histórico", lessons: "Plano de aulas", support: "Textos de apoio", settings: "Configurações", profile: "Meu perfil" };
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu}><Icon name="menu" /></button>
      <div><span className="topbar-kicker">Revisô AI</span><h2>{titles[page]}</h2></div>
      <button className="topbar-profile" onClick={onProfile}><div className="avatar small">{initials(user)}</div><span>{user.displayName?.split(" ")[0] || "Perfil"}</span><Icon name="chevron" size={15} /></button>
    </header>
  );
}

function Dashboard({ user, essays, setPage }) {
  const avg = averageScore(essays);
  const best = essays.length ? Math.max(...essays.map((e) => Number(e.notaTotal || 0))) : 0;
  const last = essays[0];

  return (
    <div className="dashboard page-enter">
      <section className="welcome-row">
        <div>
          <span className="eyebrow"><span className="live-dot" /> Seu espaço de evolução</span>
          <h1>Olá, {user.displayName?.split(" ")[0] || "estudante"}.</h1>
          <p>Vamos transformar a próxima redação em um passo à frente.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setPage("correct")}><Icon name="pen" size={17} /> Nova correção</button>
      </section>

      <section className="stats-grid">
        <StatCard icon="chart" label="Média geral" value={avg || "—"} suffix={avg ? "/1000" : ""} hint={essays.length ? `${essays.length} correção${essays.length > 1 ? "ões" : ""}` : "Comece sua primeira"} />
        <StatCard icon="target" label="Melhor nota" value={best || "—"} suffix={best ? "/1000" : ""} hint={best ? scoreMeta(best).label : "Ainda sem histórico"} />
        <StatCard icon="book" label="Plano de aulas" value={essays.length ? "Ativo" : "—"} hint={essays.length ? "Baseado no seu desempenho" : "Após sua primeira correção"} />
      </section>

      <div className="dashboard-grid">
        <section className="card recent-card">
          <div className="section-head"><div><span className="eyebrow">Atividade</span><h2>Última correção</h2></div><button className="text-btn" onClick={() => setPage("history")}>Ver histórico <Icon name="arrow" size={15} /></button></div>
          {last ? <RecentEssay essay={last} /> : <EmptyState setPage={setPage} />}
        </section>

        <section className="card insight-card">
          <div className="section-head"><div><span className="eyebrow">Revisô Intelligence</span><h2>Seu próximo foco</h2></div><Icon name="spark" size={21} /></div>
          {last ? <FocusInsight essay={last} setPage={setPage} /> : (
            <div className="insight-empty"><div className="feature-icon"><Icon name="spark" /></div><h3>Seu diagnóstico começa aqui.</h3><p>Faça sua primeira correção para o Revisô identificar suas maiores oportunidades.</p><button className="btn btn-dark" onClick={() => setPage("correct")}>Começar análise</button></div>
          )}
        </section>
      </div>

      <section className="card methodology-card">
        <div><span className="eyebrow">Como funciona</span><h2>Uma IA que explica o caminho.</h2><p>O Revisô não substitui seu estudo: ele organiza o que você precisa estudar a partir da sua própria escrita.</p></div>
        <div className="method-steps">
          {["Escreva", "Analise", "Pratique"].map((x, i) => <div key={x}><b>0{i + 1}</b><strong>{x}</strong><span>{["Envie sua redação para análise.", "Entenda suas competências.", "Siga seu plano de aulas."][i]}</span></div>)}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, suffix, hint }) {
  return <article className="stat-card"><div className="stat-icon"><Icon name={icon} size={19} /></div><span>{label}</span><strong>{value}<small>{suffix}</small></strong><em>{hint}</em></article>;
}

function RecentEssay({ essay }) {
  const meta = scoreMeta(Number(essay.notaTotal));
  return <div className="recent-essay"><div className="recent-score"><strong>{essay.notaTotal}</strong><span>/ 1000</span></div><div className="recent-info"><span className={`tag ${meta.tone}`}>{meta.label}</span><h3>{essay.tema || "Sem tema"}</h3><p>{formatDate(essay.date)}</p></div></div>;
}

function FocusInsight({ essay, setPage }) {
  const weak = [...(essay.competencias || [])].sort((a, b) => a.nota - b.nota)[0];
  if (!weak) return null;
  return <div className="focus-content"><div className="focus-number">C{weak.n}</div><div><span className="tag warning">Maior oportunidade</span><h3>{weak.nome}</h3><p>{weak.comentario || "Revise esta competência na próxima sessão."}</p><button className="text-btn" onClick={() => setPage("lessons")}>Abrir plano de aulas <Icon name="arrow" size={15} /></button></div></div>;
}

function EmptyState({ setPage }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="pen" size={25} /></div><h3>Seu histórico começa com uma redação.</h3><p>Envie um texto e receba uma análise detalhada das cinco competências.</p><button className="btn btn-primary" onClick={() => setPage("correct")}>Corrigir primeira redação</button></div>;
}

function Correction({ user, onSave, initialTema = "", onNavigate }) {
  const [tema, setTema] = useState(initialTema);
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  const words = texto.trim().split(/\s+/).filter(Boolean).length;

  async function submit() {
    if (words < 30) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const token = await user.getIdToken();
      const essay = await requestApi("/api/correct", { method: "POST", body: JSON.stringify({ tema, texto }) }, token);
      const normalized = normalizeEssay(essay);
      setResult(normalized);
      await onSave(normalized);
      setStatus("done");
    } catch (error) {
      setErrorMsg(error.message || "Não foi possível analisar agora.");
      setStatus("error");
      setResult(null);
    }
  }

  function reset() {
    setTema(""); setTexto(""); setResult(null); setStatus("idle");
  }

  if (status === "done" && result) {
    return <CorrectionResult result={result} onNew={reset} />;
  }

  return (
    <div className="correction-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="spark" size={14} /> Laboratório de escrita</span><h1>Corrija. Entenda. Reescreva.</h1><p>Envie sua redação e receba uma leitura estruturada segundo as cinco competências do ENEM.</p></div></section>
      <div className="correction-layout">
        <section className="card editor-card">
          <div className="editor-head"><div><span className="step-badge">01</span><div><b>Contexto</b><small>Escreva seu próprio tema ou deixe a IA sugerir.</small></div></div></div>
          <label className="field plain"><span>Tema da redação <small>opcional</small></span><input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Digite o tema proposto" /></label>
          <ThemeSuggester user={user} onPick={setTema} />
          {tema.trim().length >= 8 && (
            <button type="button" className="text-btn support-link" onClick={() => onNavigate("support", tema.trim())}><Icon name="library" size={15} /> Gerar textos de apoio para este tema</button>
          )}
          <label className="field plain"><span>Sua redação</span><textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comece a escrever ou cole sua redação aqui..." /></label>
          <div className="editor-footer"><span className={words < 30 ? "word-count warning-text" : "word-count"}>{words} palavras {words < 30 && "· mínimo 30"}</span><button className="btn btn-primary" onClick={submit} disabled={status === "loading" || words < 30}>{status === "loading" ? <><span className="spinner" /> Analisando...</> : <><Icon name="spark" size={17} /> Analisar com IA</>}</button></div>
          {status === "error" && <div className="alert error">{errorMsg}</div>}
        </section>
        <aside className="card editor-aside">
          <div className="aside-icon"><Icon name="shield" /></div><h3>Seu texto, seu diagnóstico.</h3><p>A análise considera cada competência separadamente e transforma as lacunas encontradas em próximos passos de estudo.</p>
          <div className="aside-list">{["C1 · Norma-padrão", "C2 · Tema e repertório", "C3 · Argumentação", "C4 · Coesão", "C5 · Intervenção"].map((x) => <span key={x}><Icon name="check" size={14} /> {x}</span>)}</div>
        </aside>
      </div>
    </div>
  );
}

// Sugestão automática de temas: nunca substitui o tema escrito pelo aluno, só oferece opções clicáveis.
function ThemeSuggester({ user, onPick }) {
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function suggest() {
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const data = await requestApi("/api/themes", { method: "POST", body: JSON.stringify({ eixo: "", evitar: options.map((o) => o.tema) }) }, token);
      setOptions(data.temas || []);
    } catch (e) {
      setError(e.message || "Não foi possível sugerir temas agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="theme-suggester">
      <button type="button" className="btn btn-secondary btn-small" onClick={suggest} disabled={busy}>
        {busy ? <><span className="spinner" /> Pensando...</> : <><Icon name="spark" size={15} /> {options.length ? "Sugerir outros temas" : "Sugerir temas com IA"}</>}
      </button>
      {error && <div className="alert error">{error}</div>}
      {options.length > 0 && (
        <div className="theme-options">
          {options.map((o) => (
            <button type="button" key={o.tema} className="theme-chip" onClick={() => { onPick(o.tema); setOptions([]); }}>
              <span>{o.eixo}</span>{o.tema}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectionResult({ result, onNew }) {
  const meta = scoreMeta(result.notaTotal);
  return (
    <div className="result-page page-enter">
      <div className="result-top"><div><span className="eyebrow"><Icon name="check" size={14} /> Análise concluída</span><h1>Seu diagnóstico.</h1><p>{result.tema || "Tema não informado"}</p></div><button className="btn btn-secondary" onClick={onNew}><Icon name="plus" size={17} /> Nova redação</button></div>
      <section className="score-hero card">
        <div className="big-score"><span>Nota total</span><strong>{result.notaTotal}</strong><small>/ 1000 · {meta.label}</small></div>
        <div className="score-summary"><span className={`tag ${meta.tone}`}>{meta.label}</span><p>{result.geral}</p></div>
        <div className="score-stats"><div><b>{result.positivos?.length || 0}</b><span>Pontos fortes</span></div><div><b>{result.melhorar?.length || 0}</b><span>Prioridades</span></div></div>
      </section>
      <section className="card competence-card"><div className="section-head"><div><span className="eyebrow">Matriz ENEM</span><h2>Desempenho por competência</h2></div></div>{result.competencias.map((c) => <CompetenceRow key={c.n} comp={c} />)}</section>
      <div className="result-columns">
        <section className="card detail-card"><div className="section-head"><div><span className="eyebrow">Leitura pedagógica</span><h2>Pontos fortes</h2></div></div><ul className="clean-list">{(result.positivos || []).map((x, i) => <li key={i}><span className="list-dot positive"><Icon name="check" size={13} /></span>{x}</li>)}</ul></section>
        <section className="card detail-card"><div className="section-head"><div><span className="eyebrow">Próximos passos</span><h2>O que melhorar</h2></div></div><ul className="clean-list">{(result.melhorar || []).map((x, i) => <li key={i}><span className="list-dot warning">!</span>{x}</li>)}</ul></section>
      </div>
      <section className="card diagnosis-card"><span className="eyebrow">Diagnóstico da IA</span><p>{result.geral}</p></section>
    </div>
  );
}

function CompetenceRow({ comp }) {
  const pct = Math.min(100, (Number(comp.nota) / 200) * 100);
  return <article className="competence-row"><div className="comp-title"><span className="comp-code">C{comp.n}</span><div><b>{comp.nome}</b><p>{comp.comentario}</p></div><strong>{comp.nota}<small>/200</small></strong></div><div className="progress"><i style={{ width: `${pct}%` }} /></div></article>;
}

function History({ essays, onView, onToggleFav, setPage }) {
  const [query, setQuery] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const favCount = essays.filter((e) => e.favorito).length;
  const filtered = useMemo(
    () => essays.filter((e) => (!onlyFav || e.favorito) && (e.tema || "").toLowerCase().includes(query.toLowerCase())),
    [essays, query, onlyFav]
  );

  return (
    <div className="history-page page-enter">
      <section className="page-heading split"><div><span className="eyebrow"><Icon name="history" size={14} /> Sua trajetória</span><h1>Histórico de redações.</h1><p>Abra qualquer redação para ver o texto, a nota e a análise. Favorite as melhores para exibi-las no seu perfil.</p></div><div className="history-summary"><b>{essays.length}</b><span>correções</span></div></section>
      <div className="search-row">
        <div className="search-field"><Icon name="history" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por tema..." /></div>
        <button className={`btn btn-secondary ${onlyFav ? "toggled" : ""}`} onClick={() => setOnlyFav((v) => !v)} aria-pressed={onlyFav}><Icon name="star" size={16} fill={onlyFav ? "currentColor" : "none"} /> Favoritas ({favCount})</button>
        <button className="btn btn-primary" onClick={() => setPage("correct")}><Icon name="plus" size={17} /> Nova correção</button>
      </div>
      {!filtered.length ? <div className="card empty-state"><div className="empty-icon"><Icon name={onlyFav ? "star" : "history"} size={24} /></div><h3>{onlyFav ? "Nenhuma redação favorita ainda." : essays.length ? "Nenhuma redação encontrada." : "Você ainda não tem correções."}</h3><p>{onlyFav ? "Toque na estrela de uma redação para ela aparecer em Meus Destaques." : essays.length ? "Tente outro termo de busca." : "Sua primeira análise ficará registrada aqui."}</p>{!essays.length && <button className="btn btn-primary" onClick={() => setPage("correct")}>Começar agora</button>}</div> : <div className="history-list">{filtered.map((essay) => <HistoryRow key={essay.id} essay={essay} onClick={() => onView(essay)} onToggleFav={() => onToggleFav(essay)} />)}</div>}
    </div>
  );
}

function StarButton({ active, onClick, size = 18 }) {
  const label = active ? "Remover dos favoritos" : "Favoritar redação";
  return (
    <button type="button" className={`star-btn ${active ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onClick(); }} aria-pressed={active} aria-label={label} title={label}>
      <Icon name="star" size={size} fill={active ? "currentColor" : "none"} />
    </button>
  );
}

function HistoryRow({ essay, onClick, onToggleFav }) {
  const meta = scoreMeta(Number(essay.notaTotal));
  return (
    <div className="history-item">
      <button className="history-row" onClick={onClick}><div className="history-score"><strong>{essay.notaTotal}</strong><span>/1000</span></div><div className="history-main"><span className={`tag ${meta.tone}`}>{meta.label}</span><h3>{essay.tema || "Sem tema"}</h3><p>{formatDate(essay.date)} · {essay.competencias.length} competências avaliadas</p></div><div className="history-comps">{essay.competencias.map((c) => <span key={c.n}>C{c.n} <b>{c.nota}</b></span>)}</div><Icon name="chevron" size={19} /></button>
      <StarButton active={essay.favorito} onClick={onToggleFav} />
    </div>
  );
}

function LessonPlan({ user, essays, onEssayUpdate, setPage }) {
  const [tab, setTab] = useState("plan");
  return (
    <div className="lessons-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="book" size={14} /> Aprendizado adaptativo</span><h1>Plano de aulas.</h1><p>Entenda sua redação como um todo, competência por competência, e estude o que realmente cai no ENEM.</p></div></section>
      <div className="tabs" role="tablist">
        {[["plan", "Meu plano"], ["repertorio", "Repertório ENEM"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "plan" ? <PlanTab user={user} essays={essays} onEssayUpdate={onEssayUpdate} setPage={setPage} /> : <RepertorioTab onNavigate={setPage} />}
    </div>
  );
}

function PlanTab({ user, essays, onEssayUpdate, setPage }) {
  const [pickedId, setPickedId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const essay = essays.find((e) => e.id === pickedId) || essays[0];

  if (!essay) {
    return <div className="card lesson-empty"><div className="empty-icon"><Icon name="book" size={25} /></div><h2>Seu plano ainda está em branco.</h2><p>Faça uma correção para a IA montar a análise geral e o plano por competência.</p><button className="btn btn-primary" onClick={() => setPage("correct")}>Fazer primeira correção <Icon name="arrow" size={16} /></button></div>;
  }

  async function generate(force = false) {
    setStatus("loading");
    setError("");
    try {
      const token = await user.getIdToken();
      const plano = await requestApi(`/api/essays/${essay.id}/plan`, { method: "POST", body: JSON.stringify({ force }) }, token);
      onEssayUpdate(essay.id, { plano });
      setStatus("idle");
    } catch (e) {
      setError(e.message || "Não foi possível gerar o plano agora.");
      setStatus("error");
    }
  }

  const plano = essay.plano;
  const lowest = plano ? [...plano.competencias].sort((a, b) => a.nota - b.nota).slice(0, 2).map((c) => c.n) : [];

  return (
    <>
      <div className="plan-picker card">
        <label className="field plain"><span>Redação analisada</span>
          <select value={essay.id} onChange={(e) => { setPickedId(e.target.value); setStatus("idle"); setError(""); }}>
            {essays.map((e) => <option key={e.id} value={e.id}>{formatDate(e.date)} · {e.notaTotal}/1000 · {(e.tema || "Sem tema").slice(0, 70)}</option>)}
          </select>
        </label>
      </div>

      {!plano && (
        <div className="card plan-cta">
          <div className="plan-banner-icon"><Icon name="spark" /></div>
          <div><h2>Gerar análise com IA</h2><p>A IA lê a redação inteira e devolve uma análise geral, e abaixo, a análise e o plano de melhoria de cada competência.</p>{!essay.texto && <p className="warning-text">Esta redação foi salva antes de o texto ser guardado. Corrija-a novamente para liberar o plano.</p>}</div>
          <button className="btn btn-primary" onClick={() => generate(false)} disabled={status === "loading" || !essay.texto}>{status === "loading" ? <><span className="spinner" /> Analisando...</> : <><Icon name="spark" size={17} /> Gerar plano</>}</button>
        </div>
      )}
      {status === "error" && <div className="alert error">{error}</div>}

      {plano && (
        <>
          <section className="card plan-general">
            <div className="section-head"><div><span className="eyebrow">Visão geral</span><h2>Análise geral da redação</h2></div><span className={`tag ${scoreMeta(essay.notaTotal).tone}`}>{essay.notaTotal}/1000</span></div>
            <p>{plano.analiseGeral}</p>
          </section>
          <div className="section-head plan-section-title"><div><span className="eyebrow">Competência por competência</span><h2>Como melhorar cada uma</h2></div><button className="text-btn" onClick={() => generate(true)} disabled={status === "loading"}>{status === "loading" ? "Gerando..." : "Gerar novamente"}</button></div>
          <div className="lesson-list">
            {[...plano.competencias].sort((a, b) => a.n - b.n).map((c) => <CompetencePlan key={c.n} comp={c} priority={lowest.includes(c.n)} />)}
          </div>
        </>
      )}
    </>
  );
}

function CompetencePlan({ comp, priority }) {
  const pct = Math.min(100, (Number(comp.nota) / 200) * 100);
  return (
    <article className="card comp-plan">
      <div className="comp-plan-head"><span className="comp-code">C{comp.n}</span><div><b>{comp.nome || COMP_NAMES[comp.n]}</b>{priority && <span className="tag warning">Prioridade</span>}</div><strong>{comp.nota}<small>/200</small></strong></div>
      <div className="progress"><i style={{ width: `${pct}%` }} /></div>
      <p className="comp-plan-analysis">{comp.analise}</p>
      <div className="comp-plan-how"><span>Como melhorar</span><ul className="clean-list">{comp.comoMelhorar.map((x, i) => <li key={i}><span className="list-dot positive"><Icon name="check" size={13} /></span>{x}</li>)}</ul></div>
      <div className="lesson-task"><span>Exercício</span><p>{comp.exercicio}</p></div>
    </article>
  );
}

function RepertorioTab({ onNavigate }) {
  const [section, setSection] = useState("temas");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (...parts) => !q || parts.flat().join(" ").toLowerCase().includes(q);

  const temas = TEMAS_ANTERIORES.filter((t) => match(t.tema, t.eixo, String(t.ano)));
  const eixos = EIXOS_PROVAVEIS.filter((e) => match(e.eixo, e.exemplos, e.dica));
  const livros = LIVROS_AUTORES.filter((l) => match(l.nome, l.obra, l.area, l.ideia, l.serve));
  const leis = LEIS_DOCUMENTOS.filter((l) => match(l.nome, l.ideia, l.serve));

  const sections = [["temas", "Temas que já caíram", temas.length], ["eixos", "Eixos para estudar", eixos.length], ["livros", "Livros e autores", livros.length], ["leis", "Leis e documentos", leis.length]];

  const ThemeActions = ({ tema }) => (
    <div className="theme-actions">
      <button className="text-btn" onClick={() => onNavigate("correct", tema)}><Icon name="pen" size={14} /> Escrever</button>
      <button className="text-btn" onClick={() => onNavigate("support", tema)}><Icon name="library" size={14} /> Textos de apoio</button>
    </div>
  );

  return (
    <section className="repertorio">
      <div className="search-row">
        <div className="search-field"><Icon name="history" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por tema, autor, livro ou assunto..." /></div>
      </div>
      <div className="subtabs">
        {sections.map(([id, label, count]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label} <b>{count}</b></button>)}
      </div>

      {section === "temas" && (
        <div className="rep-list">
          {temas.map((t) => (
            <article key={t.ano} className="card rep-card theme-row">
              <span className="year-badge">{t.ano}</span>
              <div><h3>{t.tema}</h3><span className="tag info">{t.eixo}</span></div>
              <ThemeActions tema={t.tema} />
            </article>
          ))}
        </div>
      )}

      {section === "eixos" && (
        <>
          <div className="alert info-note">Estes eixos são apostas de estudo baseadas em tendências, não previsões: o Inep não divulga o tema antes da prova. Use-os para ampliar repertório.</div>
          <div className="rep-grid">
            {eixos.map((e) => (
              <article key={e.eixo} className="card rep-card">
                <h3>{e.eixo}</h3><p className="muted">{e.dica}</p>
                <ul className="example-list">{e.exemplos.map((ex) => <li key={ex}><span>{ex}</span><ThemeActions tema={ex} /></li>)}</ul>
              </article>
            ))}
          </div>
        </>
      )}

      {section === "livros" && (
        <div className="rep-grid">
          {livros.map((l) => (
            <article key={l.nome + l.obra} className="card rep-card">
              <span className="tag info">{l.area}</span>
              <h3>{l.nome}</h3><p className="rep-work">{l.obra}</p><p>{l.ideia}</p>
              <div className="chips">{l.serve.map((x) => <span key={x}>{x}</span>)}</div>
            </article>
          ))}
        </div>
      )}

      {section === "leis" && (
        <div className="rep-grid">
          {leis.map((l) => (
            <article key={l.nome} className="card rep-card">
              <h3>{l.nome}</h3><p>{l.ideia}</p>
              <div className="chips">{l.serve.map((x) => <span key={x}>{x}</span>)}</div>
            </article>
          ))}
        </div>
      )}

      {((section === "temas" && !temas.length) || (section === "eixos" && !eixos.length) || (section === "livros" && !livros.length) || (section === "leis" && !leis.length)) && (
        <div className="card empty-state"><h3>Nada encontrado.</h3><p>Tente outro termo de busca.</p></div>
      )}
    </section>
  );
}

function Profile({ user, essays, onView, onToggleFav, setPage }) {
  const avg = averageScore(essays);
  const [name, setName] = useState(user.displayName || "");
  const [saved, setSaved] = useState(false);
  const best = useMemo(
    () => (essays.length ? [...essays].sort((a, b) => Number(b.notaTotal) - Number(a.notaTotal) || new Date(b.date) - new Date(a.date))[0] : null),
    [essays]
  );
  const favorites = essays.filter((e) => e.favorito);

  async function save() {
    if (!auth || !name.trim()) return;
    await updateProfile(user, { displayName: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="profile-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="user" size={14} /> Conta</span><h1>Meu perfil.</h1><p>Gerencie seus dados, reveja sua melhor redação e seus destaques.</p></div></section>
      <div className="profile-grid">
        <section className="card profile-main"><div className="profile-hero"><div className="avatar huge">{initials(user)}</div><div><h2>{user.displayName || "Aluno Revisô"}</h2><p>{user.email}</p><span className="tag positive">Conta verificada</span></div></div><div className="divider" /><div className="profile-form"><label className="field plain"><span>Nome de exibição</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="field plain"><span>E-mail</span><input value={user.email || ""} disabled /></label><button className="btn btn-primary" onClick={save}>Salvar alterações</button>{saved && <span className="save-ok"><Icon name="check" size={15} /> Perfil atualizado.</span>}</div></section>
        <aside className="card profile-stats"><span className="eyebrow">Sua jornada</span><div className="profile-stat"><b>{essays.length}</b><span>Redações analisadas</span></div><div className="profile-stat"><b>{avg || "—"}</b><span>Média geral</span></div><div className="profile-stat"><b>{best ? best.notaTotal : "—"}</b><span>Melhor nota</span></div></aside>
      </div>

      <section className="card best-essay">
        <div className="section-head"><div><span className="eyebrow">Orgulho da jornada</span><h2>Minha melhor redação</h2></div>{best && <StarButton active={best.favorito} onClick={() => onToggleFav(best)} />}</div>
        {best ? (
          <div className="best-body">
            <div className="best-score"><strong>{best.notaTotal}</strong><span>/ 1000</span><span className={`tag ${scoreMeta(Number(best.notaTotal)).tone}`}>{scoreMeta(Number(best.notaTotal)).label}</span></div>
            <div className="best-main">
              <h3>{best.tema || "Sem tema"}</h3>
              <p className="muted">{formatDate(best.date)}</p>
              <div className="history-comps">{best.competencias.map((c) => <span key={c.n}>C{c.n} <b>{c.nota}</b></span>)}</div>
              {best.geral && <p className="best-analysis"><b>Análise:</b> {best.geral}</p>}
              {best.texto ? <blockquote className="essay-excerpt">{best.texto.length > 520 ? `${best.texto.slice(0, 520).trim()}…` : best.texto}</blockquote> : <p className="muted">O texto desta redação não foi guardado (ela é anterior à atualização).</p>}
              <button className="btn btn-secondary" onClick={() => onView(best)}>Ver redação e análise completas</button>
            </div>
          </div>
        ) : (
          <div className="empty-state compact"><h3>Sua melhor redação aparece aqui.</h3><p>Faça sua primeira correção.</p><button className="btn btn-primary" onClick={() => setPage("correct")}>Corrigir redação</button></div>
        )}
      </section>

      <section className="card highlights">
        <div className="section-head"><div><span className="eyebrow">Favoritas</span><h2>Meus Destaques</h2></div><button className="text-btn" onClick={() => setPage("history")}>Gerenciar no histórico <Icon name="arrow" size={15} /></button></div>
        {favorites.length ? (
          <div className="history-list">{favorites.map((e) => <HistoryRow key={e.id} essay={e} onClick={() => onView(e)} onToggleFav={() => onToggleFav(e)} />)}</div>
        ) : (
          <div className="empty-state compact"><div className="empty-icon"><Icon name="star" size={22} /></div><h3>Você ainda não tem destaques.</h3><p>No Histórico, toque na estrela das redações que quiser guardar aqui.</p><button className="btn btn-secondary" onClick={() => setPage("history")}>Ir para o histórico</button></div>
        )}
      </section>
    </div>
  );
}

function EssayModal({ essay, onClose, onToggleFav }) {
  const [view, setView] = useState("analise");
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <article className="modal">
        <div className="modal-head">
          <div><span className="eyebrow">Detalhes da correção</span><h2>{essay.tema || "Sem tema"}</h2><p>{formatDate(essay.date)}</p></div>
          <div className="modal-actions"><StarButton active={essay.favorito} onClick={() => onToggleFav(essay)} /><button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button></div>
        </div>
        <div className="modal-score"><strong>{essay.notaTotal}</strong><span>/ 1000</span></div>
        <div className="tabs compact" role="tablist">
          {[["analise", "Nota e análise"], ["texto", "Redação"]].map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}
        </div>
        {view === "analise" ? (
          <>
            <div className="modal-comps">{essay.competencias.map((c) => <CompetenceRow key={c.n} comp={c} />)}</div>
            <div className="diagnosis-card compact"><span className="eyebrow">Diagnóstico</span><p>{essay.geral}</p></div>
            {(essay.positivos.length > 0 || essay.melhorar.length > 0) && (
              <div className="result-columns modal-columns">
                <div><span className="eyebrow">Pontos fortes</span><ul className="clean-list">{essay.positivos.map((x, i) => <li key={i}><span className="list-dot positive"><Icon name="check" size={13} /></span>{x}</li>)}</ul></div>
                <div><span className="eyebrow">O que melhorar</span><ul className="clean-list">{essay.melhorar.map((x, i) => <li key={i}><span className="list-dot warning">!</span>{x}</li>)}</ul></div>
              </div>
            )}
          </>
        ) : essay.texto ? (
          <div className="essay-text">{essay.texto}</div>
        ) : (
          <div className="alert info-note">O texto desta redação não foi guardado, pois ela é anterior à atualização. As novas correções já guardam o texto.</div>
        )}
      </article>
    </div>
  );
}

const TIPO_APOIO = { noticia: "Notícia", grafico: "Gráfico / infográfico", literario: "Texto literário", legislacao: "Legislação", dados: "Dados de pesquisa" };

function SupportTexts({ user, initialTema = "", onNavigate }) {
  const [tema, setTema] = useState(initialTema);
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await user.getIdToken();
        const data = await requestApi("/api/support-texts", {}, token);
        if (active) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  async function generate() {
    setStatus("loading");
    setError("");
    try {
      const token = await user.getIdToken();
      const item = await requestApi("/api/support-texts", { method: "POST", body: JSON.stringify({ tema: tema.trim() }) }, token);
      setItems((prev) => [item, ...prev]);
      setOpenId(item.id);
      setStatus("idle");
    } catch (e) {
      setError(e.message || "Não foi possível gerar os textos agora.");
      setStatus("error");
    }
  }

  async function remove(id) {
    const previous = items;
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      const token = await user.getIdToken();
      await requestApi(`/api/support-texts/${id}`, { method: "DELETE" }, token);
    } catch {
      setItems(previous);
    }
  }

  return (
    <div className="support-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="library" size={14} /> Coletânea de apoio</span><h1>Textos de apoio.</h1><p>Informe um tema e receba de 3 a 4 textos motivadores (notícia, dados, texto literário, legislação) para entender o assunto antes de escrever.</p></div></section>

      <section className="card support-form">
        <label className="field plain"><span>Tema</span><input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Escreva seu tema ou peça uma sugestão" /></label>
        <ThemeSuggester user={user} onPick={setTema} />
        <div className="support-actions">
          <button className="btn btn-primary" onClick={generate} disabled={status === "loading" || tema.trim().length < 8}>{status === "loading" ? <><span className="spinner" /> Gerando textos...</> : <><Icon name="spark" size={17} /> Gerar textos de apoio</>}</button>
          {tema.trim().length >= 8 && <button className="btn btn-ghost" onClick={() => onNavigate("correct", tema.trim())}><Icon name="pen" size={16} /> Escrever sobre este tema</button>}
        </div>
        {status === "error" && <div className="alert error">{error}</div>}
        <p className="support-note">Os textos são gerados por IA para treino e podem conter dados ilustrativos. Não os cite como fontes reais na prova.</p>
      </section>

      <div className="section-head plan-section-title"><div><span className="eyebrow">Salvos automaticamente</span><h2>Meus textos de apoio</h2></div></div>
      {loadingList ? <div className="card empty-state compact"><span className="spinner small" /></div> : !items.length ? (
        <div className="card empty-state compact"><div className="empty-icon"><Icon name="library" size={22} /></div><h3>Nenhuma coletânea ainda.</h3><p>Gere sua primeira coletânea acima. Ela ficará guardada aqui.</p></div>
      ) : (
        <div className="support-list">
          {items.map((item) => {
            const open = openId === item.id;
            return (
              <article key={item.id} className="card support-item">
                <div className="support-item-head">
                  <button className="support-toggle" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open}>
                    <div><b>{item.tema}</b><small>{formatDate(item.createdAt)} · {item.textos.length} textos</small></div>
                    <Icon name="chevron" size={18} className={open ? "rot" : ""} />
                  </button>
                  <button className="icon-btn" onClick={() => remove(item.id)} aria-label="Excluir coletânea" title="Excluir"><Icon name="trash" size={18} /></button>
                </div>
                {open && (
                  <div className="support-body">
                    {item.textos.map((t, i) => (
                      <section key={i} className="support-text">
                        <span className="tag info">{TIPO_APOIO[t.tipo] || "Texto de apoio"} · Texto {i + 1}</span>
                        <h3>{t.titulo}</h3>
                        <p>{t.conteudo}</p>
                        <small>{t.fonte}</small>
                      </section>
                    ))}
                    <button className="btn btn-secondary" onClick={() => onNavigate("correct", item.tema)}><Icon name="pen" size={16} /> Escrever redação sobre este tema</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}


const SUPPORT_EMAIL = "suporte.reviso@gmail.com";
const WHATSAPP_DISPLAY = "(19) 92015-3237";
const WHATSAPP_LINK = "https://wa.me/5519920153237?text=" + encodeURIComponent("Olá! Preciso de ajuda com o Revisô AI.");
const BUG_SCREENS = ["Início", "Corrigir redação", "Histórico", "Plano de aulas", "Textos de apoio", "Perfil", "Login/cadastro", "Outra"];

function mailtoBug({ titulo, tela, descricao, email }) {
  const body = `Tela: ${tela}\nUsuário: ${email || "não informado"}\nDispositivo: ${navigator.userAgent}\n\n${descricao}`.slice(0, 1500);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[Bug] ${titulo || "Relato de problema"}`)}&body=${encodeURIComponent(body)}`;
}

function Settings({ user }) {
  const [theme] = useTheme();
  const [form, setForm] = useState({ tela: BUG_SCREENS[0], titulo: "", descricao: "" });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.titulo.trim().length >= 5 && form.descricao.trim().length >= 20;
  const mailto = mailtoBug({ ...form, email: user.email });

  async function sendBug(e) {
    e.preventDefault();
    if (!valid) return;
    setStatus("loading");
    setMessage("");
    try {
      const token = await user.getIdToken();
      await requestApi("/api/support/bug", { method: "POST", body: JSON.stringify({ ...form, dispositivo: navigator.userAgent }) }, token);
      setStatus("success");
      setMessage("Relato enviado para a equipe. Obrigado por ajudar a melhorar o Revisô!");
      setForm((f) => ({ ...f, titulo: "", descricao: "" }));
    } catch (error) {
      if (error.status === 501 || !error.status) {
        // Servidor sem SMTP (ou fora do ar): abre o e-mail do aluno já preenchido.
        window.location.href = mailto;
        setStatus("info");
        setMessage("Abrimos seu aplicativo de e-mail com o relato pronto. É só enviar.");
      } else {
        setStatus("error");
        setMessage(error.message);
      }
    }
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(WHATSAPP_DISPLAY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* área de transferência indisponível */ }
  }

  return (
    <div className="settings-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="settings" size={14} /> Preferências</span><h1>Configurações.</h1><p>Ajuste a aparência do Revisô e fale com a nossa equipe quando precisar.</p></div></section>

      <section className="card settings-section">
        <header><span className="eyebrow">Modo de tela</span><h2>Tema</h2><p>Escolha entre o modo claro e o modo escuro. A preferência fica salva neste dispositivo.</p></header>
        <div className="theme-options-row">
          {[["light", "Modo claro", "sun"], ["dark", "Modo escuro", "moon"]].map(([id, label, icon]) => (
            <button key={id} type="button" className={`theme-card ${id}`} aria-pressed={theme === id} onClick={() => setTheme(id)}>
              <div className="preview" aria-hidden="true"><i /><div><i /><i /></div></div>
              <span className="label"><Icon name={icon} size={18} /> {label}{theme === id && <small>Ativo</small>}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-section">
        <header><span className="eyebrow">Suporte</span><h2>Precisa de ajuda?</h2><p>Relate um problema ou fale com a gente pelo WhatsApp.</p></header>
        <div className="settings-grid">
          <div className="support-box">
            <h3><Icon name="chat" size={18} /> Central de ajuda</h3>
            <p>Atendimento pelo WhatsApp:</p>
            <span className="wa-number">{WHATSAPP_DISPLAY}</span>
            <div className="bug-actions">
              <a className="btn btn-whatsapp" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} /> Abrir WhatsApp</a>
              <button type="button" className="btn btn-secondary" onClick={copyNumber}><Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copiado" : "Copiar número"}</button>
            </div>
            <div className="faq">
              <details><summary>Como favorito uma redação?</summary><p>No Histórico, toque na estrela da redação. Ela passa a aparecer em Meus Destaques, no seu perfil.</p></details>
              <details><summary>Como gero o plano de aulas?</summary><p>Em Plano de aulas, escolha a redação e toque em Gerar plano. Ele fica salvo para você rever depois.</p></details>
              <details><summary>Posso escrever meu próprio tema?</summary><p>Sim. Em Corrigir redação, digite o tema que quiser. A sugestão por IA é opcional.</p></details>
              <details><summary>Os textos de apoio são fontes reais?</summary><p>Não. Eles são gerados por IA para treino e podem ter dados ilustrativos. Não cite como fonte na prova.</p></details>
            </div>
          </div>

          <form className="support-box" onSubmit={sendBug}>
            <h3><Icon name="bug" size={18} /> Relatar um bug</h3>
            <p>O relato é enviado por e-mail para {SUPPORT_EMAIL}.</p>
            <label className="field plain"><span>Onde aconteceu?</span><select value={form.tela} onChange={set("tela")}>{BUG_SCREENS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field plain"><span>Título</span><input value={form.titulo} onChange={set("titulo")} maxLength={120} placeholder="Ex.: A nota não aparece no histórico" /></label>
            <label className="field plain"><span>O que aconteceu?</span><textarea value={form.descricao} onChange={set("descricao")} maxLength={3000} placeholder="Descreva o que você fez, o que esperava e o que aconteceu (mínimo 20 caracteres)." /></label>
            <div className="bug-actions">
              <button className="btn btn-primary" disabled={!valid || status === "loading"}>{status === "loading" ? <><span className="spinner" /> Enviando...</> : <><Icon name="mail" size={16} /> Enviar relato</>}</button>
              <a className="text-btn" href={mailto}>Abrir no meu e-mail</a>
            </div>
            {message && <div className={`alert ${status === "success" ? "success" : status === "error" ? "error" : "info-note"}`} role="status">{message}</div>}
          </form>
        </div>
      </section>
    </div>
  );
}

export default App;
