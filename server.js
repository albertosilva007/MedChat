const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

console.log('=== SERVIDOR MÍNIMO ===');
console.log('TELEGRAM_BOT_TOKEN:', TELEGRAM_BOT_TOKEN ? 'OK' : 'FALTANDO');
console.log('TELEGRAM_CHAT_ID:', TELEGRAM_CHAT_ID ? 'OK' : 'FALTANDO');

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 MedChat - Dr. Alberto',
        timestamp: new Date().toISOString(),
        doctor: 'Dr. Alberto Silva (+5581986509040)',
        status: 'Funcionando',
        routes: [
            'GET /test - Teste simples',
            'GET /test-telegram - Testar Telegram',
            'POST /send-alert - Enviar alerta'
        ]
    });
});

// Teste simples
app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Teste funcionando!',
        doctor: 'Dr. Alberto Silva (+5581986509040)',
        timestamp: new Date().toISOString()
    });
});

// Status
app.get('/status', (req, res) => {
    res.json({
        telegram: TELEGRAM_BOT_TOKEN ? '✅ OK' : '❌ Faltando',
        chatId: TELEGRAM_CHAT_ID ? '✅ OK' : '❌ Faltando',
        doctor: 'Dr. Alberto Silva (+5581986509040)'
    });
});

// Função para enviar Telegram
async function sendTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram enviado:', response.data.message_id);
        return response.data;
    } catch (error) {
        console.error('❌ Erro Telegram:', error.message);
        throw error;
    }
}

// Teste Telegram
app.get('/test-telegram', async (req, res) => {
    try {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            return res.status(500).json({
                success: false,
                error: 'Telegram não configurado'
            });
        }

        const message = `🧪 <b>Teste Dr. Alberto</b>

👨‍⚕️ <b>Médico:</b> Dr. Alberto Silva
📱 <b>WhatsApp:</b> +5581986509040
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Sistema funcionando!</i>`;

        const result = await sendTelegram(message);
        
        res.json({
            success: true,
            message: '✅ **Telegram enviado para Dr. Alberto com sucesso!**',
            telegram: {
                messageId: result.message_id,
                chatId: TELEGRAM_CHAT_ID
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Sistema de alertas
app.post('/send-alert', async (req, res) => {
    try {
        const { severity = 'Alto', patientName = 'João Silva', score = 95 } = req.body;

        if (!severity || !score) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: severity e score'
            });
        }

        const alertMessage = `🚨 <b>ALERTA MÉDICO</b>

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName}
📊 <b>Score:</b> ${score}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

👨‍⚕️ <b>Para:</b> Dr. Alberto Silva (+5581986509040)`;

        let telegramResult = null;
        let error = null;

        // Tentar enviar Telegram
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            try {
                telegramResult = await sendTelegram(alertMessage);
            } catch (err) {
                error = err.message;
            }
        }

        res.json({
            success: !!telegramResult,
            message: telegramResult ? 'Alerta enviado para Dr. Alberto!' : 'Falha ao enviar',
            doctor: 'Dr. Alberto Silva (+5581986509040)',
            results: {
                telegram: telegramResult ? {
                    messageId: telegramResult.message_id,
                    status: 'Enviado'
                } : null,
                whatsapp: {
                    status: 'Não configurado nesta versão'
                }
            },
            confirmations: telegramResult ? [
                '📱 **Telegram enviado para Dr. Alberto com sucesso!**'
            ] : [],
            error: error
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Compatibilidade com rota original
app.post('/send-whatsapp', (req, res) => {
    // Redirecionar para send-alert
    req.url = '/send-alert';
    return app._router.handle(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor mínimo na porta ${PORT}`);
    console.log('👨‍⚕️ Dr. Alberto Silva (+5581986509040)');
    console.log('📱 Telegram configurado:', TELEGRAM_CHAT_ID ? 'Sim' : 'Não');
});
