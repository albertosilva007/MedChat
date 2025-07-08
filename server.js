const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verificação das variáveis de ambiente
console.log('=== CONFIGURAÇÕES ===');
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID);
console.log('====================');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Função para enviar mensagem para o Telegram
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        const response = await axios.post(telegramUrl, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        
        console.log('✅ Mensagem enviada para o Telegram:', response.data.message_id);
        return response.data;
    } catch (error) {
        console.error('❌ Erro ao enviar para o Telegram:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Função para enviar mensagem para o WhatsApp
async function sendWhatsAppMessage(message) {
    try {
        const whatsappMessage = await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:+5581986509040`,
            body: message
        });
        
        console.log('✅ Mensagem WhatsApp enviada:', whatsappMessage.sid);
        return whatsappMessage;
    } catch (error) {
        console.error('❌ Erro ao enviar WhatsApp:', error.message);
        throw error;
    }
}

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 Servidor MedChat funcionando!',
        timestamp: new Date().toISOString(),
        routes: {
            status: 'GET /status - Verificar configurações',
            sendWhatsApp: 'POST /send-whatsapp - Enviar alerta completo', 
            testTelegram: 'POST /test-telegram - Testar apenas Telegram'
        }
    });
});

// Rota para verificar configurações
app.get('/status', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        telegram: {
            botToken: TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não configurado',
            chatId: TELEGRAM_CHAT_ID ? '✅ Configurado' : '❌ Não configurado'
        },
        whatsapp: {
            accountSid: accountSid ? '✅ Configurado' : '❌ Não configurado',
            authToken: authToken ? '✅ Configurado' : '❌ Não configurado',
            phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER ? '✅ Configurado' : '❌ Não configurado'
        }
    });
});

// Rota para testar apenas o Telegram
app.post('/test-telegram', async (req, res) => {
    const testMessage = `🧪 <b>Teste do Telegram</b>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
✅ <b>Status:</b> Sistema funcionando corretamente!
🏥 <b>Servidor:</b> MedChat
👤 <b>Usuário:</b> Pastor Alberto Silva`;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return res.status(500).json({
            success: false,
            error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados',
            config: {
                botToken: TELEGRAM_BOT_TOKEN ? 'Configurado' : 'Não configurado',
                chatId: TELEGRAM_CHAT_ID ? 'Configurado' : 'Não configurado'
            }
        });
    }

    try {
        console.log('🚀 Enviando mensagem de teste para o Telegram...');
        const result = await sendTelegramMessage(testMessage);
        
        res.status(200).json({
            success: true,
            message: 'Mensagem de teste enviada para o Telegram com sucesso!',
            telegram: {
                messageId: result.message_id,
                chatId: result.chat.id
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response ? error.response.data : null
        });
    }
});

// Rota principal para enviar alertas
app.post('/send-whatsapp', async (req, res) => {
    console.log('📥 Recebido:', req.body);
    const { severity, patientName, cpf, phone, score } = req.body;

    // Validação básica
    if (!severity || !score) {
        return res.status(400).json({
            success: false,
            error: 'Campos obrigatórios: severity e score'
        });
    }

    // Formatação da mensagem para WhatsApp
    const whatsappMessage = `🚨 Alerta: ${severity}
👤 Paciente: ${patientName || 'Não informado'}
📄 CPF: ${cpf || 'Não informado'}
📞 Contato: ${phone || 'Não informado'}
📊 Score: ${score}
⏰ Data: ${new Date().toLocaleString('pt-BR')}`;

    // Formatação da mensagem para Telegram (usando HTML)
    const telegramMessage = `🚨 <b>Alerta:</b> ${severity}
👤 <b>Paciente:</b> ${patientName || 'Não informado'}
📄 <b>CPF:</b> ${cpf || 'Não informado'}
📞 <b>Contato:</b> ${phone || 'Não informado'}
📊 <b>Score:</b> ${score}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}`;

    const results = {
        whatsapp: null,
        telegram: null,
        errors: []
    };

    // Enviar para WhatsApp
    if (accountSid && authToken && process.env.TWILIO_WHATSAPP_NUMBER) {
        try {
            console.log('📱 Enviando mensagem pelo WhatsApp...');
            results.whatsapp = await sendWhatsAppMessage(whatsappMessage);
        } catch (error) {
            console.error('❌ Erro WhatsApp:', error.message);
            results.errors.push(`WhatsApp: ${error.message}`);
        }
    } else {
        results.errors.push('WhatsApp: Configuração incompleta');
    }

    // Enviar para Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        try {
            console.log('📱 Enviando mensagem para o Telegram...');
            results.telegram = await sendTelegramMessage(telegramMessage);
        } catch (error) {
            console.error('❌ Erro Telegram:', error.message);
            results.errors.push(`Telegram: ${error.message}`);
        }
    } else {
        results.errors.push('Telegram: Configuração incompleta');
    }

    // Resposta da API
    const hasSuccess = results.whatsapp || results.telegram;
    
    if (hasSuccess) {
        res.status(200).json({
            success: true,
            message: 'Alerta enviado com sucesso!',
            results: {
                whatsapp: results.whatsapp ? { 
                    sid: results.whatsapp.sid,
                    status: 'Enviado'
                } : null,
                telegram: results.telegram ? { 
                    messageId: results.telegram.message_id,
                    status: 'Enviado'
                } : null
            },
            errors: results.errors.length > 0 ? results.errors : null
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Falha ao enviar para ambos os canais',
            errors: results.errors
        });
    }
});

// Middleware para capturar erros 404
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        availableRoutes: [
            'GET /',
            'GET /status',
            'POST /send-whatsapp',
            'POST /test-telegram'
        ]
    });
});

// Middleware para tratamento de erros
app.use((error, req, res, next) => {
    console.error('❌ Erro interno:', error);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`📱 Teste Telegram: POST http://localhost:${PORT}/test-telegram`);
    console.log('=====================================');
});
