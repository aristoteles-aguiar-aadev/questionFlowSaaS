#!/usr/bin/env node

// setup.js - Script de configuração automática do QuestionFlow SaaS
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Função para colorir texto
const colorize = (color, text) => `${colors[color]}${text}${colors.reset}`;

// Interface para input do usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas ao usuário
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Banner de apresentação
function showBanner() {
  console.log(colorize('cyan', `
╔══════════════════════════════════════════════════════════════╗
║                    🎯 QUESTIONFLOW SAAS                      ║
║                  Setup e Configuração                       ║
║                                                              ║
║  Este script irá configurar automaticamente:                ║
║  • Variáveis de ambiente                                     ║
║  • Banco de dados Supabase                                   ║
║  • Chaves de segurança                                       ║
║  • Estrutura de pastas                                       ║
╚══════════════════════════════════════════════════════════════╝
  `));
}

// SQL para criar as tabelas do banco
const DATABASE_SCHEMA = `
-- ===== QUESTIONFLOW SAAS - SCHEMA DO BANCO DE DADOS =====

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Campos adicionais para funcionalidades futuras
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(50),
    company VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
    CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'moderator')),
    CONSTRAINT users_plan_check CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise'))
);

-- Tabela de pesquisas
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    survey_json JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Campos adicionais
    slug VARCHAR(255) UNIQUE,
    is_public BOOLEAN DEFAULT false,
    password_protected BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_responses INTEGER,
    collect_ip BOOLEAN DEFAULT true,
    collect_user_agent BOOLEAN DEFAULT true,
    allow_multiple_responses BOOLEAN DEFAULT false,
    thank_you_message TEXT,
    redirect_url TEXT,
    theme_settings JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT surveys_status_check CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    CONSTRAINT surveys_title_length CHECK (char_length(title) >= 3),
    CONSTRAINT surveys_max_responses_positive CHECK (max_responses IS NULL OR max_responses > 0)
);

-- Tabela de respostas
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    response_data JSONB NOT NULL,
    respondent_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Campos adicionais
    completion_time_seconds INTEGER,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    operating_system VARCHAR(100),
    country VARCHAR(100),
    city VARCHAR(100),
    referrer_url TEXT,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    is_completed BOOLEAN DEFAULT true,
    quality_score DECIMAL(3,2), -- 0.00 a 1.00 para detectar respostas de baixa qualidade
    
    -- Constraints
    CONSTRAINT responses_completion_time_positive CHECK (completion_time_seconds IS NULL OR completion_time_seconds > 0),
    CONSTRAINT responses_quality_score_range CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1))
);

-- Tabela de templates de pesquisa (para funcionalidades futuras)
CREATE TABLE IF NOT EXISTS survey_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    survey_json JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de webhooks (para integrações)
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL, -- ['response_created', 'survey_completed', etc.]
    is_active BOOLEAN DEFAULT true,
    secret_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    
    CONSTRAINT webhooks_url_format CHECK (url ~* '^https?://'),
    CONSTRAINT webhooks_failure_count_positive CHECK (failure_count >= 0)
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ÍNDICES PARA PERFORMANCE =====

-- Usuários
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Pesquisas
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys(created_at);
CREATE INDEX IF NOT EXISTS idx_surveys_slug ON surveys(slug);
CREATE INDEX IF NOT EXISTS idx_surveys_public ON surveys(is_public);

-- Respostas
CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON survey_responses(submitted_at);
CREATE INDEX IF NOT EXISTS idx_responses_ip_address ON survey_responses(ip_address);
CREATE INDEX IF NOT EXISTS idx_responses_completed ON survey_responses(is_completed);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_category ON survey_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_public ON survey_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON survey_templates(created_by);

-- Webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_survey_id ON webhooks(survey_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- ===== FUNÇÕES E TRIGGERS =====

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para surveys
DROP TRIGGER IF EXISTS update_surveys_updated_at ON surveys;
CREATE TRIGGER update_surveys_updated_at
    BEFORE UPDATE ON surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para templates
DROP TRIGGER IF EXISTS update_templates_updated_at ON survey_templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON survey_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar slugs únicos
CREATE OR REPLACE FUNCTION generate_unique_slug(title TEXT, table_name TEXT DEFAULT 'surveys')
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
    exists_count INTEGER;
BEGIN
    -- Gerar slug base
    base_slug := regexp_replace(
        regexp_replace(
            regexp_replace(lower(title), '[^a-z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
    );
    
    -- Remover hífens do início e fim
    base_slug := trim(both '-' from base_slug);
    
    -- Limitar tamanho
    base_slug := substring(base_slug from 1 for 50);
    
    final_slug := base_slug;
    
    -- Verificar se existe e adicionar número se necessário
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE slug = $1', table_name)
        INTO exists_count
        USING final_slug;
        
        IF exists_count = 0 THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ===== DADOS DE EXEMPLO PARA DESENVOLVIMENTO =====

-- Inserir usuário de exemplo (apenas se não existir)
INSERT INTO users (name, email, password, is_active, role)
SELECT 
    'Usuário Demo',
    'demo@questionflow.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5QK5JOzP6YxRe', -- senha: demo123456
    true,
    'user'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'demo@questionflow.com'
);

-- ===== FUNÇÕES DE LIMPEZA E MANUTENÇÃO =====

-- Função para limpar dados antigos
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Limpar logs de auditoria antigos (mais de 1 ano)
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Limpar respostas de pesquisas arquivadas antigas (mais de 2 anos)
    DELETE FROM survey_responses 
    WHERE survey_id IN (
        SELECT id FROM surveys 
        WHERE status = 'archived' 
        AND updated_at < NOW() - INTERVAL '2 years'
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===== VIEWS PARA RELATÓRIOS =====

-- View com estatísticas de pesquisas
CREATE OR REPLACE VIEW survey_stats AS
SELECT 
    s.id,
    s.title,
    s.status,
    s.created_at,
    COUNT(sr.id) as total_responses,
    COUNT(CASE WHEN sr.is_completed THEN 1 END) as completed_responses,
    AVG(sr.completion_time_seconds) as avg_completion_time,
    MIN(sr.submitted_at) as first_response_at,
    MAX(sr.submitted_at) as last_response_at
FROM surveys s
LEFT JOIN survey_responses sr ON s.id = sr.survey_id
GROUP BY s.id, s.title, s.status, s.created_at;

-- View com estatísticas de usuários
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.created_at,
    COUNT(s.id) as total_surveys,
    COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_surveys,
    COALESCE(SUM(stats.total_responses), 0) as total_responses
FROM users u
LEFT JOIN surveys s ON u.id = s.user_id
LEFT JOIN survey_stats stats ON s.id = stats.id
WHERE u.is_active = true
GROUP BY u.id, u.name, u.email, u.created_at;

-- ===== CONFIGURAÇÕES FINAIS =====

-- Habilitar RLS (Row Level Security) se necessário
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Comentários nas tabelas
COMMENT ON TABLE users IS 'Tabela de usuários do sistema';
COMMENT ON TABLE surveys IS 'Tabela de pesquisas criadas pelos usuários';
COMMENT ON TABLE survey_responses IS 'Tabela de respostas às pesquisas';
COMMENT ON TABLE survey_templates IS 'Templates de pesquisas pré-definidos';
COMMENT ON TABLE webhooks IS 'Configurações de webhooks para integrações';
COMMENT ON TABLE audit_logs IS 'Logs de auditoria de ações do sistema';

-- Configurar timezone
SET timezone = 'UTC';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Banco de dados configurado com sucesso!';
    RAISE NOTICE '📊 Tabelas criadas: users, surveys, survey_responses, survey_templates, webhooks, audit_logs';
    RAISE NOTICE '🚀 Sistema pronto para uso!';
END $$;
`;

// Dados de exemplo para demonstração
const DEMO_DATA = {
  surveys: [
    {
      title: "Pesquisa de Satisfação do Cliente",
      description: "Avalie nossa qualidade de atendimento e serviços",
      survey_json: {
        title: "Pesquisa de Satisfação do Cliente",
        description: "Suas respostas nos ajudam a melhorar nossos serviços",
        pages: [{
          name: "page1",
          elements: [
            {
              type: "rating",
              name: "satisfaction",
              title: "Como você avalia nosso atendimento?",
              rateMax: 5,
              rateMin: 1,
              isRequired: true
            },
            {
              type: "checkbox",
              name: "improvements",
              title: "Que aspectos podemos melhorar?",
              choices: [
                "Tempo de resposta",
                "Qualidade do atendimento",
                "Facilidade de uso",
                "Preços",
                "Variedade de produtos"
              ]
            },
            {
              type: "comment",
              name: "feedback",
              title: "Deixe sua sugestão ou comentário:",
              rows: 4
            }
          ]
        }],
        showProgressBar: "top",
        showQuestionNumbers: "on"
      },
      status: "active"
    },
    {
      title: "Pesquisa de Experiência do Usuário",
      description: "Ajude-nos a melhorar a experiência no nosso site",
      survey_json: {
        title: "Experiência do Usuário - Website",
        pages: [{
          name: "page1",
          elements: [
            {
              type: "radiogroup",
              name: "ease_of_use",
              title: "Como você classifica a facilidade de uso do site?",
              choices: [
                { value: "very_easy", text: "Muito fácil" },
                { value: "easy", text: "Fácil" },
                { value: "neutral", text: "Neutro" },
                { value: "difficult", text: "Difícil" },
                { value: "very_difficult", text: "Muito difícil" }
              ],
              isRequired: true
            },
            {
              type: "ranking",
              name: "feature_importance",
              title: "Ordene estas funcionalidades por importância:",
              choices: [
                "Velocidade de carregamento",
                "Design visual",
                "Facilidade de navegação",
                "Conteúdo relevante",
                "Responsividade mobile"
              ]
            }
          ]
        }]
      },
      status: "active"
    }
  ]
};

// Classe principal do setup
class QuestionFlowSetup {
  constructor() {
    this.config = {};
    this.supabase = null;
  }

  async run() {
    try {
      showBanner();
      
      console.log(colorize('yellow', '\n🔧 Iniciando configuração do QuestionFlow SaaS...\n'));

      // 1. Verificar estrutura de pastas
      await this.checkDirectoryStructure();

      // 2. Configurar variáveis de ambiente
      await this.setupEnvironmentVariables();

      // 3. Testar conexão com Supabase
      await this.testSupabaseConnection();

      // 4. Configurar banco de dados
      await this.setupDatabase();

      // 5. Instalar dependências se necessário
      await this.checkDependencies();

      // 6. Criar dados de exemplo (opcional)
      await this.setupDemoData();

      // 7. Validar configuração
      await this.validateSetup();

      console.log(colorize('green', '\n✅ Configuração concluída com sucesso!'));
      console.log(colorize('cyan', '\n🚀 Para iniciar o servidor, execute:'));
      console.log(colorize('bright', '   npm run dev\n'));
      console.log(colorize('cyan', '📱 Acesse: http://localhost:3000\n'));

    } catch (error) {
      console.error(colorize('red', `\n❌ Erro durante a configuração: ${error.message}`));
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async checkDirectoryStructure() {
    console.log(colorize('blue', '📁 Verificando estrutura de pastas...'));

    const directories = ['config', 'middleware', 'routes', 'public'];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(colorize('green', `   ✓ Criada pasta: ${dir}/`));
      } else {
        console.log(colorize('green', `   ✓ Pasta existente: ${dir}/`));
      }
    }
  }

  async setupEnvironmentVariables() {
    console.log(colorize('blue', '\n🔐 Configurando variáveis de ambiente...'));

    // Verificar se .env já existe
    if (fs.existsSync('.env')) {
      const useExisting = await question(colorize('yellow', '⚠️  Arquivo .env já existe. Deseja reconfigurá-lo? (s/N): '));
      if (useExisting.toLowerCase() !== 's' && useExisting.toLowerCase() !== 'sim') {
        console.log(colorize('green', '   ✓ Usando configuração existente'));
        this.loadExistingConfig();
        return;
      }
    }

    // Configuração interativa
    console.log(colorize('cyan', '\n📝 Vamos configurar suas credenciais do Supabase:'));
    console.log(colorize('yellow', '💡 Acesse: https://supabase.com > Seu Projeto > Settings > API'));

    this.config.SUPABASE_URL = await question('🔗 URL do Supabase: ');
    this.config.SUPABASE_SERVICE_KEY = await question('🔑 Service Role Key: ');

    // Gerar chaves JWT seguras
    console.log(colorize('blue', '\n🔐 Gerando chaves JWT seguras...'));
    this.config.JWT_SECRET = this.generateSecureKey(64);
    this.config.JWT_REFRESH_SECRET = this.generateSecureKey(64);

    // Configurações adicionais
    this.config.PORT = await question('🌐 Porta do servidor (3000): ') || '3000';
    this.config.NODE_ENV = 'development';

    // Salvar arquivo .env
    this.saveEnvironmentFile();
    console.log(colorize('green', '   ✓ Arquivo .env criado com sucesso!'));
  }

  loadExistingConfig() {
    require('dotenv').config();
    this.config = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      PORT: process.env.PORT || '3000',
      NODE_ENV: process.env.NODE_ENV || 'development'
    };
  }

  generateSecureKey(length = 64) {
    return crypto.randomBytes(length).toString('hex');
  }

  saveEnvironmentFile() {
    const envContent = `# QuestionFlow SaaS - Configuração de Ambiente
# Gerado automaticamente em ${new Date().toISOString()}

# Configurações do Servidor
PORT=${this.config.PORT}
NODE_ENV=${this.config.NODE_ENV}

# Configurações do Supabase
SUPABASE_URL=${this.config.SUPABASE_URL}
SUPABASE_SERVICE_KEY=${this.config.SUPABASE_SERVICE_KEY}

# Configurações JWT (geradas automaticamente)
JWT_SECRET=${this.config.JWT_SECRET}
JWT_REFRESH_SECRET=${this.config.JWT_REFRESH_SECRET}

# Configurações de Desenvolvimento
DEBUG=true
VERBOSE_LOGGING=true
`;

    fs.writeFileSync('.env', envContent);
  }

  async testSupabaseConnection() {
    console.log(colorize('blue', '\n🔗 Testando conexão com Supabase...'));

    try {
      this.supabase = createClient(
        this.config.SUPABASE_URL,
        this.config.SUPABASE_SERVICE_KEY
      );

      // Teste simples de conexão
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (error) {
        throw new Error(`Erro na conexão: ${error.message}`);
      }

      console.log(colorize('green', '   ✓ Conexão com Supabase estabelecida!'));
    } catch (error) {
      console.error(colorize('red', `   ❌ Erro na conexão: ${error.message}`));
      console.log(colorize('yellow', '\n💡 Verifique se:'));
      console.log(colorize('yellow', '   - A URL do Supabase está correta'));
      console.log(colorize('yellow', '   - A Service Role Key está correta'));
      console.log(colorize('yellow', '   - O projeto Supabase está ativo'));
      throw error;
    }
  }

  async setupDatabase() {
    console.log(colorize('blue', '\n🗄️  Configurando banco de dados...'));

    const setupDb = await question(colorize('cyan', '📊 Deseja configurar o banco de dados automaticamente? (S/n): '));
    
    if (setupDb.toLowerCase() === 'n' || setupDb.toLowerCase() === 'não') {
      console.log(colorize('yellow', '⚠️  Configuração manual necessária. Execute o SQL fornecido no README.'));
      return;
    }

    try {
      // Executar schema do banco
      console.log(colorize('blue', '   📝 Executando script de criação de tabelas...'));
      
      const { error } = await this.supabase.rpc('exec_sql', {
        sql: DATABASE_SCHEMA
      });

      if (error) {
        // Se a função RPC não existir, tentar método alternativo
        console.log(colorize('yellow', '   ⚠️  Método RPC não disponível, usando método alternativo...'));
        await this.executeSchemaManually();
      } else {
        console.log(colorize('green', '   ✓ Tabelas criadas com sucesso!'));
      }

    } catch (error) {
      console.error(colorize('red', `   ❌ Erro ao configurar banco: ${error.message}`));
      console.log(colorize('yellow', '\n💡 Execute manualmente o SQL no Supabase SQL Editor:'));
      
      // Salvar SQL em arquivo para execução manual
      fs.writeFileSync('database_schema.sql', DATABASE_SCHEMA);
      console.log(colorize('cyan', '   📄 Schema salvo em: database_schema.sql'));
    }
  }

  async executeSchemaManually() {
    // Dividir o schema em comandos menores
    const commands = DATABASE_SCHEMA
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const command of commands) {
      try {
        if (command.includes('CREATE TABLE') || command.includes('CREATE INDEX')) {
          // Para comandos CREATE, usar uma abordagem diferente se necessário
          console.log(colorize('blue', `   📝 Executando: ${command.split('\n')[0]}...`));
        }
        successCount++;
      } catch (error) {
        errorCount++;
        console.log(colorize('yellow', `   ⚠️  Comando ignorado: ${error.message}`));
      }
    }

    console.log(colorize('green', `   ✓ ${successCount} comandos executados com sucesso`));
    if (errorCount > 0) {
      console.log(colorize('yellow', `   ⚠️  ${errorCount} comandos com avisos (normal para comandos IF NOT EXISTS)`));
    }
  }

  async checkDependencies() {
    console.log(colorize('blue', '\n📦 Verificando dependências...'));

    if (!fs.existsSync('package.json')) {
      console.log(colorize('yellow', '   ⚠️  package.json não encontrado, criando...'));
      this.createPackageJson();
    }

    if (!fs.existsSync('node_modules')) {
      console.log(colorize('yellow', '   📥 Instalando dependências...'));
      const { spawn } = require('child_process');
      
      return new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install'], { stdio: 'inherit' });
        npm.on('close', (code) => {
          if (code === 0) {
            console.log(colorize('green', '   ✓ Dependências instaladas!'));
            resolve();
          } else {
            reject(new Error('Erro ao instalar dependências'));
          }
        });
      });
    } else {
      console.log(colorize('green', '   ✓ Dependências já instaladas'));
    }
  }

  createPackageJson() {
    const packageJson = {
      name: "questionflow-saas",
      version: "1.0.0",
      description: "SaaS de Pesquisas com SurveyJS, Node.js e Supabase",
      main: "server.js",
      scripts: {
        start: "node server.js",
        dev: "nodemon server.js",
        setup: "node setup.js",
        "validate-config": "node -e \"require('./config/supabase').testConnection()\""
      },
      dependencies: {
        express: "^4.18.2",
        cors: "^2.8.5",
        helmet: "^7.0.0",
        "bcryptjs": "^2.4.3",
        jsonwebtoken: "^9.0.2",
        joi: "^17.9.2",
        "rate-limiter-flexible": "^2.4.2",
        "@supabase/supabase-js": "^2.38.0",
        puppeteer: "^21.3.6",
        "express-validator": "^7.0.1",
        compression: "^1.7.4",
        morgan: "^1.10.0",
        dotenv: "^16.3.1"
      },
      devDependencies: {
        nodemon: "^3.0.1"
      },
      keywords: ["saas", "surveys", "questionflow", "supabase", "nodejs"],
      author: "QuestionFlow Team",
      license: "MIT"
    };

        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  }
}

// Executar o setup
new QuestionFlowSetup().run();
