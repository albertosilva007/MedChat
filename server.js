const express = require('express');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7795497137:AAEYmY3QkpIqFRHBQ66843-x3oGBoIiT6hQ';

// Função para enviar Telegram usando fetch nativo
async function sendTelegram(chatId, message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();
        
        if (data.ok) {
            console.log(`✅ Telegram enviado para ${chatId}:`, data.result.message_id);
            return data.result;
        } else {
            throw new Error(data.description || 'Erro no Telegram');
        }
    } catch (error) {
        console.error(`❌ Erro Telegram ${chatId}:`, error.message);
        throw error;
    }
}

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 MedChat - Dual Telegram (Fetch)',
        timestamp: new Date().toISOString(),
        doctors: {
            alberto: '+5581986509040 → Telegram',
            agatha: '+5581987740434 → Telegram'
        }
    });
});

// Teste Alberto
app.get('/test-alberto', async (req, res) => {
    try {
        const message = `🧪 <b>Teste Alberto (Fetch)</b>

👤 <b>Nome:</b> Alberto Silva  
📱 <b>WhatsApp:</b> +5581986509040
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Sistema funcionando com fetch!</i>`;

        const result = await sendTelegram('1648736550', message);
        
        res.json({
            success: true,
            message: '📱 **Mensagem enviada para Alberto (+5581986509040) via Telegram!**',
            telegram: {
                messageId: result.message_id,
                chatId: '1648736550'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Teste Agatha
app.get('/test-agatha', async (req, res) => {
    try {
        const message = `🧪 <b>Teste Agatha (Fetch)</b>

👤 <b>Nome:</b> Agatha Pergentino
📱 <b>WhatsApp:</b> +5581987740434  
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Sistema funcionando com fetch!</i>`;

        const result = await sendTelegram('8037381649', message);
        
        res.json({
            success: true,
            message: '📱 **Mensagem enviada para Agatha (+5581987740434) via Telegram!**',
            telegram: {
                messageId: result.message_id,
                chatId: '8037381649'
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
            const albertoMsg = `🧪 <b>Teste Dual System</b>
👤 <b>Para:</b> Alberto Silva
📱 <b>WhatsApp:</b> +5581986509040
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}`;

            const albertoResult = await sendTelegram('1648736550', albertoMsg);
            results.push({ doctor: 'Alberto', messageId: albertoResult.message_id });
            confirmations.push('📱 **Telegram enviado para Alberto (+5581986509040) com sucesso!**');
        } catch (error) {
            errors.push(`Alberto: ${error.message}`);
        }

        // Agatha
        try {
            const agathaMsg = `🧪 <b>Teste Dual System</b>
👤 <b>Para:</b> Agatha Pergentino
📱 <b>WhatsApp:</b> +5581987740434
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}`;

            const agathaResult = await sendTelegram('8037381649', agathaMsg);
            results.push({ doctor: 'Agatha', messageId: agathaResult.message_id });
            confirmations.push('📱 **Telegram enviado para Agatha (+5581987740434) com sucesso!**');
        } catch (error) {
            errors.push(`Agatha: ${error.message}`);
        }

        res.json({
            success: true,
            message: 'Sistema Dual funcionando!',
            confirmations: confirmations,
            results: results,
            errors: errors.length > 0 ? errors : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sistema de alertas
app.post('/notify-both', async (req, res) => {
    try {
        const { severity = 'Alto', patientName = 'João Silva', cpf = '123.456.789-00', phone = '+5581999999999', score = 95 } = req.body;
        
        const results = [];
        const confirmations = [];
        const errors = [];

        // Alberto
        try {
            const albertoMessage = `🚨 <b>ALERTA MÉDICO</b>

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName}
📄 <b>CPF:</b> ${cpf}
📞 <b>Contato:</b> ${phone}
📊 <b>Score:</b> ${score}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

👨‍⚕️ <b>Para:</b> Alberto Silva (+5581986509040)`;

            const albertoResult = await sendTelegram('1648736550', albertoMessage);
            results.push({ doctor: 'Alberto Silva', messageId: albertoResult.message_id });
            confirmations.push('📱 **Notificação enviada para Alberto (+5581986509040) via Telegram com sucesso!**');
        } catch (error) {
            errors.push(`Alberto: ${error.message}`);
        }

        // Agatha
        try {
            const agathaMessage = `🚨 <b>ALERTA MÉDICO</b>

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName}
📄 <b>CPF:</b> ${cpf}
📞 <b>Contato:</b> ${phone}
📊 <b>Score:</b> ${score}
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

👩‍⚕️ <b>Para:</b> Agatha Pergentino (+5581987740434)`;

            const agathaResult = await sendTelegram('8037381649', agathaMessage);
            results.push({ doctor: 'Agatha Pergentino', messageId: agathaResult.message_id });
            confirmations.push('📱 **Notificação enviada para Agatha (+5581987740434) via Telegram com sucesso!**');
        } catch (error) {
            errors.push(`Agatha: ${error.message}`);
        }

        res.json({
            success: true,
            message: `Alerta "${severity}" processado!`,
            confirmations: confirmations,
            results: results,
            errors: errors.length > 0 ? errors : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Dual Telegram (Fetch) na porta ${PORT}`);
});
