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

console.log('=== SERVIDOR MEDCHAT ===');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'OK' : 'FALTANDO');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Função para enviar Telegram
async function sendTelegram(chatId, message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`✅ Telegram enviado para ${chatId}:`, response.data.message_id);
        return response.data;
    } catch (error) {
        console.error(`❌ Erro Telegram ${chatId}:`, error.message);
        throw error;
    }
}

// Função para enviar WhatsApp
async function sendWhatsApp(phone, message) {
    try {
        const result = await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${phone}`,
            body: message
        });
        console.log(`✅ WhatsApp enviado para ${phone}:`, result.sid);
        return result;
    } catch (error) {
        console.error(`❌ Erro WhatsApp ${phone}:`, error.message);
        throw error;
    }
}

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 MedChat funcionando!',
        timestamp: new Date().toISOString(),
        status: 'OK',
        routes: [
            'GET /test-agatha - Testar Telegram Agatha',
            'GET /test-quick - Teste rápido',
            'GET /test-alert - Alerta completo',
            'GET /test-whatsapp - Testar WhatsApp Dr. Alberto',
            'POST /send-whatsapp - Sistema original'
        ]
    });
});

// Status
app.get('/status', (req, res) => {
    res.json({
        telegram: TELEGRAM_BOT_TOKEN ? '✅ OK' : '❌ Faltando',
        whatsapp: accountSid ? '✅ OK' : '❌ Faltando',
        agathaChat: '8037381649',
        pastorChat: '1648736550',
        defaultTelegram: 'Agatha (funcionando)',
        defaultWhatsApp: 'Dr. Alberto'
    });
});

// TESTE 1: Telegram para Agatha (GET - funciona no navegador)
app.get('/test-agatha', async (req, res) => {
    try {
        const message = `🧪 <b>Teste MedChat para Agatha</b>

⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
📱 <b>WhatsApp:</b> +5581987740434
✅ <b>Status:</b> Sistema funcionando perfeitamente!

🏥 <i>Notificação teste enviada com sucesso!</i>`;

        const result = await sendTelegram('8037381649', message);
        
        res.json({
            success: true,
            message: '📱 **Notificação enviada para Agatha (+5581987740434) via Telegram com sucesso!**',
            telegram: {
                messageId: result.message_id,
                chatId: '8037381649',
                to: 'Agatha Pergentino'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// TESTE 2: Teste rápido (GET)
app.get('/test-quick', async (req, res) => {
    try {
        const telegram = await sendTelegram('8037381649', `🧪 <b>Teste Rápido MedChat</b>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
✅ <b>Sistema:</b> Funcionando!`);

        res.json({
            success: true,
            message: '📱 **Notificação enviada para Agatha via Telegram com sucesso!**',
            telegram: telegram.message_id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TESTE 3: Alerta completo (GET)
app.get('/test-alert', async (req, res) => {
    try {
        const telegramMessage = `🚨 <b>ALERTA TESTE</b> - Sistema MedChat

🚨 <b>Severidade:</b> Alto
👤 <b>Paciente:</b> João Silva (Teste)
📄 <b>CPF:</b> 123.456.789-00
📞 <b>Contato:</b> +5581999999999
📊 <b>Score:</b> 95
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

⚠️ <i>Este é um teste do sistema de alertas.</i>`;

        const telegram = await sendTelegram('8037381649', telegramMessage);

        res.json({
            success: true,
            message: '🚨 **Alerta teste enviado para Agatha (+5581987740434) via Telegram com sucesso!**',
            telegram: telegram.message_id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TESTE 4: WhatsApp para Dr. Alberto (GET)
app.get('/test-whatsapp', async (req, res) => {
    try {
        const message = `🧪 Teste WhatsApp MedChat
⏰ Data: ${new Date().toLocaleString('pt-BR')}
✅ Sistema funcionando!`;

        const whatsapp = await sendWhatsApp('+5581986509040', message);

        res.json({
            success: true,
            message: '📱 **WhatsApp enviado para Dr. Alberto (+5581986509040) com sucesso!**',
            whatsapp: whatsapp.sid
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// TESTE 5: Sistema completo (GET)
app.get('/test-system', async (req, res) => {
    try {
        const results = {};
        const confirmations = [];

        // Telegram para Agatha
        try {
            const telegram = await sendTelegram('8037381649', `🧪 <b>Teste Sistema Completo</b>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
📱 <b>Para:</b> Agatha (Telegram)
✅ <b>Status:</b> OK`);
            results.telegram = telegram.message_id;
            confirmations.push('📱 **Telegram enviado para Agatha com sucesso!**');
        } catch (error) {
            results.telegramError = error.message;
        }

        // WhatsApp para Dr. Alberto
        try {
            const whatsapp = await sendWhatsApp('+5581986509040', `🧪 Teste Sistema Completo
⏰ Data: ${new Date().toLocaleString('pt-BR')}
📱 Para: Dr. Alberto (WhatsApp)
✅ Status: OK`);
            results.whatsapp = whatsapp.sid;
            confirmations.push('📱 **WhatsApp enviado para Dr. Alberto com sucesso!**');
        } catch (error) {
            results.whatsappError = error.message;
        }

        res.json({
            success: true,
            message: 'Teste do sistema completo executado!',
            confirmations: confirmations,
            results: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Alerta completo para Agatha
app.post('/notify-agatha', async (req, res) => {
    try {
        const { severity = 'Alto', patientName = 'João Silva', cpf = '123.456.789-00', phone = '+5581999999999', score = 95 } = req.body;
        
        const whatsappMessage = `🏥 ALERTA MÉDICO - Agatha Pergentino
        
🚨 Severidade: ${severity}
👤 Paciente: ${patientName}
📄 CPF: ${cpf}
📞 Contato: ${phone}
📊 Score de Risco: ${score}
⏰ Data/Hora: ${new Date().toLocaleString('pt-BR')}

⚠️ Ação necessária conforme protocolo hospitalar.`;

        const telegramMessage = `🏥 <b>ALERTA MÉDICO</b> - Agatha Pergentino

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName}
📄 <b>CPF:</b> ${cpf}
📞 <b>Contato:</b> ${phone}
📊 <b>Score de Risco:</b> ${score}
⏰ <b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR')}

⚠️ <i>Ação necessária conforme protocolo hospitalar.</i>`;

        const results = {};
        const confirmations = [];

        // WhatsApp
        try {
            const whatsapp = await sendWhatsApp('+5581987740434', whatsappMessage);
            results.whatsapp = { sid: whatsapp.sid, status: 'Enviado' };
            confirmations.push('📱 **Notificação enviada para Agatha (+5581987740434) via WhatsApp com sucesso!**');
        } catch (error) {
            results.whatsapp = { error: error.message };
        }

        // Telegram
        try {
            const telegram = await sendTelegram('8037381649', telegramMessage);
            results.telegram = { messageId: telegram.message_id, status: 'Enviado' };
            confirmations.push('📱 **Notificação enviada para Agatha (+5581987740434) via Telegram com sucesso!**');
        } catch (error) {
            results.telegram = { error: error.message };
        }

        res.json({
            success: true,
            message: 'Alertas enviados para Agatha!',
            confirmations: confirmations,
            results: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST: Rota original (sistema híbrido)
app.post('/send-whatsapp', async (req, res) => {
    try {
        const { severity, patientName, cpf, phone, score } = req.body;
        
        const whatsappMessage = `🚨 Alerta: ${severity}
👤 Paciente: ${patientName || 'Não informado'}
📄 CPF: ${cpf || 'Não informado'}
📞 Contato: ${phone || 'Não informado'}
📊 Score: ${score}
⏰ Data: ${new Date().toLocaleString('pt-BR')}`;

        const telegramMessage = `🚨 <b>Alerta:</b> ${severity}
👤 <b>Paciente:</b> ${patientName || 'Não informado'}
📄 <b>CPF:</b> ${cpf || 'Não informado'}
📞 <b>Contato:</b> ${phone || 'Não informado'}
📊 <b>Score:</b> ${score}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}`;

        const results = {};
        const confirmations = [];

        // WhatsApp para Dr. Alberto
        try {
            const whatsapp = await sendWhatsApp('+5581986509040', whatsappMessage);
            results.whatsapp = { sid: whatsapp.sid, status: 'Enviado para Dr. Alberto' };
            confirmations.push('📱 **WhatsApp enviado para Dr. Alberto (+5581986509040) com sucesso!**');
        } catch (error) {
            results.whatsapp = { error: error.message };
        }

        // Telegram para Agatha
        try {
            const telegram = await sendTelegram('8037381649', telegramMessage);
            results.telegram = { messageId: telegram.message_id, status: 'Enviado para Agatha' };
            confirmations.push('📱 **Telegram enviado para Agatha (+5581987740434) com sucesso!**');
        } catch (error) {
            results.telegram = { error: error.message };
        }

        res.json({
            success: true,
            message: 'Sistema híbrido: WhatsApp Dr.Alberto + Telegram Agatha',
            confirmations: confirmations,
            results: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando na porta ${PORT}`);
    console.log('📱 Telegram: Agatha (8037381649)');
    console.log('📱 WhatsApp: Dr. Alberto (+5581986509040)');
    console.log('✅ Rotas GET disponíveis para teste no navegador');
});
