const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Chat IDs dos médicos
const doctors = {
    alberto: {
        name: 'Alberto Silva',
        phone: '+5581986509040',
        chatId: '1648736550'
    },
    agatha: {
        name: 'Agatha Pergentino', 
        phone: '+5581987740434',
        chatId: '8037381649'
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

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 MedChat - Dual Telegram',
        timestamp: new Date().toISOString(),
        doctors: {
            alberto: `${doctors.alberto.phone} → Telegram`,
            agatha: `${doctors.agatha.phone} → Telegram`
        },
        routes: [
            'GET /test-alberto - Testar Alberto',
            'GET /test-agatha - Testar Agatha', 
            'GET /test-both - Testar ambos',
            'POST /notify-both - Notificar ambos'
        ]
    });
});

// Status
app.get('/status', (req, res) => {
    res.json({
        telegram: TELEGRAM_BOT_TOKEN ? '✅ OK' : '❌ Faltando',
        doctors: [
            {
                name: doctors.alberto.name,
                phone: doctors.alberto.phone,
                chatId: doctors.alberto.chatId,
                status: 'Aguardando teste'
            },
            {
                name: doctors.agatha.name,
                phone: doctors.agatha.phone, 
                chatId: doctors.agatha.chatId,
                status: 'Funcionando'
            }
        ]
    });
});

// Teste Alberto
app.get('/test-alberto', async (req, res) => {
    try {
        const message = `🧪 <b>Teste para Alberto</b>

👤 <b>Nome:</b> Alberto Silva  
📱 <b>WhatsApp:</b> +5581986509040
💬 <b>Chat ID:</b> ${doctors.alberto.chatId}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Se recebeu, seu Telegram está funcionando!</i>`;

        const result = await sendTelegram(doctors.alberto.chatId, message);
        
        res.json({
            success: true,
            message: '📱 **Mensagem enviada para Alberto (+5581986509040) via Telegram!**',
            telegram: {
                messageId: result.message_id,
                chatId: doctors.alberto.chatId
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            chatId: doctors.alberto.chatId,
            suggestion: 'Alberto precisa reativar o bot @lbertoBot'
        });
    }
});

// Teste Agatha
app.get('/test-agatha', async (req, res) => {
    try {
        const message = `🧪 <b>Teste para Agatha</b>

👤 <b>Nome:</b> Agatha Pergentino
📱 <b>WhatsApp:</b> +5581987740434  
💬 <b>Chat ID:</b> ${doctors.agatha.chatId}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Se recebeu, seu Telegram está funcionando!</i>`;

        const result = await sendTelegram(doctors.agatha.chatId, message);
        
        res.json({
            success: true,
            message: '📱 **Mensagem enviada para Agatha (+5581987740434) via Telegram!**',
            telegram: {
                messageId: result.message_id,
                chatId: doctors.agatha.chatId
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Teste ambos
app.get('/test-both', async (req, res) => {
    try {
        const results = [];
        const confirmations = [];
        const errors = [];

        // Alberto
        try {
            const albertoMsg = `🧪 <b>Teste Sistema Dual</b>
👤 <b>Para:</b> Alberto Silva
📱 <b>WhatsApp:</b> +5581986509040
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
✅ <b>Sistema:</b> Funcionando!`;

            const albertoResult = await sendTelegram(doctors.alberto.chatId, albertoMsg);
            results.push({
                doctor: 'Alberto',
                messageId: albertoResult.message_id,
                status: 'Enviado'
            });
            confirmations.push('📱 **Telegram enviado para Alberto (+5581986509040) com sucesso!**');
        } catch (error) {
            errors.push(`Alberto: ${error.message}`);
        }

        // Agatha
        try {
            const agathaMsg = `🧪 <b>Teste Sistema Dual</b>
👤 <b>Para:</b> Agatha Pergentino
📱 <b>WhatsApp:</b> +5581987740434
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
✅ <b>Sistema:</b> Funcionando!`;

            const agathaResult = await sendTelegram(doctors.agatha.chatId, agathaMsg);
            results.push({
                doctor: 'Agatha',
                messageId: agathaResult.message_id,
                status: 'Enviado'
            });
            confirmations.push('📱 **Telegram enviado para Agatha (+5581987740434) com sucesso!**');
        } catch (error) {
            errors.push(`Agatha: ${error.message}`);
        }

        res.json({
            success: true,
            message: 'Teste enviado para ambos os médicos!',
            confirmations: confirmations,
            results: results,
            errors: errors.length > 0 ? errors : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Notificar ambos (POST)
app.post('/notify-both', async (req, res) => {
    try {
        const { severity = 'Alto', patientName = 'João Silva', cpf = '123.456.789-00', phone = '+5581999999999', score = 95 } = req.body;
        
        const baseMessage = `🚨 <b>ALERTA MÉDICO</b>

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName}
📄 <b>CPF:</b> ${cpf}
📞 <b>Contato:</b> ${phone}
📊 <b>Score de Risco:</b> ${score}
⏰ <b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR')}

⚠️ <i>Ação necessária conforme protocolo hospitalar.</i>`;

        const results = [];
        const confirmations = [];
        const errors = [];

        // Alberto
        try {
            const albertoMessage = `${baseMessage}

👨‍⚕️ <b>Médico:</b> Alberto Silva
📱 <b>WhatsApp:</b> +5581986509040`;

            const albertoResult = await sendTelegram(doctors.alberto.chatId, albertoMessage);
            results.push({
                doctor: 'Alberto Silva',
                phone: '+5581986509040',
                messageId: albertoResult.message_id,
                status: 'Enviado'
            });
            confirmations.push('📱 **Notificação enviada para Alberto (+5581986509040) via Telegram com sucesso!**');
        } catch (error) {
            errors.push(`Alberto: ${error.message}`);
        }

        // Agatha
        try {
            const agathaMessage = `${baseMessage}

👩‍⚕️ <b>Médica:</b> Agatha Pergentino
📱 <b>WhatsApp:</b> +5581987740434`;

            const agathaResult = await sendTelegram(doctors.agatha.chatId, agathaMessage);
            results.push({
                doctor: 'Agatha Pergentino',
                phone: '+5581987740434',
                messageId: agathaResult.message_id,
                status: 'Enviado'
            });
            confirmations.push('📱 **Notificação enviada para Agatha (+5581987740434) via Telegram com sucesso!**');
        } catch (error) {
            errors.push(`Agatha: ${error.message}`);
        }

        res.json({
            success: true,
            message: `Alerta "${severity}" enviado para ambos os médicos!`,
            patient: {
                name: patientName,
                cpf: cpf,
                phone: phone,
                score: score
            },
            confirmations: confirmations,
            results: results,
            errors: errors.length > 0 ? errors : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota original compatível
app.post('/send-whatsapp', async (req, res) => {
    // Redirecionar para notify-both
    return app._router.handle({
        ...req,
        url: '/notify-both',
        method: 'POST'
    }, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Dual Telegram na porta ${PORT}`);
    console.log('📱 Alberto: +5581986509040 → Telegram');
    console.log('📱 Agatha: +5581987740434 → Telegram');
});
