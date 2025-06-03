// server.js - Servidor Principal do QuestionFlow SaaS
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

// Importar módulos personalizados
const { rateLimiter, rateLimitLogger } = require('./middleware/rateLimiter');
const { initialize: initializeSupabase } = require('./config/supabase');

// Importar rotas
const authRoutes = require('./routes/auth');
const surveyRoutes = require('./routes/surveys');
const analyticsRoutes = require('./routes/analytics');

// Configurações
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

// ===== MIDDLEWARES DE SEGURANÇA =====

// Helmet para headers de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      scriptSrc: [
        "'self'", 
        "https://cdnjs.cloudflare.com", 
        "https://cdn.jsdelivr.net",
        ...(isDevelopment ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: [
        "'self'", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com"
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Para compatibilidade com Puppeteer
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Compressão gzip
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// CORS configurado
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (isDevelopment) {
      // Em desenvolvimento, permitir qualquer origin
      return callback(null, true);
    }
    
    // Em produção, verificar origins permitidas
    const allowedOrigins = [
      process.env.ALLOWED_ORIGIN,
      'https://questionflow.com',
      'https://www.questionflow.com'
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Bypass-Rate-Limit'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ]
};

app.use(cors(corsOptions));

// ===== MIDDLEWARES DE LOGGING =====

// Morgan para logging de requests
if (isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}

// Middleware customizado para logging detalhado
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Override do res.end para capturar tempo de resposta
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Log detalhado em desenvolvimento
    if (isDevelopment && responseTime > 1000) {
      console.warn(`⚠️  Resposta lenta: ${req.method} ${req.path} - ${responseTime}ms`);
    }
    
    // Adicionar header de tempo de resposta
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    originalEnd.apply(this, args);
  };
  
  next();
});

// ===== MIDDLEWARES DE RATE LIMITING =====

// Rate limiting global
app.use(rateLimitLogger);
app.use(rateLimiter);

// ===== MIDDLEWARES DE PARSING =====

// Trust proxy (importante para obter IP real em produção)
app.set('trust proxy', isProduction ? 1 : 0);

// Body parsing com limites de segurança
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Verificar se é JSON válido
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('JSON inválido');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100
}));

// ===== MIDDLEWARES DE ASSETS ESTÁTICOS =====

// Servir arquivos estáticos com cache
app.use(express.static('public', {
  maxAge: isDevelopment ? 0 : '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache específico por tipo de arquivo
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 dia
    } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias
    }
  }
}));

// ===== MIDDLEWARE DE HEALTH CHECK =====

app.use('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require('./package.json').version || '1.0.0',
    environment: NODE_ENV,
    node_version: process.version
  });
});

// ===== ROTAS DA API =====

// Middleware para adicionar headers de API
app.use('/api', (req, res, next) => {
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Powered-By', 'QuestionFlow-SaaS');
  next();
});

// Rotas principais
app.use('/api/auth', authRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/analytics', analyticsRoutes);

// Rota de informações da API
app.get('/api', (req, res) => {
  res.json({
    name: 'QuestionFlow SaaS API',
    version: '1.0.0',
    description: 'API para criação e gerenciamento de pesquisas',
    endpoints: {
      auth: '/api/auth',
      surveys: '/api/surveys',
      analytics: '/api/analytics'
    },
    documentation: 'https://github.com/questionflow/saas/wiki',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// ===== ROTAS DO FRONTEND =====

// Rota principal - servir o frontend SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas para SPA (Single Page Application)
const spaRoutes = [
  '/dashboard',
  '/surveys',
  '/create',
  '/analytics',
  '/responses',
  '/login',
  '/register'
];

spaRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// Rota especial para submissão pública de pesquisas
app.get('/s/:surveyId', (req, res) => {
  // Servir página especial de pesquisa pública (pode ser implementado futuramente)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== MIDDLEWARE DE TRATAMENTO DE ERROS =====

// Handler para 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Handler global de erros
app.use((err, req, res, next) => {
  // Log do erro
  console.error('❌ Erro não tratado:', {
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Determinar status code
  let statusCode = err.statusCode || err.status || 500;
  let errorMessage = err.message || 'Erro interno do servidor';
  let errorCode = err.code || 'INTERNAL_ERROR';

  // Tratar tipos específicos de erro
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_DATA_FORMAT';
  }

  // Não vazar informações sensíveis em produção
  if (isProduction && statusCode === 500) {
    errorMessage = 'Erro interno do servidor';
  }

  res.status(statusCode).json({
    error: errorMessage,
    code: errorCode,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { 
      stack: err.stack,
      details: err 
    })
  });
});

// ===== TRATAMENTO DE SINAIS DE PROCESSO =====

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Recebido sinal ${signal}. Iniciando shutdown graceful...`);
  
  server.close(() => {
    console.log('✅ Servidor HTTP fechado.');
    
    // Fechar outras conexões se necessário
    // Database connections, etc.
    
    console.log('🏁 Shutdown completo.');
    process.exit(0);
  });

  // Forçar saída após 30 segundos
  setTimeout(() => {
    console.error('❌ Forçando saída - timeout de 30s excedido');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Tratar exceções não capturadas
process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  console.error('   Promise:', promise);
  // Em produção, pode querer fazer shutdown graceful
  if (isProduction) {
    process.exit(1);
  }
});

// ===== INICIALIZAÇÃO DO SERVIDOR =====

async function startServer() {
  try {
    // Inicializar Supabase
    console.log('🔄 Inicializando conexão com Supabase...');
    await initializeSupabase();
    
    // Verificar variáveis de ambiente essenciais
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variáveis de ambiente obrigatórias não encontradas: ${missingVars.join(', ')}`);
    }

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log('\n🎯 QuestionFlow SaaS');
      console.log('═'.repeat(50));
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}/api`);
      console.log(`🔧 Health: http://localhost:${PORT}/health`);
      console.log(`🏠 Ambiente: ${NODE_ENV}`);
      console.log(`⏰ Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
      console.log('═'.repeat(50));
      
      if (isDevelopment) {
        console.log('💡 Dicas de desenvolvimento:');
        console.log('   - Use Ctrl+C para parar o servidor');
        console.log('   - Acesse /health para verificar status');
        console.log('   - Logs detalhados estão habilitados');
        console.log('   - Hot reload com nodemon ativo');
        console.log('');
      }
    });

    // Configurar timeouts
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    
    // Tornar servidor disponível globalmente para shutdown
    global.server = server;
    
    return server;

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    
    if (error.message.includes('SUPABASE')) {
      console.log('\n💡 Para configurar o Supabase:');
      console.log('   1. Execute: npm run setup');
      console.log('   2. Ou configure manualmente o arquivo .env');
      console.log('   3. Consulte o README.md para mais detalhes');
    }
    
    process.exit(1);
  }
}

// ===== UTILITÁRIOS DE DESENVOLVIMENTO =====

if (isDevelopment) {
  // Endpoint para reload em desenvolvimento
  app.get('/api/dev/reload', (req, res) => {
    res.json({ message: 'Server reload solicitado' });
    setTimeout(() => process.exit(0), 1000); // Nodemon vai reiniciar
  });

  // Endpoint para limpar cache
  app.get('/api/dev/clear-cache', (req, res) => {
    // Limpar require cache (cuidado em produção!)
    Object.keys(require.cache).forEach(key => {
      if (!key.includes('node_modules')) {
        delete require.cache[key];
      }
    });
    
    res.json({ message: 'Cache limpo' });
  });

  // Middleware para logging de queries lentas (simulado)
  app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
  });
}

// ===== MÉTRICAS E MONITORAMENTO =====

// Contadores simples para monitoramento
const metrics = {
  requests: 0,
  errors: 0,
  startTime: Date.now()
};

app.use((req, res, next) => {
  metrics.requests++;
  
  // Override do res.on para capturar erros
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      metrics.errors++;
    }
  });
  
  next();
});

// Endpoint de métricas
app.get('/api/metrics', (req, res) => {
  const uptime = Date.now() - metrics.startTime;
  
  res.json({
    uptime: Math.floor(uptime / 1000),
    requests: metrics.requests,
    errors: metrics.errors,
    errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' : '0%',
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor se executado diretamente
if (require.main === module) {
  startServer();
}

module.exports = app;