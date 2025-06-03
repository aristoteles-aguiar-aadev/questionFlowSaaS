# 🚀 QuestionFlow SaaS - Guia de Instalação Completo

## 📋 Visão Geral

O QuestionFlow é um SaaS completo para criação e gerenciamento de pesquisas, construído com:
- **Backend**: Node.js + Express
- **Banco de Dados**: Supabase (PostgreSQL)
- **Frontend**: HTML5 + JavaScript + SurveyJS
- **Gráficos**: Chart.js
- **Autenticação**: JWT com refresh tokens
- **PDF Export**: Puppeteer
- **Segurança**: Helmet, Rate Limiting, Validações

## 🛠️ Pré-requisitos

- Node.js 18+ 
- NPM ou Yarn
- Conta no Supabase (gratuita)
- Git

## 📦 Instalação

### 1. Clone o Repositório
```bash
git clone https://github.com/aristoteles-aguiar-aadev/questionFlowSaaS.git
cd questionflowsaas
```

### 2. Instale as Dependências
```bash
npm install
```

### 3. Configuração do Supabase

#### 3.1 Criar Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie uma conta gratuita
3. Crie um novo projeto
4. Anote a URL e as chaves do projeto

#### 3.2 Configurar Banco de Dados
1. No painel do Supabase, vá em "SQL Editor"
2. Execute o seguinte SQL para criar as tabelas:

```sql
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tabela de pesquisas
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    survey_json JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de respostas
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    response_data JSONB NOT NULL,
    respondent_info JSONB DEFAULT '{}',
    ip_address INET,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON survey_responses(submitted_at);

-- RLS (Row Level Security) - Desabilitar para usar service key
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses DISABLE ROW LEVEL SECURITY;
```

### 4. Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Supabase Configuration
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua_service_key_aqui

# JWT Configuration
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_com_pelo_menos_32_caracteres
JWT_REFRESH_SECRET=seu_refresh_secret_tambem_super_seguro_aqui

# Server Configuration
PORT=3000
NODE_ENV=development
```

**⚠️ Importante**: 
- Use chaves JWT seguras (32+ caracteres)
- No Supabase, use a **Service Role Key**, não a **Anon Key**

### 5. Estrutura de Pastas

Organize os arquivos conforme a estrutura:

```
questionflow-saas/
├── server.js                 # Servidor principal
├── package.json             # Dependências
├── .env                     # Variáveis de ambiente
├── config/
│   └── supabase.js         # Configuração do Supabase
├── middleware/
│   ├── auth.js             # Middleware de autenticação
│   └── rateLimiter.js      # Rate limiting
├── routes/
│   ├── auth.js             # Rotas de autenticação
│   ├── surveys.js          # Rotas de pesquisas
│   └── analytics.js        # Rotas de analytics
├── public/
│   └── index.html          # Frontend completo
└── setup.js                # Script de configuração
```

### 6. Execução

#### Desenvolvimento
```bash
npm run dev
```

#### Produção
```bash
npm start
```

Acesse: `http://localhost:3000`

## 🔧 Configurações Avançadas

### Configuração de Produção

#### 1. Variáveis de Ambiente de Produção
```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua_service_key
JWT_SECRET=chave_super_segura_para_producao
JWT_REFRESH_SECRET=refresh_key_super_segura
```

#### 2. Proxy Reverso (Nginx)
```nginx
server {
    listen 80;
    server_name seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. PM2 (Process Manager)
```bash
# Instalar PM2
npm install -g pm2

# Criar arquivo ecosystem.config.js
module.exports = {
  apps: [{
    name: 'questionflow-saas',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};

# Iniciar aplicação
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🔐 Segurança

### 1. Configurações de Segurança Implementadas
- ✅ Helmet.js para headers de segurança
- ✅ Rate limiting por IP
- ✅ Validação de entrada com Joi
- ✅ Hash de senhas com bcrypt
- ✅ JWT com refresh tokens
- ✅ CORS configurado
- ✅ Sanitização de dados

### 2. Recomendações Adicionais
```bash
# SSL Certificate (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com

# Firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 📊 Funcionalidades Implementadas

### ✅ Autenticação e Autorização
- Registro de usuários com validação
- Login com JWT + Refresh Token
- Middleware de autenticação
- Rate limiting de requests

### ✅ Gerenciamento de Pesquisas
- CRUD completo de pesquisas
- Editor visual com SurveyJS
- Preview de pesquisas
- Múltiplos tipos de perguntas
- Status de pesquisas (draft, active, paused, completed)

### ✅ Coleta de Respostas
- Endpoint público para submissão
- Armazenamento de metadados
- Controle de IP e timestamp

### ✅ Analytics e Relatórios
- Dashboard com estatísticas
- Gráficos interativos com Chart.js
- Analytics por pesquisa individual
- Processamento de diferentes tipos de perguntas
- Export para PDF com Puppeteer

### ✅ Interface de Usuário
- Design responsivo e moderno
- Dark mode ready
- Sidebar navigation
- Modais e componentes interativos
- Feedback visual (alerts, loading states)

## 🚀 Deploy

### Heroku
```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Criar app
heroku create questionflow-saas

# Configurar variáveis
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=sua_url
heroku config:set SUPABASE_SERVICE_KEY=sua_key
heroku config:set JWT_SECRET=seu_secret
heroku config:set JWT_REFRESH_SECRET=seu_refresh_secret

# Deploy
git push heroku main
```

### Vercel
```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configurar variáveis no painel da Vercel
```

### DigitalOcean/AWS/Google Cloud
1. Criar droplet/instância
2. Instalar Node.js e PM2
3. Configurar Nginx
4. Configurar SSL
5. Deploy com PM2

## 🧪 Testes

### Teste Manual das Funcionalidades

#### 1. Autenticação
```bash
# Registro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@email.com","password":"MinhaSenh@123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@email.com","password":"MinhaSenh@123"}'
```

#### 2. Pesquisas
```bash
# Criar pesquisa (use o token retornado no login)
curl -X POST http://localhost:3000/api/surveys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"title":"Teste","description":"Descrição","survey_json":{"title":"Teste","pages":[{"elements":[{"type":"text","name":"q1","title":"Pergunta?"}]}]}}'
```

## 🐛 Solução de Problemas

### Problemas Comuns

#### 1. Erro de Conexão com Supabase
```
Solução: Verificar se as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY estão corretas
```

#### 2. Erro de JWT Invalid
```
Solução: Verificar se JWT_SECRET tem pelo menos 32 caracteres
```

#### 3. Erro 403 no Supabase
```
Solução: Usar Service Role Key ao invés de Anon Key
```

#### 4. Erro de CORS
```
Solução: Configurar origem correta no CORS (server.js linha 32)
```

#### 5. Puppeteer não funciona
```bash
# Ubuntu/Debian
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

## 📚 Próximos Passos

### Melhorias Sugeridas
1. **Testes Automatizados**
   - Jest para backend
   - Cypress para frontend

2. **Notificações**
   - Email notifications
   - WebSocket para real-time

3. **Integrações**
   - Slack/Discord webhooks
   - Zapier integration
   - API pública

4. **Analytics Avançados**
   - Machine Learning insights
   - Sentiment analysis
   - Export para Excel/CSV

5. **UI/UX**
   - Drag & drop survey builder
   - Template gallery
   - White-label options

## 🆘 Suporte

- **Documentação**: Este README
- **Issues**: GitHub Issues
- **Email**: suporte@questionflow.com
- **Discord**: [Link do servidor]

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

---

**🎉 Parabéns! Seu SaaS de pesquisas está pronto para uso!**

Para demonstrações e apresentações, o sistema já vem com dados de exemplo e todas as funcionalidades implementadas. Basta seguir este guia de instalação e você terá uma plataforma profissional funcionando em minutos!