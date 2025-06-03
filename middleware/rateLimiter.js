// middleware/rateLimiter.js
const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');

// Configurações baseadas no ambiente
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Rate limiter geral para todas as requisições
const generalLimiter = new RateLimiterMemory({
  keyPrefix: 'general',
  points: isDevelopment ? 1000 : 100, // Mais liberal em desenvolvimento
  duration: 60, // por 60 segundos
  blockDuration: 60, // bloquear por 60 segundos
});

// Rate limiter mais restritivo para autenticação
const authLimiter = new RateLimiterMemory({
  keyPrefix: 'auth',
  points: isDevelopment ? 20 : 5, // Máximo 5 tentativas em produção
  duration: 900, // por 15 minutos
  blockDuration: 900, // bloquear por 15 minutos
});

// Rate limiter para criação de pesquisas (evitar spam)
const surveyCreationLimiter = new RateLimiterMemory({
  keyPrefix: 'survey_creation',
  points: isDevelopment ? 50 : 10, // Máximo 10 pesquisas por hora
  duration: 3600, // por 1 hora
  blockDuration: 3600, // bloquear por 1 hora
});

// Rate limiter para submissão de respostas
const responseSubmissionLimiter = new RateLimiterMemory({
  keyPrefix: 'response_submission',
  points: isDevelopment ? 100 : 30, // Máximo 30 respostas por hora por IP
  duration: 3600, // por 1 hora
  blockDuration: 1800, // bloquear por 30 minutos
});

// Rate limiter para export de PDF (recurso custoso)
const pdfExportLimiter = new RateLimiterMemory({
  keyPrefix: 'pdf_export',
  points: isDevelopment ? 20 : 3, // Máximo 3 PDFs por hora
  duration: 3600, // por 1 hora
  blockDuration: 3600, // bloquear por 1 hora
});

/**
 * Middleware de rate limiting geral
 */
const rateLimiterMiddleware = async (req, res, next) => {
  try {
    // Obter IP real (considerando proxies)
    const clientIP = getClientIP(req);
    
    // Aplicar rate limiting
    await generalLimiter.consume(clientIP);
    
    // Adicionar headers informativos
    const resRateLimiter = await generalLimiter.get(clientIP);
    if (resRateLimiter) {
      res.set({
        'X-RateLimit-Limit': 100,
        'X-RateLimit-Remaining': resRateLimiter.remainingPoints || 0,
        'X-RateLimit-Reset': new Date(Date.now() + resRateLimiter.msBeforeNext)
      });
    }
    
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Muitas requisições. Tente novamente em alguns segundos.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: secs,
      limit: 100
    });
  }
};

/**
 * Rate limiter específico para rotas de autenticação
 */
const authRateLimiter = async (req, res, next) => {
  try {
    const clientIP = getClientIP(req);
    await authLimiter.consume(clientIP);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    // Log de tentativas de ataque
    console.warn(`🚨 Possível ataque de força bruta detectado - IP: ${getClientIP(req)} - Endpoint: ${req.path}`);
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: secs
    });
  }
};

/**
 * Rate limiter para criação de pesquisas
 */
const surveyCreationRateLimiter = async (req, res, next) => {
  try {
    // Usar ID do usuário se autenticado, senão IP
    const key = req.user ? `user_${req.user.id}` : getClientIP(req);
    await surveyCreationLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Limite de criação de pesquisas excedido. Tente novamente em 1 hora.',
      code: 'SURVEY_CREATION_LIMIT_EXCEEDED',
      retryAfter: secs,
      limit: isProduction ? 10 : 50
    });
  }
};

/**
 * Rate limiter para submissão de respostas
 */
const responseSubmissionRateLimiter = async (req, res, next) => {
  try {
    const clientIP = getClientIP(req);
    await responseSubmissionLimiter.consume(clientIP);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Limite de submissões excedido. Tente novamente em 30 minutos.',
      code: 'RESPONSE_SUBMISSION_LIMIT_EXCEEDED',
      retryAfter: secs,
      limit: isProduction ? 30 : 100
    });
  }
};

/**
 * Rate limiter para export de PDF
 */
const pdfExportRateLimiter = async (req, res, next) => {
  try {
    // Usar ID do usuário para rate limiting de PDF
    const key = req.user ? `user_${req.user.id}` : getClientIP(req);
    await pdfExportLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Limite de export PDF excedido. Tente novamente em 1 hora.',
      code: 'PDF_EXPORT_LIMIT_EXCEEDED',
      retryAfter: secs,
      limit: isProduction ? 3 : 20
    });
  }
};

/**
 * Rate limiter flexível que pode ser configurado dinamicamente
 */
const createCustomRateLimiter = (options = {}) => {
  const {
    points = 60,
    duration = 60,
    blockDuration = 60,
    keyPrefix = 'custom',
    useUserKey = false
  } = options;

  const limiter = new RateLimiterMemory({
    keyPrefix,
    points,
    duration,
    blockDuration
  });

  return async (req, res, next) => {
    try {
      const key = useUserKey && req.user ? `user_${req.user.id}` : getClientIP(req);
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Limite de requisições excedido.',
        code: 'CUSTOM_RATE_LIMIT_EXCEEDED',
        retryAfter: secs,
        limit: points
      });
    }
  };
};

/**
 * Obter IP real do cliente (considerando proxies, load balancers, etc)
 */
function getClientIP(req) {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.headers['x-client-ip'] ||
    req.headers['cf-connecting-ip'] || // Cloudflare
    req.headers['x-forwarded'] ||
    '127.0.0.1'
  ).replace(/^.*:/, ''); // Remove IPv6 prefix se existir
}

/**
 * Middleware para bypass de rate limiting em desenvolvimento
 */
const developmentBypass = (req, res, next) => {
  if (isDevelopment && req.headers['x-bypass-rate-limit'] === 'true') {
    console.log('🔓 Rate limiting bypassed para desenvolvimento');
    return next();
  }
  return rateLimiterMiddleware(req, res, next);
};

/**
 * Middleware para logging de rate limiting
 */
const rateLimitLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 429) {
      const clientIP = getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';
      
      console.warn(`🚨 Rate limit atingido:`, {
        ip: clientIP,
        path: req.path,
        method: req.method,
        userAgent: userAgent.substring(0, 100),
        user: req.user ? req.user.email : 'Anônimo',
        timestamp: new Date().toISOString()
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Rate limiter inteligente que ajusta limites baseado no comportamento
 */
const adaptiveRateLimiter = () => {
  const suspiciousIPs = new Map();
  const trustedIPs = new Map();
  
  return async (req, res, next) => {
    const clientIP = getClientIP(req);
    const now = Date.now();
    
    // Verificar se IP está na lista de suspeitos
    if (suspiciousIPs.has(clientIP)) {
      const suspiciousData = suspiciousIPs.get(clientIP);
      
      // Se ainda está no período de suspensão
      if (now - suspiciousData.timestamp < 3600000) { // 1 hora
        return res.status(429).json({
          error: 'IP temporariamente bloqueado devido a atividade suspeita.',
          code: 'IP_TEMPORARILY_BLOCKED',
          retryAfter: Math.ceil((3600000 - (now - suspiciousData.timestamp)) / 1000)
        });
      } else {
        // Remover da lista após 1 hora
        suspiciousIPs.delete(clientIP);
      }
    }
    
    // Aplicar rate limiting normal
    try {
      const points = trustedIPs.has(clientIP) ? 200 : 100; // IPs confiáveis têm limite maior
      
      const limiter = new RateLimiterMemory({
        keyPrefix: 'adaptive',
        points,
        duration: 60,
        blockDuration: 60
      });
      
      await limiter.consume(clientIP);
      
      // Marcar IP como confiável após uso consistente
      if (!trustedIPs.has(clientIP)) {
        trustedIPs.set(clientIP, { count: 1, timestamp: now });
      } else {
        const trusted = trustedIPs.get(clientIP);
        trusted.count++;
        
        // Após 100 requisições bem-sucedidas, considera confiável
        if (trusted.count > 100) {
          console.log(`✅ IP ${clientIP} marcado como confiável`);
        }
      }
      
      next();
    } catch (rejRes) {
      // Marcar como suspeito se ultrapassar limite muito frequentemente
      if (suspiciousIPs.has(clientIP)) {
        const suspicious = suspiciousIPs.get(clientIP);
        suspicious.violations++;
        
        if (suspicious.violations > 5) {
          console.warn(`🚨 IP ${clientIP} marcado como altamente suspeito`);
        }
      } else {
        suspiciousIPs.set(clientIP, { violations: 1, timestamp: now });
      }
      
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Limite de requisições excedido.',
        code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
        retryAfter: secs
      });
    }
  };
};

/**
 * Limpar dados antigos dos rate limiters periodicamente
 */
const cleanupRateLimiters = () => {
  setInterval(() => {
    if (isDevelopment) {
      console.log('🧹 Limpando dados antigos dos rate limiters...');
    }
    
    // Em uma implementação real com Redis, isso seria automático
    // Para MemoryStore, os dados expiram automaticamente
    
  }, 3600000); // A cada hora
};

// Iniciar cleanup apenas em produção
if (isProduction) {
  cleanupRateLimiters();
}

/**
 * Configuração de rate limiting por endpoint
 */
const endpointRateLimits = {
  // Endpoints públicos (mais restritivos)
  '/api/surveys/:id/responses': responseSubmissionRateLimiter,
  
  // Endpoints de autenticação (muito restritivos)
  '/api/auth/login': authRateLimiter,
  '/api/auth/register': authRateLimiter,
  
  // Endpoints de criação (moderadamente restritivos)
  '/api/surveys': surveyCreationRateLimiter,
  
  // Endpoints custosos (muito restritivos)
  '/api/analytics/survey/:id/export-pdf': pdfExportRateLimiter,
};

/**
 * Aplicar rate limiting específico baseado na rota
 */
const routeSpecificRateLimit = (req, res, next) => {
  const path = req.route?.path || req.path;
  const method = req.method.toLowerCase();
  
  // Verificar se há rate limiter específico para esta rota
  const rateLimiter = endpointRateLimits[path];
  
  if (rateLimiter && (method === 'post' || method === 'put' || method === 'delete')) {
    return rateLimiter(req, res, next);
  }
  
  // Usar rate limiter geral
  next();
};

/**
 * Status de rate limiting para monitoramento
 */
const getRateLimitStatus = async (req, res) => {
  const clientIP = getClientIP(req);
  
  try {
    const [general, auth, survey, response, pdf] = await Promise.all([
      generalLimiter.get(clientIP),
      authLimiter.get(clientIP),
      surveyCreationLimiter.get(req.user ? `user_${req.user.id}` : clientIP),
      responseSubmissionLimiter.get(clientIP),
      pdfExportLimiter.get(req.user ? `user_${req.user.id}` : clientIP)
    ]);
    
    res.json({
      ip: clientIP,
      limits: {
        general: {
          remaining: general?.remainingPoints || 100,
          resetTime: general ? new Date(Date.now() + general.msBeforeNext) : null
        },
        auth: {
          remaining: auth?.remainingPoints || 5,
          resetTime: auth ? new Date(Date.now() + auth.msBeforeNext) : null
        },
        surveyCreation: {
          remaining: survey?.remainingPoints || (isProduction ? 10 : 50),
          resetTime: survey ? new Date(Date.now() + survey.msBeforeNext) : null
        },
        responseSubmission: {
          remaining: response?.remainingPoints || (isProduction ? 30 : 100),
          resetTime: response ? new Date(Date.now() + response.msBeforeNext) : null
        },
        pdfExport: {
          remaining: pdf?.remainingPoints || (isProduction ? 3 : 20),
          resetTime: pdf ? new Date(Date.now() + pdf.msBeforeNext) : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter status de rate limiting' });
  }
};

module.exports = {
  rateLimiter: isDevelopment ? developmentBypass : rateLimiterMiddleware,
  authRateLimiter,
  surveyCreationRateLimiter,
  responseSubmissionRateLimiter,
  pdfExportRateLimiter,
  createCustomRateLimiter,
  routeSpecificRateLimit,
  rateLimitLogger,
  adaptiveRateLimiter,
  getRateLimitStatus,
  getClientIP
};