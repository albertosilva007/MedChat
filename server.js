const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');

dotenv.config();

const app = express();

// Configurações específicas para Render
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check para o Render
app.use('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

console.log('=== CONFIGURAÇÕES MEDCHAT ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT || 3000);
console.log('PUSHBULLET_TOKEN:', process.env.PUSHBULLET_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID ? 'Configurado' : 'Não configurado');
console.log('==============================');

// Configurações
const NODE_ENV = process.env.NODE_ENV || 'development';
const PUSHBULLET_TOKEN = process.env.PUSHBULLET_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ================== PUSHBULLET SETUP ==================

// Configuração Pushbullet
const PUSHBULLET_CONFIG = {
    token: PUSHBULLET_TOKEN,
    baseUrl: 'https://api.pushbullet.com/v2/pushes',
    timeout: 10000,
    maxRetries: 3
};

// Função para enviar Pushbullet
async function sendPushbulletNotification(title, body, url = null, retryCount = 0) {
    try {
        if (!PUSHBULLET_CONFIG.token) {
            throw new Error('Pushbullet não configurado - defina PUSHBULLET_TOKEN');
        }

        console.log(`📱 Pushbullet - Tentativa ${retryCount + 1}/${PUSHBULLET_CONFIG.maxRetries}`);

        const pushData = {
            type: 'note',
            title: title,
            body: body
        };

        // Adicionar URL se fornecida
        if (url) {
            pushData.type = 'link';
            pushData.url = url;
        }

        const response = await axios.post(PUSHBULLET_CONFIG.baseUrl, pushData, {
            headers: {
                'Access-Token': PUSHBULLET_CONFIG.token,
                'Content-Type': 'application/json'
            },
            timeout: PUSHBULLET_CONFIG.timeout
        });

        if (response.status === 200) {
            console.log('✅ Pushbullet enviado com sucesso!');
            return {
                success: true,
                response: response.data,
                attempt: retryCount + 1
            };
        } else {
            throw new Error(`Status HTTP: ${response.status}`);
        }

    } catch (error) {
        console.error(`❌ Erro Pushbullet (tentativa ${retryCount + 1}):`, error.message);

        // Retry logic
        if (retryCount < PUSHBULLET_CONFIG.maxRetries - 1) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`🔄 Tentando novamente em ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendPushbulletNotification(title, body, url, retryCount + 1);
        }

        return {
            success: false,
            error: error.message,
            totalAttempts: retryCount + 1
        };
    }
}

// ================== TELEGRAM SETUP ==================

async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await axios.post(telegramUrl, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
    }, {
        timeout: 10000
    });

    console.log('✅ Mensagem enviada para Telegram:', response.data.message_id);
    return response.data;
}

// ================== FUNÇÕES DE ALERTA ==================

// Função para criar alerta médico formatado
function createMedicalAlert(alertData) {
    const {
        severity,
        patientName,
        cpf,
        phone,
        score,
        symptoms,
        observations,
        location
    } = alertData;

    // Emojis baseados na severidade
    const severityConfig = {
        'baixa': { emoji: '🟡', priority: 1 },
        'media': { emoji: '🟠', priority: 2 },
        'alta': { emoji: '🔴', priority: 3 },
        'critica': { emoji: '🆘', priority: 4 },
        'emergencia': { emoji: '🚨', priority: 5 }
    };

    const config = severityConfig[severity?.toLowerCase()] || { emoji: '⚠️', priority: 0 };

    // Título para Pushbullet
    const title = `${config.emoji} ALERTA MÉDICO - ${severity?.toUpperCase()}`;

    // Corpo da mensagem
    let body = `Severidade: ${severity?.toUpperCase()}\n`;
    if (patientName) body += `Paciente: ${patientName}\n`;
    if (score) body += `Score: ${score}\n`;
    if (location) body += `Local: ${location}\n`;
    if (phone) body += `Contato: ${phone}\n`;
    if (symptoms) body += `Sintomas: ${symptoms}\n`;
    body += `Data/Hora: ${new Date().toLocaleString('pt-BR')}`;

    return { title, body, priority: config.priority };
}

// Função para enviar via Pushbullet formatado
async function sendMedicalAlertPushbullet(alertData) {
    const { title, body } = createMedicalAlert(alertData);
    
    // URL opcional para dashboard médico
    const dashboardUrl = process.env.DASHBOARD_URL || null;
    
    return await sendPushbulletNotification(title, body, dashboardUrl);
}

// ================== ROTAS ==================

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 Servidor MedChat com Pushbullet!',
        version: '2.2.0',
        platform: 'Render + Pushbullet',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        connections: {
            pushbullet: PUSHBULLET_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            telegram: TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não configurado'
        },
        features: {
            pushbullet: 'Notificações push gratuitas',
            telegram: 'Mensagens ilimitadas gratuitas',
            reliable: 'Muito mais confiável que CallMeBot'
        },
        routes: {
            health: 'GET /health',
            status: 'GET /status',
            testPushbullet: 'POST /test-pushbullet',
            testTelegram: 'POST /test-telegram',
            sendAlert: 'POST /send-alert',
            sendAlertPushbullet: 'POST /send-alert-pushbullet',
            statusPushbullet: 'GET /status-pushbullet'
        }
    });
});

// Rota para verificar status
app.get('/status', (req, res) => {
    res.json({
        platform: 'Render + Pushbullet',
        environment: NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pushbullet: {
            configured: PUSHBULLET_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            token: PUSHBULLET_TOKEN ? '✅ Definido' : '❌ Faltando PUSHBULLET_TOKEN',
            api: 'Pushbullet API v2',
            cost: 'Gratuito (100 pushes/mês)',
            reliability: 'Muito alta (99.9%)',
            maxRetries: PUSHBULLET_CONFIG.maxRetries
        },
        telegram: {
            botToken: TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            chatId: TELEGRAM_CHAT_ID ? '✅ Configurado' : '❌ Não configurado'
        }
    });
});

// Rota para status Pushbullet
app.get('/status-pushbullet', (req, res) => {
    res.json({
        pushbullet: {
            configured: PUSHBULLET_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            token: PUSHBULLET_TOKEN ? '✅ Definido' : '❌ Faltando PUSHBULLET_TOKEN',
            api: 'Pushbullet API v2',
            platform: 'Render + Pushbullet',
            cost: 'Gratuito',
            limitations: '100 pushes por mês (mais que suficiente)',
            advantages: [
                'Muito mais confiável que CallMeBot',
                'Funciona em todos dispositivos',
                'Notificações ricas com links',
                'Sem verificação de número',
                'API simples e estável'
            ],
            limits: {
                monthlyPushes: '100 (gratuito)',
                retries: PUSHBULLET_CONFIG.maxRetries,
                timeout: PUSHBULLET_CONFIG.timeout
            }
        }
    });
});

// Rota para testar Pushbullet
app.post('/test-pushbullet', async (req, res) => {
    try {
        const title = '🧪 Teste MedChat - Pushbullet';
        const body = `Data/Hora: ${new Date().toLocaleString('pt-BR')}
Sistema: MedChat v2.2
Plataforma: Render + Pushbullet
Status: Funcionando perfeitamente!

Este é um teste do sistema de notificações médicas.`;

        const result = await sendPushbulletNotification(title, body);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Pushbullet funcionando! Verifique suas notificações!',
                api: 'Pushbullet',
                platform: 'Render',
                attempts: result.attempt,
                timestamp: new Date().toISOString(),
                tip: 'Verifique seu celular/desktop para a notificação push'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                attempts: result.totalAttempts,
                tip: 'Verifique se PUSHBULLET_TOKEN está correto no Render'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para testar Telegram
app.post('/test-telegram', async (req, res) => {
    const testMessage = `🧪 <b>Teste MedChat - Telegram</b>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
🏥 <b>Sistema:</b> MedChat v2.2
📱 <b>Plataforma:</b> Render + Pushbullet
✅ <b>Status:</b> Sistema funcionando!`;

    try {
        const result = await sendTelegramMessage(testMessage);
        res.status(200).json({
            success: true,
            message: 'Telegram funcionando!',
            telegram: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para enviar alerta via Pushbullet
app.post('/send-alert-pushbullet', async (req, res) => {
    try {
        const alertData = req.body;

        // Validações obrigatórias
        const required = ['severity', 'score'];
        const missing = required.filter(field => !alertData[field]);
        
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Campos obrigatórios faltando: ${missing.join(', ')}`,
                required: required
            });
        }

        // Validar severidade
        const validSeverities = ['baixa', 'media', 'alta', 'critica', 'emergencia'];
        if (!validSeverities.includes(alertData.severity?.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Severidade inválida',
                validOptions: validSeverities
            });
        }

        console.log('📋 Processando alerta médico via Pushbullet...');
        const result = await sendMedicalAlertPushbullet(alertData);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Alerta médico enviado via Pushbullet!',
                data: {
                    api: 'Pushbullet',
                    platform: 'Render',
                    severity: alertData.severity,
                    patient: alertData.patientName,
                    score: alertData.score,
                    attempts: result.attempt,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Falha no envio via Pushbullet',
                details: {
                    error: result.error,
                    totalAttempts: result.totalAttempts
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na rota de alerta Pushbullet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota principal - Enviar alerta (todos os canais)
app.post('/send-alert', async (req, res) => {
    console.log('Recebido alerta:', req.body);
    const alertData = req.body;

    const results = {
        pushbullet: { success: false, error: null },
        telegram: { success: false, error: null }
    };

    // Tentar enviar via Pushbullet
    try {
        const pushResult = await sendMedicalAlertPushbullet(alertData);
        if (pushResult.success) {
            results.pushbullet.success = true;
            console.log('✅ Pushbullet enviado com sucesso');
        } else {
            results.pushbullet.error = pushResult.error;
        }
    } catch (error) {
        results.pushbullet.error = error.message;
        console.log('❌ Erro no Pushbullet:', error.message);
    }

    // Tentar enviar via Telegram (se configurado)
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        try {
            const { title, body } = createMedicalAlert(alertData);
            const telegramMessage = `🚨 <b>${title}</b>\n\n${body.replace(/\n/g, '\n')}`;
            
            await sendTelegramMessage(telegramMessage);
            results.telegram.success = true;
            console.log('✅ Telegram enviado com sucesso');
        } catch (error) {
            results.telegram.error = error.message;
            console.log('❌ Erro no Telegram:', error.message);
        }
    } else {
        results.telegram.error = 'Telegram não configurado';
    }

    // Resposta baseada no sucesso
    const anySuccess = results.pushbullet.success || results.telegram.success;

    if (anySuccess) {
        res.status(200).json({
            success: true,
            message: 'Alerta enviado!',
            platform: 'Pushbullet + Telegram',
            details: results
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Falha ao enviar alertas',
            details: results
        });
    }
});

// Rota para webhook Zapier/Make
app.post('/webhook-alert', async (req, res) => {
    try {
        console.log('📧 Webhook recebido (Zapier/Make):', req.body);
        
        // Processar dados do webhook
        const alertData = {
            severity: req.body.severity || req.body.urgencia || 'media',
            patientName: req.body.patientName || req.body.paciente || req.body.nome,
            score: req.body.score || req.body.pontuacao,
            symptoms: req.body.symptoms || req.body.sintomas,
            observations: req.body.observations || req.body.observacoes,
            location: req.body.location || req.body.local
        };

        // Enviar via Pushbullet
        const result = await sendMedicalAlertPushbullet(alertData);
        
        res.json({
            success: result.success,
            message: result.success ? 'Alerta processado via webhook!' : 'Erro no webhook',
            webhook: 'Zapier/Make',
            data: alertData,
            result: result
        });
        
    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            webhook: 'Zapier/Make'
        });
    }
});

// ================== INICIALIZAÇÃO ==================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor MedChat rodando na porta ${PORT}`);
    console.log(`☁️ Ambiente: ${NODE_ENV}`);
    console.log(`📱 URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
    console.log('📱 Pushbullet configurado para notificações médicas!');
    console.log('🆓 Solução gratuita e muito mais confiável!');
    
    // Verificar configuração Pushbullet
    if (PUSHBULLET_TOKEN) {
        console.log('✅ Pushbullet configurado!');
        console.log('💡 100 notificações gratuitas por mês');
        console.log('📱 Funciona em Android, iOS e Desktop');
    } else {
        console.log('⚠️ Pushbullet não configurado! Configure PUSHBULLET_TOKEN');
    }

    console.log('\n🎉 MedChat com Pushbullet pronto!');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Desligando servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM recebido...');
    process.exit(0);
});
