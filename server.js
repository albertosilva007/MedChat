const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
// Imports para WhatsApp gratuito
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require("pino");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('=== CONFIGURAÇÕES ===');
console.log('MEU_WHATSAPP:', process.env.MEU_WHATSAPP);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID);
console.log('CALLMEBOT_PHONE:', process.env.CALLMEBOT_PHONE ? 'Configurado' : 'Não configurado');
console.log('CALLMEBOT_APIKEY:', process.env.CALLMEBOT_APIKEY ? 'Configurado' : 'Não configurado');
console.log('====================');

// Configurações
const MEU_WHATSAPP = process.env.MEU_WHATSAPP; // Seu número: 5581986509040
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Variável para socket do WhatsApp
let sock;
let whatsappConnected = false;

// ================== WHATSAPP SETUP ==================

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: P({ level: "silent" })
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                whatsappConnected = false;
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ WhatsApp desconectado. Reconnectando...', shouldReconnect);

                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 5000);
                }
            } else if (connection === 'open') {
                whatsappConnected = true;
                console.log('✅ WhatsApp conectado!');
            }
        });

    } catch (error) {
        console.error('Erro ao conectar WhatsApp:', error);
        whatsappConnected = false;
    }
}

// Função para enviar WhatsApp para mim mesmo
async function sendWhatsAppToMe(message) {
    if (!whatsappConnected || !sock) {
        throw new Error('WhatsApp não está conectado');
    }

    const id = MEU_WHATSAPP.includes('@') ? MEU_WHATSAPP : `${MEU_WHATSAPP}@s.whatsapp.net`;

    await sock.sendMessage(id, { text: message });
    console.log('✅ Mensagem enviada para WhatsApp');
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
    });

    console.log('✅ Mensagem enviada para Telegram:', response.data.message_id);
    return response.data;
}

// ================== CALLMEBOT WHATSAPP MELHORADO ==================

// Configuração CallMeBot com validações e retry
const CALLMEBOT_CONFIG = {
    phone: process.env.CALLMEBOT_PHONE,
    apiKey: process.env.CALLMEBOT_APIKEY,
    baseUrl: 'https://api.callmebot.com/whatsapp.php',
    timeout: 15000,
    maxRetries: 3
};

// Função para validar número de telefone brasileiro
function validatePhoneNumber(phone) {
    if (!phone) return false;
    // Remove espaços, parênteses e traços
    const cleanPhone = phone.replace(/[\s\(\)\-]/g, '');
    // Verifica se tem formato brasileiro com código do país
    return /^55\d{10,11}$/.test(cleanPhone);
}

// Função melhorada para enviar WhatsApp via CallMeBot
async function sendCallMeBotWhatsApp(message, retryCount = 0) {
    try {
        if (!CALLMEBOT_CONFIG.phone || !CALLMEBOT_CONFIG.apiKey) {
            throw new Error('CallMeBot não configurado - defina CALLMEBOT_PHONE e CALLMEBOT_APIKEY');
        }

        // Validar número de telefone
        if (!validatePhoneNumber(CALLMEBOT_CONFIG.phone)) {
            throw new Error('Número de telefone inválido. Use formato: 5581999999999');
        }

        // Limitar tamanho da mensagem (CallMeBot tem limite)
        if (message.length > 1000) {
            console.warn('⚠️ Mensagem muito longa, truncando...');
            message = message.substring(0, 997) + '...';
        }

        const url = `${CALLMEBOT_CONFIG.baseUrl}?phone=${encodeURIComponent(CALLMEBOT_CONFIG.phone)}&text=${encodeURIComponent(message)}&apikey=${CALLMEBOT_CONFIG.apiKey}`;
        
        console.log(`📱 Tentativa ${retryCount + 1} - Enviando CallMeBot WhatsApp...`);
        
        const response = await axios.get(url, { 
            timeout: CALLMEBOT_CONFIG.timeout,
            headers: {
                'User-Agent': 'MedChat-Server/2.1.0'
            }
        });
        
        // Verificar se a resposta indica sucesso
        if (response.status === 200) {
            console.log('✅ CallMeBot WhatsApp enviado com sucesso!');
            return { 
                success: true, 
                response: response.data,
                attempt: retryCount + 1,
                messageLength: message.length
            };
        } else {
            throw new Error(`Status HTTP: ${response.status}`);
        }
        
    } catch (error) {
        console.error(`❌ Erro CallMeBot (tentativa ${retryCount + 1}):`, error.message);
        
        // Retry logic para falhas temporárias
        if (retryCount < CALLMEBOT_CONFIG.maxRetries - 1) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(`🔄 Tentando novamente em ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendCallMeBotWhatsApp(message, retryCount + 1);
        }
        
        return { 
            success: false, 
            error: error.message,
            totalAttempts: retryCount + 1
        };
    }
}

// Nova função para enviar alertas com formatação otimizada
async function sendMedicalAlertCallMeBot(alertData) {
    const {
        severity,
        patientName,
        cpf,
        phone,
        score,
        symptoms,
        observations,
        location,
        priority
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
    
    // Formatação otimizada para WhatsApp
    let alertMessage = `${config.emoji} *ALERTA MÉDICO*\n`;
    alertMessage += `━━━━━━━━━━━━━━━━━\n`;
    alertMessage += `🔴 *Severidade:* ${severity?.toUpperCase()}\n`;
    
    if (patientName) alertMessage += `👤 *Paciente:* ${patientName}\n`;
    if (cpf) alertMessage += `📋 *CPF:* ${cpf}\n`;
    if (phone) alertMessage += `📞 *Contato:* ${phone}\n`;
    if (score) alertMessage += `📊 *Score:* ${score}\n`;
    if (location) alertMessage += `📍 *Local:* ${location}\n`;
    
    alertMessage += `⏰ *Data/Hora:* ${new Date().toLocaleString('pt-BR')}\n`;
    
    if (symptoms) {
        alertMessage += `\n🩺 *Sintomas:*\n${symptoms}\n`;
    }
    
    if (observations) {
        alertMessage += `\n📝 *Observações:*\n${observations}\n`;
    }
    
    alertMessage += `\n━━━━━━━━━━━━━━━━━\n`;
    alertMessage += `_Sistema MedChat v2.1 🏥_`;

    return await sendCallMeBotWhatsApp(alertMessage);
}

// ================== ROTAS ==================

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 Servidor MedChat funcionando!',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        connections: {
            whatsapp: whatsappConnected ? '✅ Conectado' : '❌ Desconectado',
            telegram: TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            callmebot: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) ? '✅ Configurado' : '❌ Não configurado'
        },
        routes: {
            status: 'GET /status',
            sendAlert: 'POST /send-alert',
            testTelegram: 'POST /test-telegram',
            testWhatsApp: 'POST /test-whatsapp',
            testCallmebot: 'POST /test-callmebot',
            sendAlertCallmebot: 'POST /send-alert-callmebot',
            sendAlertCallmebotV2: 'POST /send-alert-callmebot-v2',
            statusCallmebot: 'GET /status-callmebot',
            setupCallmebot: 'POST /setup-callmebot'
        }
    });
});

// Rota para verificar status
app.get('/status', (req, res) => {
    res.json({
        telegram: {
            botToken: TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            chatId: TELEGRAM_CHAT_ID ? '✅ Configurado' : '❌ Não configurado'
        },
        whatsapp: {
            connected: whatsappConnected ? '✅ Conectado' : '❌ Desconectado',
            myNumber: MEU_WHATSAPP ? '✅ Configurado' : '❌ Não configurado'
        },
        callmebot: {
            configured: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) ? '✅ Configurado' : '❌ Não configurado',
            phone: CALLMEBOT_CONFIG.phone ? '✅ Definido' : '❌ Faltando',
            apiKey: CALLMEBOT_CONFIG.apiKey ? '✅ Definido' : '❌ Faltando',
            phoneValid: validatePhoneNumber(CALLMEBOT_CONFIG.phone) ? '✅ Válido' : '❌ Inválido'
        }
    });
});

// Rota para testar Telegram
app.post('/test-telegram', async (req, res) => {
    const testMessage = `🧪 <b>Teste do Telegram</b>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
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

// Rota para testar WhatsApp
app.post('/test-whatsapp', async (req, res) => {
    const testMessage = `🧪 Teste do WhatsApp
⏰ Data: ${new Date().toLocaleString('pt-BR')}
✅ Status: Sistema funcionando!`;

    try {
        await sendWhatsAppToMe(testMessage);
        res.status(200).json({
            success: true,
            message: 'WhatsApp funcionando!',
            connected: whatsappConnected
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            connected: whatsappConnected
        });
    }
});

// Rota para testar CallMeBot (versão original)
app.post('/test-callmebot', async (req, res) => {
    try {
        const testMessage = `🧪 *Teste CallMeBot - Servidor*

⏰ *Data/Hora:* ${new Date().toLocaleString('pt-BR')}
🤖 *Sistema:* MedChat v2.1
🆓 *API:* CallMeBot (Gratuita)
✅ *Status:* Funcionando perfeitamente!

_Teste realizado pelo servidor!_ 🎉`;

        const result = await sendCallMeBotWhatsApp(testMessage);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'CallMeBot funcionando! Verifique seu WhatsApp!',
                api: 'CallMeBot',
                attempts: result.attempt,
                messageLength: result.messageLength,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                attempts: result.totalAttempts,
                tip: 'Verifique se CALLMEBOT_PHONE e CALLMEBOT_APIKEY estão configurados'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para status CallMeBot
app.get('/status-callmebot', (req, res) => {
    res.json({
        callmebot: {
            configured: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) ? '✅ Configurado' : '❌ Não configurado',
            phone: CALLMEBOT_CONFIG.phone ? '✅ Definido' : '❌ Faltando CALLMEBOT_PHONE',
            phoneValid: validatePhoneNumber(CALLMEBOT_CONFIG.phone) ? '✅ Válido' : '❌ Formato inválido',
            apiKey: CALLMEBOT_CONFIG.apiKey ? '✅ Definido' : '❌ Faltando CALLMEBOT_APIKEY',
            api: 'CallMeBot WhatsApp',
            cost: 'Gratuito',
            limitations: 'Apenas para seu próprio número',
            limits: {
                dailyMessages: '100 mensagens por dia',
                messageLength: '1000 caracteres',
                retries: CALLMEBOT_CONFIG.maxRetries
            },
            routes: {
                test: 'POST /test-callmebot',
                alert: 'POST /send-alert-callmebot',
                alertV2: 'POST /send-alert-callmebot-v2',
                status: 'GET /status-callmebot',
                setup: 'POST /setup-callmebot'
            }
        }
    });
});

// Rota para configurar CallMeBot (primeira vez)
app.post('/setup-callmebot', (req, res) => {
    res.json({
        message: 'Como configurar CallMeBot WhatsApp',
        steps: [
            {
                step: 1,
                action: 'Adicionar contato',
                details: 'Adicione +34 644 77 94 07 no WhatsApp',
                contact: '+34 644 77 94 07'
            },
            {
                step: 2,
                action: 'Enviar mensagem',
                details: 'Envie exatamente esta mensagem:',
                message: 'I allow callmebot to send me messages'
            },
            {
                step: 3,
                action: 'Aguardar resposta',
                details: 'Você receberá uma API key'
            },
            {
                step: 4,
                action: 'Configurar .env',
                details: 'Adicione as variáveis:',
                env: {
                    'CALLMEBOT_PHONE': 'Seu número com código do país (ex: 5581999999999)',
                    'CALLMEBOT_APIKEY': 'A API key recebida'
                }
            }
        ],
        limits: {
            messages: '100 por dia (gratuito)',
            length: '1000 caracteres por mensagem',
            restriction: 'Apenas para seu próprio número'
        },
        currentConfig: {
            phone: CALLMEBOT_CONFIG.phone ? 'Configurado' : 'Não configurado',
            apiKey: CALLMEBOT_CONFIG.apiKey ? 'Configurado' : 'Não configurado',
            valid: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey && validatePhoneNumber(CALLMEBOT_CONFIG.phone)) ? '✅ Pronto para usar' : '❌ Configuração incompleta'
        }
    });
});

// Rota para enviar alerta médico via CallMeBot (versão original)
app.post('/send-alert-callmebot', async (req, res) => {
    try {
        const {
            severity,
            patientName,
            cpf,
            phone,
            score,
            symptoms,
            observations
        } = req.body;

        // Validação básica
        if (!severity || !score) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: severity, score'
            });
        }

        const urgencyEmoji = {
            'baixa': '🟡',
            'media': '🟠',
            'alta': '🔴',
            'critica': '🆘',
            'emergencia': '🚨'
        }[severity?.toLowerCase()] || '⚠️';

        const alertMessage = `${urgencyEmoji} *ALERTA MÉDICO*
━━━━━━━━━━━━━━━━━
🔴 *Severidade:* ${severity}
👤 *Paciente:* ${patientName || 'Não informado'}
📋 *CPF:* ${cpf || 'Não informado'}
📞 *Contato:* ${phone || 'Não informado'}
📊 *Score:* ${score}
${symptoms ? `🩺 *Sintomas:* ${symptoms}` : ''}
${observations ? `📝 *Observações:* ${observations}` : ''}
⏰ *Data/Hora:* ${new Date().toLocaleString('pt-BR')}
━━━━━━━━━━━━━━━━━

_Sistema MedChat - CallMeBot API_`;

        const result = await sendCallMeBotWhatsApp(alertMessage);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Alerta médico enviado via CallMeBot!',
                api: 'CallMeBot',
                severity: severity,
                patient: patientName,
                score: score,
                attempts: result.attempt,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Falha no envio via CallMeBot',
                details: result.error,
                attempts: result.totalAttempts
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota melhorada para alertas médicos (versão 2)
app.post('/send-alert-callmebot-v2', async (req, res) => {
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

        console.log('📋 Processando alerta médico via CallMeBot V2...');
        const result = await sendMedicalAlertCallMeBot(alertData);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Alerta médico enviado via CallMeBot V2!',
                data: {
                    api: 'CallMeBot V2',
                    severity: alertData.severity,
                    patient: alertData.patientName,
                    score: alertData.score,
                    attempts: result.attempt,
                    messageLength: result.messageLength,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Falha no envio via CallMeBot V2',
                details: {
                    error: result.error,
                    totalAttempts: result.totalAttempts
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na rota de alerta V2:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota principal - Enviar alerta (todos os canais)
app.post('/send-alert', async (req, res) => {
    console.log('Recebido:', req.body);
    const { severity, patientName, cpf, phone, score, symptoms, observations } = req.body;

    // Mensagem formatada para WhatsApp
    const whatsappMessage = `🚨 ALERTA MÉDICO
━━━━━━━━━━━━━━━━━
🔴 Severidade: ${severity}
👤 Paciente: ${patientName || 'Não informado'}
📋 CPF: ${cpf || 'Não informado'}
📞 Contato: ${phone || 'Não informado'}
📊 Score: ${score}
⏰ ${new Date().toLocaleString('pt-BR')}
━━━━━━━━━━━━━━━━━`;

    // Mensagem formatada para Telegram (com HTML)
    const telegramMessage = `🚨 <b>ALERTA MÉDICO</b>
━━━━━━━━━━━━━━━━━
🔴 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName || 'Não informado'}
📋 <b>CPF:</b> ${cpf || 'Não informado'}
📞 <b>Contato:</b> ${phone || 'Não informado'}
📊 <b>Score:</b> ${score}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
━━━━━━━━━━━━━━━━━`;

    const results = {
        whatsapp: { success: false, error: null },
        telegram: { success: false, error: null },
        callmebot: { success: false, error: null }
    };

    // Tentar enviar WhatsApp
    try {
        await sendWhatsAppToMe(whatsappMessage);
        results.whatsapp.success = true;
        console.log('✅ WhatsApp enviado com sucesso');
    } catch (error) {
        results.whatsapp.error = error.message;
        console.log('❌ Erro no WhatsApp:', error.message);
    }

    // Tentar enviar Telegram
    try {
        await sendTelegramMessage(telegramMessage);
        results.telegram.success = true;
        console.log('✅ Telegram enviado com sucesso');
    } catch (error) {
        results.telegram.error = error.message;
        console.log('❌ Erro no Telegram:', error.message);
    }

    // Tentar enviar CallMeBot como backup
    try {
        const callmebotResult = await sendMedicalAlertCallMeBot(req.body);
        if (callmebotResult.success) {
            results.callmebot.success = true;
            console.log('✅ CallMeBot enviado com sucesso');
        } else {
            results.callmebot.error = callmebotResult.error;
        }
    } catch (error) {
        results.callmebot.error = error.message;
        console.log('❌ Erro no CallMeBot:', error.message);
    }

    // Resposta baseada no sucesso
    const anySuccess = results.whatsapp.success || results.telegram.success || results.callmebot.success;

    if (anySuccess) {
        res.status(200).json({
            success: true,
            message: 'Alerta enviado!',
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

// Rota antiga mantida para compatibilidade
app.post('/send-whatsapp', (req, res) => {
    // Redireciona para a nova rota
    req.url = '/send-alert';
    app.handle(req, res);
});

// Middleware para log de CallMeBot
app.use('/callmebot/*', (req, res, next) => {
    console.log(`📱 CallMeBot ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// ================== INICIALIZAÇÃO ==================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log('📱 CallMeBot WhatsApp configurado!');
    console.log('🆓 API Gratuita para WhatsApp!');
    
    // Verificar configuração CallMeBot
    if (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) {
        console.log('✅ CallMeBot configurado!');
        if (validatePhoneNumber(CALLMEBOT_CONFIG.phone)) {
            console.log('✅ Número de telefone válido!');
        } else {
            console.log('⚠️ Número de telefone inválido! Use formato: 5581999999999');
        }
    } else {
        console.log('⚠️ CallMeBot não configurado! Configure CALLMEBOT_PHONE e CALLMEBOT_APIKEY');
    }

    // Conectar WhatsApp
    console.log('\n🔄 Conectando ao WhatsApp...');
    console.log('👆 Escaneie o QR Code com seu WhatsApp');
    await connectToWhatsApp();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Desligando servidor...');
    if (sock) {
        sock.end();
    }
    process.exit(0);
});
