const express = require('express');
const puppeteer = require('puppeteer');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Dashboard analytics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Estatísticas gerais
    const { data: surveysCount } = await supabase
      .from('surveys')
      .select('id', { count: 'exact' })
      .eq('user_id', req.user.id);

    const { data: responsesCount } = await supabase
      .from('survey_responses')
      .select('survey_id')
      .in('survey_id', surveysCount?.map(s => s.id) || []);

    const { data: activeSurveys } = await supabase
      .from('surveys')
      .select('id', { count: 'exact' })
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    // Respostas por dia (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: dailyResponses } = await supabase
      .from('survey_responses')
      .select('submitted_at, survey_id')
      .in('survey_id', surveysCount?.map(s => s.id) || [])
      .gte('submitted_at', thirtyDaysAgo.toISOString());

    // Agrupar respostas por dia
    const responsesPerDay = {};
    dailyResponses?.forEach(response => {
      const date = response.submitted_at.split('T')[0];
      responsesPerDay[date] = (responsesPerDay[date] || 0) + 1;
    });

    // Top 5 pesquisas por respostas
    const { data: topSurveys } = await supabase
      .from('surveys')
      .select(`
        id, title,
        responses:survey_responses(count)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const topSurveysWithCounts = topSurveys?.map(survey => ({
      id: survey.id,
      title: survey.title,
      response_count: survey.responses?.[0]?.count || 0
    })).sort((a, b) => b.response_count - a.response_count);

    res.json({
      stats: {
        totalSurveys: surveysCount?.length || 0,
        totalResponses: responsesCount?.length || 0,
        activeSurveys: activeSurveys?.length || 0,
        averageResponseRate: Math.round(Math.random() * 100) // Placeholder
      },
      charts: {
        responsesPerDay,
        topSurveys: topSurveysWithCounts
      }
    });

  } catch (error) {
    console.error('Erro no dashboard analytics:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Analytics de uma pesquisa específica
router.get('/survey/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar se a pesquisa pertence ao usuário
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, survey_json')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Pesquisa não encontrada' });
    }

    // Buscar todas as respostas
    const { data: responses, error } = await supabase
      .from('survey_responses')
      .select('response_data, submitted_at')
      .eq('survey_id', req.params.id);

    if (error) throw error;

    // Processar dados para analytics
    const analytics = processResponsesForAnalytics(survey.survey_json, responses);

    res.json({
      survey: {
        id: survey.id,
        title: survey.title
      },
      totalResponses: responses.length,
      analytics
    });

  } catch (error) {
    console.error('Erro no analytics da pesquisa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Exportar relatório em PDF
router.get('/survey/:id/export-pdf', authenticateToken, async (req, res) => {
  try {
    // Verificar se a pesquisa pertence ao usuário
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, survey_json')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Pesquisa não encontrada' });
    }

    // Buscar respostas
    const { data: responses, error } = await supabase
      .from('survey_responses')
      .select('response_data, submitted_at')
      .eq('survey_id', req.params.id);

    if (error) throw error;

    // Gerar HTML para o PDF
    const analytics = processResponsesForAnalytics(survey.survey_json, responses);
    const htmlContent = generateReportHTML(survey, responses, analytics);

    // Gerar PDF
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${survey.title.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdf);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório PDF' });
  }
});

// Função auxiliar para processar respostas
function processResponsesForAnalytics(surveyJson, responses) {
  const analytics = {};

  if (!surveyJson.pages || !responses.length) {
    return analytics;
  }

  // Extrair todas as perguntas
  const questions = [];
  surveyJson.pages.forEach(page => {
    if (page.elements) {
      questions.push(...page.elements);
    }
  });

  // Processar cada pergunta
  questions.forEach(question => {
    const questionData = {
      name: question.name,
      title: question.title,
      type: question.type,
      responses: {}
    };

    responses.forEach(response => {
      const answer = response.response_data[question.name];
      if (answer !== undefined) {
        if (typeof answer === 'string') {
          questionData.responses[answer] = (questionData.responses[answer] || 0) + 1;
        } else if (Array.isArray(answer)) {
          answer.forEach(item => {
            questionData.responses[item] = (questionData.responses[item] || 0) + 1;
          });
        }
      }
    });

    analytics[question.name] = questionData;
  });

  return analytics;
}
module.exports = router;

