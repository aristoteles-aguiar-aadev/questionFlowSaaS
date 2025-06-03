// const jwt = require('jsonwebtoken');
// const supabase = require('../config/supabase');

// const authenticateToken = async (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ error: 'Token de acesso requerido' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Verificar se o usuário ainda existe no banco
//     const { data: user, error } = await supabase
//       .from('users')
//       .select('id, email, name, is_active')
//       .eq('id', decoded.userId)
//       .single();

//     if (error || !user || !user.is_active) {
//       return res.status(403).json({ error: 'Usuário inválido ou inativo' });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     return res.status(403).json({ error: 'Token inválido' });
//   }
// };

// module.exports = { authenticateToken };



const jwt = require('jsonwebtoken');
const { queries } = require('../config/supabase');

/**
 * Middleware para autenticar requisições usando JWT
 * Verifica se o token é válido e se o usuário existe
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Token de acesso requerido',
        code: 'MISSING_TOKEN'
      });
    }

    // Verificar e decodificar o token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(403).json({ 
          error: 'Token inválido',
          code: 'INVALID_TOKEN'
        });
      } else {
        throw jwtError;
      }
    }

    // Verificar se o token contém o userId
    if (!decoded.userId) {
      return res.status(403).json({ 
        error: 'Token malformado - userId não encontrado',
        code: 'MALFORMED_TOKEN'
      });
    }

    // Buscar usuário no banco de dados
    const { data: user, error } = await queries.users.findById(decoded.userId);

    if (error || !user) {
      return res.status(403).json({ 
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar se o usuário está ativo
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Usuário inativo',
        code: 'USER_INACTIVE'
      });
    }

    // Adicionar informações do usuário ao request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };

    // Adicionar token info para debugging (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      req.tokenInfo = {
        issued: new Date(decoded.iat * 1000),
        expires: new Date(decoded.exp * 1000),
        userId: decoded.userId
      };
    }

    next();

  } catch (error) {
    console.error('❌ Erro no middleware de autenticação:', error);
    
    // Não vazar informações sensíveis em produção
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return res.status(500).json({ 
      error: 'Erro interno de autenticação',
      code: 'AUTH_ERROR',
      details: isDevelopment ? error.message : undefined
    });
  }
};

/**
 * Middleware opcional - não falha se não houver token
 * Útil para endpoints que podem funcionar com ou sem autenticação
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Sem token, continuar sem usuário
    req.user = null;
    return next();
  }

  // Se há token, tentar autenticar
  authenticateToken(req, res, next);
};

/**
 * Middleware para verificar se o usuário é admin
 * Deve ser usado após authenticateToken
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Autenticação requerida',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Por enquanto, todos os usuários são "admin" do próprio sistema
  // Em uma implementação futura, você pode adicionar um campo 'role' na tabela users
  if (req.user.email === 'admin@questionflow.com') {
    req.user.isAdmin = true;
  }

  next();
};

/**
 * Middleware para verificar ownership de recursos
 * Verifica se o usuário é dono do recurso baseado em user_id
 */
const checkOwnership = (resourceName = 'survey') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Autenticação requerida',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({ 
          error: 'ID do recurso requerido',
          code: 'MISSING_RESOURCE_ID'
        });
      }

      let resource;
      
      // Verificar ownership baseado no tipo de recurso
      switch (resourceName) {
        case 'survey':
          const { data: survey, error } = await queries.surveys.findById(resourceId, req.user.id);
          if (error || !survey) {
            return res.status(404).json({ 
              error: 'Pesquisa não encontrada ou sem permissão',
              code: 'RESOURCE_NOT_FOUND'
            });
          }
          resource = survey;
          break;
          
        default:
          return res.status(500).json({ 
            error: 'Tipo de recurso não suportado',
            code: 'UNSUPPORTED_RESOURCE'
          });
      }

      // Adicionar recurso ao request para uso posterior
      req.resource = resource;
      next();

    } catch (error) {
      console.error(`❌ Erro na verificação de ownership (${resourceName}):`, error);
      return res.status(500).json({ 
        error: 'Erro interno na verificação de permissões',
        code: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware para rate limiting específico por usuário
 * Complementa o rate limiting global
 */
const userRateLimit = (maxRequests = 100, windowMs = 60000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Sem usuário, usar rate limiting global apenas
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpar requests antigos
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId);
      userRequests.set(userId, requests.filter(time => time > windowStart));
    } else {
      userRequests.set(userId, []);
    }

    const userRequestCount = userRequests.get(userId).length;

    if (userRequestCount >= maxRequests) {
      return res.status(429).json({
        error: `Limite de ${maxRequests} requisições por minuto excedido`,
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Adicionar request atual
    userRequests.get(userId).push(now);
    next();
  };
};

/**
 * Middleware para logging de atividades do usuário
 */
const logUserActivity = (action) => {
  return (req, res, next) => {
    if (req.user && process.env.NODE_ENV === 'development') {
      console.log(`📝 Atividade do usuário: ${req.user.email} - ${action} - ${req.method} ${req.path}`);
    }
    next();
  };
};

/**
 * Middleware para validar formato de UUID
 */
const validateUUID = (paramName = 'id') => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  return (req, res, next) => {
    const uuid = req.params[paramName];
    
    if (!uuid) {
      return res.status(400).json({
        error: `Parâmetro ${paramName} é obrigatório`,
        code: 'MISSING_UUID'
      });
    }

    if (!uuidRegex.test(uuid)) {
      return res.status(400).json({
        error: `Formato inválido para ${paramName}`,
        code: 'INVALID_UUID_FORMAT'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  checkOwnership,
  userRateLimit,
  logUserActivity,
  validateUUID
};