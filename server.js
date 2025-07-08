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

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 Servidor MedChat funcionando!',
        timestamp: new Date().toISOString(),
        routes: {
            status: 'GET /status',
            sendWhatsApp: 'POST /send-whatsapp', 
            testTelegram: 'POST /test-telegram'
        }
    });
});

// Rota para verificar configurações
app.get('/status', (req, res) => {
    res.json({
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

// Função para enviar mensagem para o Telegram
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
    
    console.log('✅ Mensagem enviada para o Telegram:', response.data.message_id);
    return response.data;
}

// Rota para testar apenas o Telegram
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

// Rota original para WhatsApp
app.post('/send-whatsapp', async (req, res) => {
    console.log('Recebido:', req.body);
    const { severity, patientName, cpf, phone, score } = req.body;

    const whatsappMessage = `🚨 Alerta: ${severity}
👤 Paciente: ${patientName || 'Não informado'}
CPF: ${cpf || 'Não informado'}
📞 Contato: ${phone || 'Não informado'}
📊 Score: ${score}`;

    const telegramMessage = `🚨 <b>Alerta:</b> ${severity}
👤 <b>Paciente:</b> ${patientName || 'Não informado'}
<b>CPF:</b> ${cpf || 'Não informado'}
📞 <b>Contato:</b> ${phone || 'Não informado'}
📊 <b>Score:</b> ${score}`;

    try {
        // Enviar WhatsApp
        if (accountSid && authToken) {
            const whatsappResult = await client.messages.create({
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:+5581986509040`,
                body: whatsappMessage
            });
            console.log('WhatsApp enviado:', whatsappResult.sid);
        }

        // Enviar Telegram
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            await sendTelegramMessage(telegramMessage);
        }

        res.status(200).json({ success: true, message: 'Alertas enviados!' });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
