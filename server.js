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
// Usando Chat ID da Agatha como padrão (sabemos que funciona)
const TELEGRAM_CHAT_ID_DEFAULT = '8037381649'; // Agatha

// Médicos configurados
const doctors = {
    'dr_alberto': {
        name: 'Dr. Alberto Silva',
        whatsapp: '+5581986509040',
        telegram: '1648736550' // Quando resolver, volta a funcionar
    },
    'agatha': {
        name: 'Agatha Pergentino',
        whatsapp: '+5581987740434',
        telegram: '8037381649'
    }
};

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
        defaultTelegram: '8037381649 (Agatha - funcionando)',
        doctors: Object.keys(doctors)
    });
});

// Status
app.get('/status', (req, res) => {
    res.json({
        telegram: TELEGRAM_BOT_TOKEN ? '✅ OK' : '❌ Faltando',
        whatsapp: accountSid ? '✅ OK' : '❌ Faltando',
        defaultChatId: TELEGRAM_CHAT_ID_DEFAULT,
        doctors: Object.keys(doctors).map(key => ({
            key: key,
            name: doctors[key].name,
            whatsapp: doctors[key].whatsapp,
            telegram: doctors[key].telegram,
            status: doctors[key].telegram === '8037381649' ? 'Funcionando' : 'Aguardando'
        }))
    });
});

// Testar Agatha especificamente
app.post('/test-agatha', async (req, res) => {
    try {
        const message = req.body.message || `🧪 <b>Teste MedChat para Agatha</b>

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

// Enviar alerta completo para Agatha
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
            doctor: {
                name: 'Agatha Pergentino',
                whatsapp: '+5581987740434',
                telegram: '8037381649'
            },
            results: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota original (agora usando Agatha como padrão para Telegram)
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

        // WhatsApp para Dr. Alberto (número padrão)
        try {
            const whatsapp = await sendWhatsApp('+5581986509040', whatsappMessage);
            results.whatsapp = { sid: whatsapp.sid, status: 'Enviado para Dr. Alberto' };
        } catch (error) {
            results.whatsapp = { error: error.message };
        }

        // Telegram para Agatha (que sabemos que funciona)
        try {
            const telegram = await sendTelegram(TELEGRAM_CHAT_ID_DEFAULT, telegramMessage);
            results.telegram = { messageId: telegram.message_id, status: 'Enviado para Agatha' };
        } catch (error) {
            results.telegram = { error: error.message };
        }

        res.json({
            success: true,
            message: 'Alertas enviados!',
            note: 'WhatsApp para Dr. Alberto, Telegram para Agatha (temporário)',
            results: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Testar sistema completo
app.post('/test-system', async (req, res) => {
    try {
        const testAlert = {
            severity: 'Teste Sistema',
            patientName: 'Paciente Teste',
            cpf: '000.000.000-00',
            phone: '+5581999999999',
            score: 99
        };

        // Simular chamada para rota original
        const results = {};
        const confirmations = [];

        // WhatsApp Dr. Alberto
        try {
            const whatsapp = await sendWhatsApp('+5581986509040', `🧪 Teste WhatsApp Dr. Alberto\n⏰ ${new Date().toLocaleString('pt-BR')}`);
            results.whatsapp = whatsapp.sid;
            confirmations.push('📱 **WhatsApp enviado para Dr. Alberto com sucesso!**');
        } catch (error) {
            results.whatsappError = error.message;
        }

        // Telegram Agatha
        try {
            const telegram = await sendTelegram('8037381649', `🧪 <b>Teste Telegram Agatha</b>\n⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}`);
            results.telegram = telegram.message_id;
            confirmations.push('📱 **Telegram enviado para Agatha com sucesso!**');
        } catch (error) {
            results.telegramError = error.message;
        }

        res.json({
            success: true,
            message: 'Teste do sistema completo!',
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
    console.log('📱 Telegram padrão: Agatha (8037381649)');
    console.log('📱 WhatsApp padrão: Dr. Alberto (+5581986509040)');
});
