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

console.log('=== INICIANDO SERVIDOR ===');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'OK' : 'FALTANDO');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID ? 'OK' : 'FALTANDO');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Médicos configurados
const doctors = {
    'dr_alberto': {
        name: 'Dr. Alberto Silva',
        whatsapp: '+5581986509040',
        telegram: '1648736550'
    },
    'dr_novo': {
        name: 'Dr. Novo',
        whatsapp: '+5581987740434',
        telegram: 'PENDING'
    }
};

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 MedChat funcionando!',
        timestamp: new Date().toISOString(),
        status: 'OK'
    });
});

// Status
app.get('/status', (req, res) => {
    res.json({
        telegram: TELEGRAM_BOT_TOKEN ? '✅ OK' : '❌ Faltando',
        whatsapp: accountSid ? '✅ OK' : '❌ Faltando',
        doctors: Object.keys(doctors).length
    });
});

// Ver usuários do Telegram
app.get('/telegram/users', async (req, res) => {
    try {
        if (!TELEGRAM_BOT_TOKEN) {
            return res.status(400).json({ error: 'Token do bot não configurado' });
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
        const response = await axios.get(url);
        
        const users = new Map();
        
        if (response.data.result) {
            response.data.result.forEach(update => {
                if (update.message && update.message.from) {
                    const user = update.message.from;
                    users.set(user.id, {
                        chatId: user.id,
                        nome: user.first_name,
                        ultimaMensagem: update.message.text || '',
                        data: new Date(update.message.date * 1000).toLocaleString('pt-BR')
                    });
                }
            });
        }
        
        res.json({
            total: users.size,
            usuarios: Array.from(users.values())
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configurar médico
app.post('/setup-doctor', async (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) {
            return res.status(400).json({ error: 'chatId obrigatório' });
        }

        // Atualizar médico
        doctors['dr_novo'].telegram = chatId;
        
        // Enviar boas-vindas
        const message = `🏥 Bem-vindo ao MedChat!
        
✅ Chat ID: ${chatId}
📱 WhatsApp: +5581987740434
        
Configuração concluída!`;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: chatId,
            text: message
        });

        res.json({
            success: true,
            message: 'Médico configurado!',
            chatId: chatId,
            telegramId: response.data.message_id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enviar notificação
app.post('/notify', async (req, res) => {
    try {
        const { doctorKey, message: customMessage } = req.body;
        
        if (!doctors[doctorKey]) {
            return res.status(400).json({ 
                error: 'Médico não encontrado',
                available: Object.keys(doctors)
            });
        }

        const doctor = doctors[doctorKey];
        const message = customMessage || `🚨 Alerta teste para ${doctor.name}`;
        
        const results = {};

        // WhatsApp
        if (doctor.whatsapp && accountSid) {
            try {
                const whatsapp = await client.messages.create({
                    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                    to: `whatsapp:${doctor.whatsapp}`,
                    body: message
                });
                results.whatsapp = `Enviado: ${whatsapp.sid}`;
            } catch (error) {
                results.whatsapp = `Erro: ${error.message}`;
            }
        }

        // Telegram
        if (doctor.telegram && doctor.telegram !== 'PENDING') {
            try {
                const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                const telegram = await axios.post(url, {
                    chat_id: doctor.telegram,
                    text: message
                });
                results.telegram = `Enviado: ${telegram.data.message_id}`;
            } catch (error) {
                results.telegram = `Erro: ${error.message}`;
            }
        }

        res.json({
            success: true,
            doctor: doctor.name,
            results: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota original para compatibilidade
app.post('/send-whatsapp', async (req, res) => {
    try {
        const { severity, patientName, score } = req.body;
        
        const message = `🚨 ${severity}
👤 ${patientName}
📊 Score: ${score}`;

        // Enviar para padrão
        const whatsapp = await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:+5581986509040`,
            body: message
        });

        res.json({ success: true, sid: whatsapp.sid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando na porta ${PORT}`);
    console.log('✅ Servidor iniciado com sucesso!');
});
