const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
// Imports para WhatsApp gratuito
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require("pino");

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

console.log('=== CONFIGURAÇÕES RENDER ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT || 3000);
console.log('MEU_WHATSAPP:', process.env.MEU_WHATSAPP ? 'Configurado' : 'Não configurado');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID ? 'Configurado' : 'Não configurado');
console.log('CALLMEBOT_PHONE:', process.env.CALLMEBOT_PHONE ? 'Configurado' : 'Não configurado');
console.log('CALLMEBOT_APIKEY:', process.env.CALLMEBOT_APIKEY ? 'Configurado' : 'Não configurado');
console.log('============================');

// Configurações
const MEU_WHATSAPP = process.env.MEU_WHATSAPP;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Variável para socket do WhatsApp
let sock;
let whatsappConnected = false;
let whatsappConnectionAttempts = 0;
const MAX_WHATSAPP_ATTEMPTS = 3; // Limitar tentativas no Render

// ================== WHATSAPP SETUP (OTIMIZADO PARA RENDER) ==================

async function connectToWhatsApp() {
    try {
        // No Render, pode ser melhor desabilitar o WhatsApp Baileys em produção
        if (NODE_ENV === 'production') {
            console.log('⚠️ WhatsApp Baileys desabilitado em produção (Render)');
            console.log('💡 Use CallMeBot como alternativa principal');
            return;
        }

        if (whatsappConnectionAttempts >= MAX_WHATSAPP_ATTEMPTS) {
            console.log('❌ Máximo de tentativas WhatsApp atingido no Render');
            return;
        }

        whatsappConnectionAttempts++;
        console.log(`🔄 Tentativa ${whatsappConnectionAttempts}/${MAX_WHATSAPP_ATTEMPTS} - Conectando WhatsApp...`);

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: NODE_ENV !== 'production', // Não mostrar QR em produção
            logger: P({ level: "silent" }),
            connectTimeoutMs: 30000, // Timeout para Render
            defaultQueryTimeoutMs: 30000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                whatsappConnected = false;
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ WhatsApp desconectado no Render. Reconnectando...', shouldReconnect);

                if (shouldReconnect && whatsappConnectionAttempts < MAX_WHATSAPP_ATTEMPTS) {
                    setTimeout(connectToWhatsApp, 10000); // Delay maior no Render
                }
            } else if (connection === 'open') {
                whatsappConnected = true;
                whatsappConnectionAttempts = 0; // Reset contador
                console.log('✅ WhatsApp conectado no Render!');
            }
        });

    } catch (error) {
        console.error('❌ Erro ao conectar WhatsApp no Render:', error.message);
        whatsappConnected = false;
    }
}

// Função para enviar WhatsApp para mim mesmo
async function sendWhatsAppToMe(message) {
    if (!whatsappConnected || !sock) {
        throw new Error('WhatsApp não está conectado no Render');
    }

    const id = MEU_WHATSAPP.includes('@') ? MEU_WHATSAPP : `${MEU_WHATSAPP}@s.whatsapp.net`;

    await sock.sendMessage(id, { text: message });
    console.log('✅ Mensagem enviada para WhatsApp via Render');
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
        timeout: 10000 // Timeout para Render
    });

    console.log('✅ Mensagem enviada para Telegram via Render:', response.data.message_id);
    return response.data;
}

// ================== CALLMEBOT WHATSAPP (OTIMIZADO PARA RENDER) ==================

// Configuração CallMeBot otimizada para Render
const CALLMEBOT_CONFIG = {
    phone: process.env.CALLMEBOT_PHONE,
    apiKey: process.env.CALLMEBOT_APIKEY,
    baseUrl: 'https://api.callmebot.com/whatsapp.php',
    timeout: 20000, // Timeout maior para Render
    maxRetries: 5, // Mais tentativas no Render
    retryDelay: 2000
};

// Função para validar número de telefone brasileiro
function validatePhoneNumber(phone) {
    if (!phone) return false;
    const cleanPhone = phone.replace(/[\s\(\)\-]/g, '');
    return /^55\d{10,11}$/.test(cleanPhone);
}

// Função melhorada para enviar WhatsApp via CallMeBot (otimizada para Render)
async function sendCallMeBotWhatsApp(message, retryCount = 0) {
    try {
        if (!CALLMEBOT_CONFIG.phone || !CALLMEBOT_CONFIG.apiKey) {
            throw new Error('CallMeBot não configurado - defina CALLMEBOT_PHONE e CALLMEBOT_APIKEY no Render');
        }

        // Validar número de telefone
        if (!validatePhoneNumber(CALLMEBOT_CONFIG.phone)) {
            throw new Error('Número de telefone inválido no Render. Use formato: 5581999999999');
        }

        // Limitar tamanho da mensagem (CallMeBot tem limite)
        if (message.length > 1000) {
            console.warn('⚠️ Mensagem muito longa no Render, truncando...');
            message = message.substring(0, 997) + '...';
        }

        const url = `${CALLMEBOT_CONFIG.baseUrl}?phone=${encodeURIComponent(CALLMEBOT_CONFIG.phone)}&text=${encodeURIComponent(message)}&apikey=${CALLMEBOT_CONFIG.apiKey}`;
        
        console.log(`📱 Render - Tentativa ${retryCount + 1}/${CALLMEBOT_CONFIG.maxRetries} - Enviando CallMeBot...`);
        
        const response = await axios.get(url, { 
            timeout: CALLMEBOT_CONFIG.timeout,
            headers: {
                'User-Agent': 'MedChat-Render/2.1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        // Verificar se a resposta indica sucesso
        if (response.status === 200) {
            console.log('✅ CallMeBot enviado com sucesso via Render!');
            return { 
                success: true, 
                response: response.data,
                attempt: retryCount + 1,
                messageLength: message.length,
                platform: 'Render'
            };
        } else {
            throw new Error(`Status HTTP: ${response.status}`);
        }
        
    } catch (error) {
        console.error(`❌ Erro CallMeBot no Render (tentativa ${retryCount + 1}):`, error.message);
        
        // Retry logic otimizado para Render
        if (retryCount < CALLMEBOT_CONFIG.maxRetries - 1) {
            const delay = Math.min(CALLMEBOT_CONFIG.retryDelay * Math.pow(1.5, retryCount), 10000);
            console.log(`🔄 Render - Tentando novamente em ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendCallMeBotWhatsApp(message, retryCount + 1);
        }
        
        return { 
            success: false, 
            error: error.message,
            totalAttempts: retryCount + 1,
            platform: 'Render'
        };
    }
}

// Nova função para enviar alertas com formatação otimizada para Render
async function sendMedicalAlertCallMeBot(alertData) {
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
    
    // Formatação otimizada para WhatsApp via Render
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
    alertMessage += `_MedChat Render v2.1 🏥☁️_`;

    return await sendCallMeBotWhatsApp(alertMessage);
}

// ================== ROTAS OTIMIZADAS PARA RENDER ==================

// Rota principal com info do Render
app.get('/', (req, res) => {
    res.json({
        message: '🏥 Servidor MedChat funcionando no Render!',
        version: '2.1.0',
        platform: 'Render',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        connections: {
            whatsapp: whatsappConnected ? '✅ Conectado' : '❌ Desconectado (Use CallMeBot)',
            telegram: TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            callmebot: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) ? '✅ Configurado (Recomendado)' : '❌ Não configurado'
        },
        render: {
            recommended: 'Use CallMeBot como canal principal',
            whatsapp_baileys: NODE_ENV === 'production' ? 'Desabilitado em produção' : 'Disponível',
            keepAlive: 'Ativo'
        },
        routes: {
            health: 'GET /health',
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

// Rota para testar CallMeBot no Render
app.post('/test-callmebot', async (req, res) => {
    try {
        const testMessage = `🧪 *Teste CallMeBot - Render*

⏰ *Data/Hora:* ${new Date().toLocaleString('pt-BR')}
🤖 *Sistema:* MedChat v2.1
☁️ *Plataforma:* Render
🆓 *API:* CallMeBot (Gratuita)
✅ *Status:* Funcionando perfeitamente!

_Teste realizado no Render!_ 🎉`;

        const result = await sendCallMeBotWhatsApp(testMessage);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'CallMeBot funcionando no Render! Verifique seu WhatsApp!',
                api: 'CallMeBot',
                platform: 'Render',
                attempts: result.attempt,
                messageLength: result.messageLength,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                platform: 'Render',
                attempts: result.totalAttempts,
                tip: 'Verifique as variáveis de ambiente no Render Dashboard'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            platform: 'Render'
        });
    }
});

// Rota melhorada para alertas médicos no Render
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
                required: required,
                platform: 'Render'
            });
        }

        // Validar severidade
        const validSeverities = ['baixa', 'media', 'alta', 'critica', 'emergencia'];
        if (!validSeverities.includes(alertData.severity?.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Severidade inválida',
                validOptions: validSeverities,
                platform: 'Render'
            });
        }

        console.log('📋 Render - Processando alerta médico via CallMeBot V2...');
        const result = await sendMedicalAlertCallMeBot(alertData);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Alerta médico enviado via CallMeBot no Render!',
                data: {
                    api: 'CallMeBot V2',
                    platform: 'Render',
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
                error: 'Falha no envio via CallMeBot no Render',
                platform: 'Render',
                details: {
                    error: result.error,
                    totalAttempts: result.totalAttempts
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na rota de alerta V2 no Render:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            platform: 'Render'
        });
    }
});

// Outras rotas...
app.get('/status', (req, res) => {
    res.json({
        platform: 'Render',
        environment: NODE_ENV,
        uptime: process.uptime(),
        callmebot: {
            configured: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) ? '✅ Configurado' : '❌ Não configurado',
            phone: CALLMEBOT_CONFIG.phone ? '✅ Definido' : '❌ Faltando',
            apiKey: CALLMEBOT_CONFIG.apiKey ? '✅ Definido' : '❌ Faltando',
            phoneValid: validatePhoneNumber(CALLMEBOT_CONFIG.phone) ? '✅ Válido' : '❌ Inválido'
        }
    });
});

app.get('/status-callmebot', (req, res) => {
    res.json({
        callmebot: {
            configured: (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) ? '✅ Configurado' : '❌ Não configurado',
            phone: CALLMEBOT_CONFIG.phone ? '✅ Definido' : '❌ Faltando CALLMEBOT_PHONE',
            phoneValid: validatePhoneNumber(CALLMEBOT_CONFIG.phone) ? '✅ Válido' : '❌ Formato inválido',
            apiKey: CALLMEBOT_CONFIG.apiKey ? '✅ Definido' : '❌ Faltando CALLMEBOT_APIKEY',
            api: 'CallMeBot WhatsApp',
            platform: 'Render',
            cost: 'Gratuito',
            limitations: 'Apenas para seu próprio número',
            limits: {
                dailyMessages: '100 mensagens por dia',
                messageLength: '1000 caracteres',
                retries: CALLMEBOT_CONFIG.maxRetries,
                timeout: CALLMEBOT_CONFIG.timeout
            }
        }
    });
});

// ================== INICIALIZAÇÃO RENDER ==================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Servidor MedChat rodando no Render na porta ${PORT}`);
    console.log(`☁️ Ambiente: ${NODE_ENV}`);
    console.log(`📱 URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
    console.log('📱 CallMeBot WhatsApp configurado para Render!');
    console.log('🆓 API Gratuita recomendada para Render!');
    
    // Verificar configuração CallMeBot
    if (CALLMEBOT_CONFIG.phone && CALLMEBOT_CONFIG.apiKey) {
        console.log('✅ CallMeBot configurado no Render!');
        if (validatePhoneNumber(CALLMEBOT_CONFIG.phone)) {
            console.log('✅ Número de telefone válido!');
        } else {
            console.log('⚠️ Número de telefone inválido! Use formato: 5581999999999');
        }
    } else {
        console.log('⚠️ CallMeBot não configurado! Configure as variáveis no Render Dashboard');
    }

    console.log('\n🎉 MedChat pronto no Render!');
});
