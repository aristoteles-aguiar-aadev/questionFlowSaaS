// config/supabase.js
const { createClient } = require('@supabase/supabase-js');

// Verificar se as variáveis de ambiente estão definidas
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('❌ SUPABASE_URL é obrigatória. Verifique seu arquivo .env');
}

if (!supabaseServiceKey) {
  throw new Error('❌ SUPABASE_SERVICE_KEY é obrigatória. Use a Service Role Key, não a Anon Key!');
}

// Validar formato da URL
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  throw new Error('❌ SUPABASE_URL deve seguir o formato: https://seu-projeto.supabase.co');
}

// Configurações do cliente Supabase
const supabaseConfig = {
  auth: {
    autoRefreshToken: false,  // Desabilitar refresh automático (usamos JWT customizado)
    persistSession: false,    // Não persistir sessão (stateless API)
    detectSessionInUrl: false // Não detectar sessão na URL
  },
  global: {
    headers: {
      'x-my-custom-header': 'questionflow-saas',
      'apikey': supabaseServiceKey
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10 // Limitar eventos de realtime
    }
  }
};

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey, supabaseConfig);

// Função para testar a conexão
async function testConnection() {
  try {
    console.log('🔄 Testando conexão com Supabase...');
    
    // Teste simples de conexão
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Erro na conexão com Supabase:', error.message);
      console.error('💡 Verifique se:');
      console.error('   - As tabelas foram criadas no banco');
      console.error('   - A Service Role Key está correta');
      console.error('   - A URL do projeto está correta');
      return false;
    }

    console.log('✅ Conexão com Supabase estabelecida com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro crítico na conexão:', error.message);
    return false;
  }
}

// Função helper para queries com tratamento de erro
async function safeQuery(tableName, queryBuilder) {
  try {
    const result = await queryBuilder;
    
    if (result.error) {
      console.error(`❌ Erro na query ${tableName}:`, result.error);
      throw new Error(`Erro no banco de dados: ${result.error.message}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Erro crítico na query ${tableName}:`, error.message);
    throw error;
  }
}

// Funções específicas para cada tabela com validações

// Usuários
const userQueries = {
  // Criar usuário
  async create(userData) {
    const { name, email, password } = userData;
    
    if (!name || !email || !password) {
      throw new Error('Nome, email e senha são obrigatórios');
    }

    return safeQuery('users', 
      supabase
        .from('users')
        .insert([{
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select('id, name, email, created_at')
        .single()
    );
  },

  // Buscar por email
  async findByEmail(email) {
    if (!email) {
      throw new Error('Email é obrigatório');
    }

    return safeQuery('users',
      supabase
        .from('users')
        .select('id, name, email, password, is_active, last_login')
        .eq('email', email.toLowerCase().trim())
        .single()
    );
  },

  // Buscar por ID
  async findById(id) {
    if (!id) {
      throw new Error('ID é obrigatório');
    }

    return safeQuery('users',
      supabase
        .from('users')
        .select('id, name, email, is_active, created_at, last_login')
        .eq('id', id)
        .single()
    );
  },

  // Atualizar último login
  async updateLastLogin(userId) {
    return safeQuery('users',
      supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId)
    );
  }
};

// Pesquisas
const surveyQueries = {
  // Criar pesquisa
  async create(surveyData, userId) {
    const { title, description, survey_json, status = 'draft' } = surveyData;
    
    if (!title || !survey_json || !userId) {
      throw new Error('Título, JSON da pesquisa e ID do usuário são obrigatórios');
    }

    return safeQuery('surveys',
      supabase
        .from('surveys')
        .insert([{
          title: title.trim(),
          description: description?.trim() || null,
          survey_json,
          status,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()
    );
  },

  // Buscar pesquisas do usuário com paginação
  async findByUser(userId, options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search 
    } = options;
    
    const offset = (page - 1) * limit;

    let query = supabase
      .from('surveys')
      .select(`
        id, title, description, status, created_at, updated_at,
        responses:survey_responses(count)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por status se fornecido
    if (status) {
      query = query.eq('status', status);
    }

    // Busca por título ou descrição
    if (search) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }

    return safeQuery('surveys', query);
  },

  // Buscar pesquisa específica
  async findById(surveyId, userId) {
    return safeQuery('surveys',
      supabase
        .from('surveys')
        .select(`
          id, title, description, survey_json, status, created_at, updated_at,
          responses:survey_responses(count)
        `)
        .eq('id', surveyId)
        .eq('user_id', userId)
        .single()
    );
  },

  // Buscar pesquisa pública (sem verificar usuário)
  async findPublicById(surveyId) {
    return safeQuery('surveys',
      supabase
        .from('surveys')
        .select('id, title, survey_json, status')
        .eq('id', surveyId)
        .single()
    );
  },

  // Atualizar pesquisa
  async update(surveyId, userId, updateData) {
    const allowedFields = ['title', 'description', 'survey_json', 'status'];
    const filteredData = {};
    
    // Filtrar apenas campos permitidos
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    filteredData.updated_at = new Date().toISOString();

    return safeQuery('surveys',
      supabase
        .from('surveys')
        .update(filteredData)
        .eq('id', surveyId)
        .eq('user_id', userId)
        .select()
        .single()
    );
  },

  // Deletar pesquisa
  async delete(surveyId, userId) {
    // Primeiro deletar respostas relacionadas
    await safeQuery('survey_responses',
      supabase
        .from('survey_responses')
        .delete()
        .eq('survey_id', surveyId)
    );

    // Depois deletar a pesquisa
    return safeQuery('surveys',
      supabase
        .from('surveys')
        .delete()
        .eq('id', surveyId)
        .eq('user_id', userId)
    );
  },

  // Contar pesquisas do usuário
  async countByUser(userId) {
    return safeQuery('surveys',
      supabase
        .from('surveys')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
    );
  }
};

// Respostas
const responseQueries = {
  // Criar resposta
  async create(responseData) {
    const { survey_id, response_data, respondent_info = {}, ip_address } = responseData;
    
    if (!survey_id || !response_data) {
      throw new Error('ID da pesquisa e dados da resposta são obrigatórios');
    }

    return safeQuery('survey_responses',
      supabase
        .from('survey_responses')
        .insert([{
          survey_id,
          response_data,
          respondent_info,
          ip_address,
          submitted_at: new Date().toISOString()
        }])
        .select()
        .single()
    );
  },

  // Buscar respostas de uma pesquisa
  async findBySurvey(surveyId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    return safeQuery('survey_responses',
      supabase
        .from('survey_responses')
        .select('id, response_data, respondent_info, submitted_at, ip_address', { count: 'exact' })
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false })
        .range(offset, offset + limit - 1)
    );
  },

  // Buscar todas as respostas de pesquisas do usuário
  async findByUserSurveys(userId, dateFrom = null) {
    let query = supabase
      .from('survey_responses')
      .select(`
        survey_id, submitted_at,
        surveys!inner(user_id)
      `)
      .eq('surveys.user_id', userId);

    if (dateFrom) {
      query = query.gte('submitted_at', dateFrom);
    }

    return safeQuery('survey_responses', query);
  },

  // Contar respostas por pesquisa
  async countBySurvey(surveyId) {
    return safeQuery('survey_responses',
      supabase
        .from('survey_responses')
        .select('id', { count: 'exact' })
        .eq('survey_id', surveyId)
    );
  }
};

// Analytics
const analyticsQueries = {
  // Estatísticas do dashboard
  async getDashboardStats(userId) {
    try {
      // Contar pesquisas
      const surveysCount = await surveyQueries.countByUser(userId);
      const totalSurveys = surveysCount.count || 0;

      // Contar pesquisas ativas
      const { data: activeSurveys } = await safeQuery('surveys',
        supabase
          .from('surveys')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'active')
      );

      // Buscar IDs das pesquisas do usuário
      const { data: userSurveys } = await safeQuery('surveys',
        supabase
          .from('surveys')
          .select('id')
          .eq('user_id', userId)
      );

      const surveyIds = userSurveys?.map(s => s.id) || [];

      // Contar total de respostas
      let totalResponses = 0;
      if (surveyIds.length > 0) {
        const { count } = await safeQuery('survey_responses',
          supabase
            .from('survey_responses')
            .select('id', { count: 'exact' })
            .in('survey_id', surveyIds)
        );
        totalResponses = count || 0;
      }

      return {
        totalSurveys,
        totalResponses,
        activeSurveys: activeSurveys?.length || 0,
        averageResponseRate: totalSurveys > 0 ? Math.round((totalResponses / totalSurveys) * 10) : 0
      };
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return {
        totalSurveys: 0,
        totalResponses: 0,
        activeSurveys: 0,
        averageResponseRate: 0
      };
    }
  }
};

// Event listeners para debugging
if (process.env.NODE_ENV === 'development') {
  // Log de queries em desenvolvimento
  console.log('🔧 Modo desenvolvimento: logs de queries habilitados');
}

// Inicialização
async function initialize() {
  if (process.env.NODE_ENV !== 'test') {
    await testConnection();
  }
}

// Exportar cliente e funções
module.exports = {
  supabase,
  testConnection,
  initialize,
  queries: {
    users: userQueries,
    surveys: surveyQueries,
    responses: responseQueries,
    analytics: analyticsQueries
  }
};

// Auto-inicializar se não estiver em modo de teste
if (require.main !== module && process.env.NODE_ENV !== 'test') {
  initialize().catch(console.error);
}