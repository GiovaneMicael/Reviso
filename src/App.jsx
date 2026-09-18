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
import Icon from "./components/Icon";
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

function formatDate(value) {
  if (!value) return "Data não disponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não disponível";
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
    date: item.date || item.createdAt || item.created_at || new Date().toISOString(),
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
  const [selectedEssay, setSelectedEssay] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        setPage={(next) => { setPage(next); setSidebarOpen(false); }}
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
          onProfile={() => setPage("profile")}
        />
        <div className="page-container">
          {page === "home" && <Dashboard user={user} essays={essays} setPage={setPage} />}
          {page === "correct" && <Correction user={user} onSave={saveEssay} />}
          {page === "history" && (
            <History essays={essays} onView={(e) => setSelectedEssay(e)} setPage={setPage} />
          )}
          {page === "lessons" && <LessonPlan essays={essays} setPage={setPage} />}
          {page === "profile" && <Profile user={user} essays={essays} />}
        </div>
      </main>
      {selectedEssay && <EssayModal essay={selectedEssay} onClose={() => setSelectedEssay(null)} />}
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
              <Icon name={id === "correct" ? "pen" : id} size={19} /> <span>{label}</span>
            </button>
          ))}
          <span className="nav-label account">Conta</span>
          <button className={page === "profile" ? "active" : ""} onClick={() => setPage("profile")}><Icon name="user" size={19} /><span>Meu perfil</span></button>
        </nav>
        <div className="sidebar-bottom">
          <button className="profile-mini" onClick={() => setPage("profile")}>
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
  const titles = { home: "Visão geral", correct: "Corrigir redação", history: "Histórico", lessons: "Plano de aulas", profile: "Meu perfil" };
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
  return <div className="recent-essay"><div className="recent-score"><strong>{essay.notaTotal}</strong><span>/ 1000</span></div><div className="recent-info"><span className={`tag ${meta.tone}`}>{meta.label}</span><h3>{essay.tema || "Sem tema"}</h3><p>{formatDate(essay.date)}</p></div><Icon name="chevron" size={20} /></div>;
}

function FocusInsight({ essay, setPage }) {
  const weak = [...(essay.competencias || [])].sort((a, b) => a.nota - b.nota)[0];
  if (!weak) return null;
  return <div className="focus-content"><div className="focus-number">C{weak.n}</div><div><span className="tag warning">Maior oportunidade</span><h3>{weak.nome}</h3><p>{weak.comentario || "Revise esta competência na próxima sessão."}</p><button className="text-btn" onClick={() => setPage("lessons")}>Abrir plano de aulas <Icon name="arrow" size={15} /></button></div></div>;
}

function EmptyState({ setPage }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="pen" size={25} /></div><h3>Seu histórico começa com uma redação.</h3><p>Envie um texto e receba uma análise detalhada das cinco competências.</p><button className="btn btn-primary" onClick={() => setPage("correct")}>Corrigir primeira redação</button></div>;
}

function Correction({ user, onSave }) {
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const words = texto.trim().split(/\s+/).filter(Boolean).length;

  async function submit() {
    if (words < 30) return;
    setStatus("loading");
    try {
      const token = await user.getIdToken();
      const essay = await requestApi("/api/correct", { method: "POST", body: JSON.stringify({ tema, texto }) }, token);
      const normalized = normalizeEssay(essay);
      setResult(normalized);
      await onSave(normalized);
      setStatus("done");
    } catch (error) {
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
          <div className="editor-head"><div><span className="step-badge">01</span><div><b>Contexto</b><small>Ajude a IA a entender sua proposta.</small></div></div></div>
          <label className="field plain"><span>Tema da redação <small>opcional</small></span><input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Digite o tema proposto" /></label>
          <label className="field plain"><span>Sua redação</span><textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comece a escrever ou cole sua redação aqui..." /></label>
          <div className="editor-footer"><span className={words < 30 ? "word-count warning-text" : "word-count"}>{words} palavras {words < 30 && "· mínimo 30"}</span><button className="btn btn-primary" onClick={submit} disabled={status === "loading" || words < 30}>{status === "loading" ? <><span className="spinner" /> Analisando...</> : <><Icon name="spark" size={17} /> Analisar com IA</>}</button></div>
          {status === "error" && <div className="alert error">Não foi possível analisar agora. Verifique se a API está ativa e se o Firebase Admin/Gemini estão configurados.</div>}
        </section>
        <aside className="card editor-aside">
          <div className="aside-icon"><Icon name="shield" /></div><h3>Seu texto, seu diagnóstico.</h3><p>A análise considera cada competência separadamente e transforma as lacunas encontradas em próximos passos de estudo.</p>
          <div className="aside-list">{["C1 · Norma-padrão", "C2 · Tema e repertório", "C3 · Argumentação", "C4 · Coesão", "C5 · Intervenção"].map((x) => <span key={x}><Icon name="check" size={14} /> {x}</span>)}</div>
        </aside>
      </div>
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

function History({ essays, onView, setPage }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => essays.filter((e) => (e.tema || "").toLowerCase().includes(query.toLowerCase())), [essays, query]);

  return (
    <div className="history-page page-enter">
      <section className="page-heading split"><div><span className="eyebrow"><Icon name="history" size={14} /> Sua trajetória</span><h1>Histórico de redações.</h1><p>Veja o que você já escreveu e como sua performance está mudando.</p></div><div className="history-summary"><b>{essays.length}</b><span>correções</span></div></section>
      <div className="search-row"><div className="search-field"><Icon name="history" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por tema..." /></div><button className="btn btn-primary" onClick={() => setPage("correct")}><Icon name="plus" size={17} /> Nova correção</button></div>
      {!filtered.length ? <div className="card empty-state"><div className="empty-icon"><Icon name="history" size={24} /></div><h3>{essays.length ? "Nenhuma redação encontrada." : "Você ainda não tem correções."}</h3><p>{essays.length ? "Tente outro termo de busca." : "Sua primeira análise ficará registrada aqui."}</p>{!essays.length && <button className="btn btn-primary" onClick={() => setPage("correct")}>Começar agora</button>}</div> : <div className="history-list">{filtered.map((essay) => <HistoryRow key={essay.id} essay={essay} onClick={() => onView(essay)} />)}</div>}
    </div>
  );
}

function HistoryRow({ essay, onClick }) {
  const meta = scoreMeta(Number(essay.notaTotal));
  return <button className="history-row" onClick={onClick}><div className="history-score"><strong>{essay.notaTotal}</strong><span>/1000</span></div><div className="history-main"><span className={`tag ${meta.tone}`}>{meta.label}</span><h3>{essay.tema || "Sem tema"}</h3><p>{formatDate(essay.date)} · {essay.competencias.length} competências avaliadas</p></div><div className="history-comps">{essay.competencias.map((c) => <span key={c.n}>C{c.n} <b>{c.nota}</b></span>)}</div><Icon name="chevron" size={19} /></button>;
}

function LessonPlan({ essays, setPage }) {
  const latest = essays[0];
  const weakest = useMemo(() => {
    if (!latest?.competencias?.length) return [];
    return [...latest.competencias].sort((a, b) => a.nota - b.nota).slice(0, 3);
  }, [latest]);

  const lessons = weakest.map((c, i) => ({
    comp: c,
    number: i + 1,
    title: ["Base e precisão", "Construção de argumento", "Intervenção completa", "Conexão entre ideias"][i] || "Prática direcionada",
    objective: c.nota < 120 ? "Reconstruir os fundamentos desta competência." : "Refinar a técnica para buscar uma faixa superior.",
    activity: ["Faça 10 exercícios focados nos desvios mais frequentes e reescreva um parágrafo.", "Monte dois argumentos usando tese, evidência, explicação e consequência.", "Escreva três propostas e confira agente, ação, meio, efeito e detalhamento.", "Reescreva um parágrafo variando relações de causa, oposição, conclusão e adição."][c.n - 1] || "Pratique com uma redação anterior.",
  }));

  return (
    <div className="lessons-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="book" size={14} /> Aprendizado adaptativo</span><h1>Plano de aulas.</h1><p>Uma trilha curta construída a partir do seu desempenho mais recente.</p></div></section>
      {!latest ? (
        <div className="card lesson-empty"><div className="empty-icon"><Icon name="book" size={25} /></div><h2>Seu plano ainda está em branco.</h2><p>Faça uma correção para o Revisô identificar quais competências merecem mais atenção.</p><button className="btn btn-primary" onClick={() => setPage("correct")}>Fazer primeira correção <Icon name="arrow" size={16} /></button></div>
      ) : (
        <>
          <div className="plan-banner card"><div className="plan-banner-icon"><Icon name="spark" /></div><div><span className="eyebrow">Plano atualizado</span><h2>Seu foco desta semana</h2><p>Priorize as três competências com menor desempenho na sua última correção.</p></div></div>
          <div className="lesson-list">{lessons.map((lesson) => <LessonCard key={lesson.comp.n} lesson={lesson} />)}</div>
        </>
      )}
    </div>
  );
}

function LessonCard({ lesson }) {
  return <article className="lesson-card card"><div className="lesson-number">0{lesson.number}</div><div className="lesson-body"><div className="lesson-top"><span className="tag info">C{lesson.comp.n} · {lesson.comp.nota}/200</span><span className="lesson-duration">≈ 25 min</span></div><h2>{lesson.title}</h2><p className="lesson-objective"><b>Objetivo:</b> {lesson.objective}</p><div className="lesson-task"><span>Prática</span><p>{lesson.activity}</p></div></div><Icon name="chevron" size={21} /></article>;
}

function Profile({ user, essays }) {
  const avg = averageScore(essays);
  const [name, setName] = useState(user.displayName || "");
  const [saved, setSaved] = useState(false);
  async function save() {
    if (!auth || !name.trim()) return;
    await updateProfile(user, { displayName: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }
  return (
    <div className="profile-page page-enter">
      <section className="page-heading"><div><span className="eyebrow"><Icon name="user" size={14} /> Conta</span><h1>Meu perfil.</h1><p>Gerencie seus dados e veja um resumo da sua jornada no Revisô.</p></div></section>
      <div className="profile-grid">
        <section className="card profile-main"><div className="profile-hero"><div className="avatar huge">{initials(user)}</div><div><h2>{user.displayName || "Aluno Revisô"}</h2><p>{user.email}</p><span className="tag positive">Conta verificada</span></div></div><div className="divider" /><div className="profile-form"><label className="field plain"><span>Nome de exibição</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="field plain"><span>E-mail</span><input value={user.email || ""} disabled /></label><button className="btn btn-primary" onClick={save}>Salvar alterações</button>{saved && <span className="save-ok"><Icon name="check" size={15} /> Perfil atualizado.</span>}</div></section>
        <aside className="card profile-stats"><span className="eyebrow">Sua jornada</span><div className="profile-stat"><b>{essays.length}</b><span>Redações analisadas</span></div><div className="profile-stat"><b>{avg || "—"}</b><span>Média geral</span></div><div className="profile-stat"><b>{essays.length ? Math.max(...essays.map((e) => Number(e.notaTotal || 0))) : "—"}</b><span>Melhor nota</span></div></aside>
      </div>
    </div>
  );
}

function EssayModal({ essay, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><article className="modal"><div className="modal-head"><div><span className="eyebrow">Detalhes da correção</span><h2>{essay.tema || "Sem tema"}</h2><p>{formatDate(essay.date)}</p></div><button className="icon-btn" onClick={onClose}><Icon name="close" /></button></div><div className="modal-score"><strong>{essay.notaTotal}</strong><span>/ 1000</span></div><div className="modal-comps">{essay.competencias.map((c) => <CompetenceRow key={c.n} comp={c} />)}</div><div className="diagnosis-card compact"><span className="eyebrow">Diagnóstico</span><p>{essay.geral}</p></div></article></div>;
}

export default App;