# Revisô AI

Aplicação web profissional para correção e evolução de redações ENEM.

## Arquitetura

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **IA:** Gemini exclusivamente no backend
- **Autenticação:** Firebase Authentication
- **Persistência:** Firestore, separada por usuário
- **UI:** design system responsivo, acessível e sem dependência de Streamlit

A camada de apresentação é 100% React. O fluxo é **React → API Express → Gemini/Firestore**; não existe mais uma entrada de execução baseada em Streamlit.

## Telas

- Landing page pública → login
- Login com e-mail/senha
- Cadastro
- Recuperação de senha
- Dashboard / início
- Correção de redação
- Resultado da correção
- Histórico com busca e detalhes
- Plano de aulas adaptativo
- Perfil
- Sidebar responsiva para desktop e mobile

## Configuração

### 1. Firebase

No Firebase Console:

1. Crie/abra seu projeto.
2. Ative **Authentication → Email/Password** e **Google**.
3. Crie o Firestore.
4. Em Configurações do projeto → Seus apps → Web, copie as configurações para `.env`.
5. Em Contas de serviço, gere uma chave para o backend. Nunca publique esse arquivo nem a chave privada.

Copie:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Preencha os dois arquivos.

### 2. Gemini

Coloque `GEMINI_API_KEY` somente em `backend/.env`.

Nunca use `VITE_GEMINI_API_KEY` ou qualquer chave Gemini no frontend.

### 3. Executar

Terminal 1:

```bash
npm install
npm run server
```

Terminal 2:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

### 4. Build

```bash
npm run build
npm run preview
```

## Segurança

A API exige um Firebase ID token em todas as rotas de histórico/correção. As redações são salvas em:

```text
usuarios/{uid}/redacoes/{redacaoId}
```

Isso evita que o histórico de um usuário apareça para outro.

A chave Gemini permanece no servidor.

## Produção

Configure:

- `NODE_ENV=production`
- `GEMINI_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FRONTEND_ORIGIN`
- `VITE_API_URL` no build, se frontend e backend forem hospedados separadamente

Antes de abrir a plataforma publicamente, adicione rate limiting, logs estruturados sem texto de redação, monitoramento e política de retenção de dados.
