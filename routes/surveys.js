const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validações
const surveyValidation = [
  body('title').trim().isLength({ min: 3 }).withMessage('Título deve ter pelo menos 3 caracteres'),
  body('description').optional().trim(),
  body('survey_json').isObject().withMessage('JSON da pesquisa inválido'),
  body('status').optional().isIn(['draft', 'active', 'paused', 'completed'])
];

// Listar pesquisas do usuário
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('surveys')
      .select(`
        id, title, description, status, created_at, updated_at,
        responses:survey_responses(count)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: surveys, error, count } = await query;

    if (error) throw error;

    // Calcular total de respostas para cada pesquisa
    const surveysWithCounts = surveys.map(survey => ({
      ...survey,
      response_count: survey.responses?.[0]?.count || 0
    }));

    res.json({
      surveys: surveysWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar pesquisas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar pesquisa específica
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { data: survey, error } = await supabase
      .from('surveys')
      .select(`
        id, title, description, survey_json, status, created_at, updated_at,
        responses:survey_responses(count)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !survey) {
      return res.status(404).json({ error: 'Pesquisa não encontrada' });
    }

    survey.response_count = survey.responses?.[0]?.count || 0;

    res.json(survey);

  } catch (error) {
    console.error('Erro ao buscar pesquisa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar nova pesquisa
router.post('/', authenticateToken, surveyValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, survey_json, status = 'draft' } = req.body;

    const { data: survey, error } = await supabase
      .from('surveys')
      .insert([{
        title,
        description,
        survey_json,
        status,
        user_id: req.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Pesquisa criada com sucesso',
      survey
    });

  } catch (error) {
    console.error('Erro ao criar pesquisa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar pesquisa
router.put('/:id', authenticateToken, surveyValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, survey_json, status } = req.body;

    const { data: survey, error } = await supabase
      .from('surveys')
      .update({
        title,
        description,
        survey_json,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error || !survey) {
      return res.status(404).json({ error: 'Pesquisa não encontrada' });
    }

    res.json({
      message: 'Pesquisa atualizada com sucesso',
      survey
    });

  } catch (error) {
    console.error('Erro ao atualizar pesquisa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar pesquisa
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Primeiro deletar respostas relacionadas
    await supabase
      .from('survey_responses')
      .delete()
      .eq('survey_id', req.params.id);

    // Depois deletar a pesquisa
    const { error } = await supabase
      .from('surveys')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ message: 'Pesquisa deletada com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar pesquisa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Submeter resposta (endpoint público)
router.post('/:id/responses', async (req, res) => {
  try {
    const { response_data, respondent_info = {} } = req.body;

    if (!response_data) {
      return res.status(400).json({ error: 'Dados da resposta são obrigatórios' });
    }

    // Verificar se a pesquisa existe e está ativa
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Pesquisa não encontrada' });
    }

    if (survey.status !== 'active') {
      return res.status(400).json({ error: 'Pesquisa não está ativa' });
    }

    // Salvar resposta
    const { data: response, error } = await supabase
      .from('survey_responses')
      .insert([{
        survey_id: req.params.id,
        response_data,
        respondent_info,
        submitted_at: new Date().toISOString(),
        ip_address: req.ip
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Resposta enviada com sucesso',
      response_id: response.id
    });

  } catch (error) {
    console.error('Erro ao enviar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar respostas de uma pesquisa
router.get('/:id/responses', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Verificar se a pesquisa pertence ao usuário
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Pesquisa não encontrada' });
    }

    const { data: responses, error, count } = await supabase
      .from('survey_responses')
      .select('id, response_data, respondent_info, submitted_at, ip_address')
      .eq('survey_id', req.params.id)
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      responses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;