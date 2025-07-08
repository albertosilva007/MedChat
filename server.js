const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7795497137:AAEYmY3QkpIqFRHBQ66843-x3oGBoIiT6hQ';

// Médicos configurados - APENAS TELEGRAM
const doctors = {
    alberto: {
        name: 'Dr. Alberto Silva',
        phone: '+5581986509040',
        chatId: '1648736550'
    },
    agatha: {
        name: 'Dra. Agatha Pergentino', 
        phone: '+5581987740434',
        chatId: '8037381649'
    }
};

// Função para enviar APENAS Telegram
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
        message: '🏥 MedChat - Apenas Telegram',
        timestamp: new Date().toISOString(),
        system: 'WhatsApp removido - APENAS Telegram',
        doctors: {
            alberto: `${doctors.alberto.name} (${doctors.alberto.phone}) → Telegram`,
            agatha: `${doctors.agatha.name} (${doctors.agatha.phone}) → Telegram`
        },
        routes: [
            'GET /test-alberto - Testar Dr. Alberto',
            'GET /test-agatha - Testar Dra. Agatha', 
            'GET /test-both - Testar ambos',
            'POST /notify-both - Notificar ambos médicos',
            'POST /send-notification - Sistema de alertas'
        ]
    });
});

// Status do sistema
app.get('/status', (req, res) => {
    res.json({
        system: 'APENAS Telegram',
        whatsapp: '❌ Removido',
        telegram: TELEGRAM_BOT_TOKEN ? '✅ Ativo' : '❌ Não configurado',
        doctors: [
            {
                name: doctors.alberto.name,
                phone: doctors.alberto.phone,
                telegram: doctors.alberto.chatId,
                status: '✅ Ativo'
            },
            {
                name: doctors.agatha.name,
                phone: doctors.agatha.phone,
                telegram: doctors.agatha.chatId,
                status: '✅ Ativo'
            }
        ]
    });
});

// Teste Dr. Alberto
app.get('/test-alberto', async (req, res) => {
    try {
        const message = `🧪 <b>Teste Sistema - Dr. Alberto</b>

👨‍⚕️ <b>Médico:</b> Dr. Alberto Silva  
📱 <b>Telefone:</b> +5581986509040
💬 <b>Sistema:</b> APENAS Telegram
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Sistema funcionando perfeitamente!</i>
🚫 <i>WhatsApp removido - apenas Telegram ativo</i>`;

        const result = await sendTelegram(doctors.alberto.chatId, message);
        
        res.json({
            success: true,
            message: '📱 **Notificação enviada para Dr. Alberto (+5581986509040) via Telegram com sucesso!**',
            system: 'APENAS Telegram',
            telegram: {
                messageId: result.message_id,
                chatId: doctors.alberto.chatId,
                doctor: doctors.alberto.name
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Teste Dra. Agatha
app.get('/test-agatha', async (req, res) => {
    try {
        const message = `🧪 <b>Teste Sistema - Dra. Agatha</b>

👩‍⚕️ <b>Médica:</b> Dra. Agatha Pergentino
📱 <b>Telefone:</b> +5581987740434
💬 <b>Sistema:</b> APENAS Telegram
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <i>Sistema funcionando perfeitamente!</i>
🚫 <i>WhatsApp removido - apenas Telegram ativo</i>`;

        const result = await sendTelegram(doctors.agatha.chatId, message);
        
        res.json({
            success: true,
            message: '📱 **Notificação enviada para Dra. Agatha (+5581987740434) via Telegram com sucesso!**',
            system: 'APENAS Telegram',
            telegram: {
                messageId: result.message_id,
                chatId: doctors.agatha.chatId,
                doctor: doctors.agatha.name
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Teste ambos os médicos
app.get('/test-both', async (req, res) => {
    try {
        const results = [];
        const confirmations = [];
        const errors = [];

        // Dr. Alberto
        try {
            const albertoMsg = `🧪 <b>Teste Sistema Completo</b>

👨‍⚕️ <b>Para:</b> Dr. Alberto Silva
📱 <b>Telefone:</b> +5581986509040
💬 <b>Via:</b> Telegram (WhatsApp removido)
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <b>Status:</b> Sistema funcionando!`;

            const albertoResult = await sendTelegram(doctors.alberto.chatId, albertoMsg);
            results.push({ 
                doctor: 'Dr. Alberto Silva', 
                phone: '+5581986509040',
                method: 'Telegram',
                messageId: albertoResult.message_id,
                status: 'Enviado' 
            });
            confirmations.push('📱 **Telegram enviado para Dr. Alberto (+5581986509040) com sucesso!**');
        } catch (error) {
            errors.push(`Dr. Alberto: ${error.message}`);
        }

        // Dra. Agatha
        try {
            const agathaMsg = `🧪 <b>Teste Sistema Completo</b>

👩‍⚕️ <b>Para:</b> Dra. Agatha Pergentino
📱 <b>Telefone:</b> +5581987740434
💬 <b>Via:</b> Telegram (WhatsApp removido)
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}

✅ <b>Status:</b> Sistema funcionando!`;

            const agathaResult = await sendTelegram(doctors.agatha.chatId, agathaMsg);
            results.push({ 
                doctor: 'Dra. Agatha Pergentino', 
                phone: '+5581987740434',
                method: 'Telegram',
                messageId: agathaResult.message_id,
                status: 'Enviado' 
            });
            confirmations.push('📱 **Telegram enviado para Dra. Agatha (+5581987740434) com sucesso!**');
        } catch (error) {
            errors.push(`Dra. Agatha: ${error.message}`);
        }

        res.json({
            success: true,
            message: 'Sistema APENAS Telegram funcionando!',
            system: {
                whatsapp: '🚫 Removido',
                telegram: '✅ Ativo para ambos médicos'
            },
            confirmations: confirmations,
            results: results,
            errors: errors.length > 0 ? errors : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sistema principal de notificações (APENAS Telegram)
app.post('/notify-both', async (req, res) => {
    try {
        const { 
            severity = 'Alto', 
            patientName = 'João Silva', 
            cpf = '123.456.789-00', 
            phone = '+5581999999999', 
            score = 95 
        } = req.body;
        
        const results = [];
        const confirmations = [];
        const errors = [];

        // Mensagem base do alerta
        const baseAlert = `🚨 <b>ALERTA MÉDICO</b>

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName}
📄 <b>CPF:</b> ${cpf}
📞 <b>Contato:</b> ${phone}
📊 <b>Score de Risco:</b> ${score}
⏰ <b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR')}

⚠️ <i>Ação necessária conforme protocolo hospitalar.</i>`;

        // Dr. Alberto - APENAS Telegram
        try {
            const albertoMessage = `${baseAlert}

👨‍⚕️ <b>Médico Responsável:</b> Dr. Alberto Silva
📱 <b>Telefone:</b> +5581986509040
💬 <b>Notificação via:</b> Telegram`;

            const albertoResult = await sendTelegram(doctors.alberto.chatId, albertoMessage);
            results.push({
                doctor: 'Dr. Alberto Silva',
                phone: '+5581986509040',
                method: 'Telegram',
                messageId: albertoResult.message_id,
                status: 'Enviado'
            });
            confirmations.push('📱 **Notificação enviada para Dr. Alberto (+5581986509040) via Telegram com sucesso!**');
        } catch (error) {
            errors.push(`Dr. Alberto: ${error.message}`);
        }

        // Dra. Agatha - APENAS Telegram
        try {
            const agathaMessage = `${baseAlert}

👩‍⚕️ <b>Médica Responsável:</b> Dra. Agatha Pergentino
📱 <b>Telefone:</b> +5581987740434
💬 <b>Notificação via:</b> Telegram`;

            const agathaResult = await sendTelegram(doctors.agatha.chatId, agathaMessage);
            results.push({
                doctor: 'Dra. Agatha Pergentino',
                phone: '+5581987740434',
                method: 'Telegram',
                messageId: agathaResult.message_id,
                status: 'Enviado'
            });
            confirmations.push('📱 **Notificação enviada para Dra. Agatha (+5581987740434) via Telegram com sucesso!**');
        } catch (error) {
            errors.push(`Dra. Agatha: ${error.message}`);
        }

        res.json({
            success: true,
            message: `Alerta "${severity}" enviado para ambos médicos!`,
            system: {
                method: 'APENAS Telegram',
                whatsapp: '🚫 Removido',
                telegram: '✅ Ativo'
            },
            patient: {
                name: patientName,
                cpf: cpf,
                phone: phone,
                score: score,
                severity: severity
            },
            confirmations: confirmations,
            results: results,
            errors: errors.length > 0 ? errors : null
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Rota compatível com sistema original (sem WhatsApp)
app.post('/send-whatsapp', async (req, res) => {
    // Renomear para send-notification e redirecionar para notify-both
    return res.json({
        message: 'Rota renomeada: WhatsApp removido do sistema',
        newRoute: 'POST /notify-both',
        system: 'APENAS Telegram',
        redirect: 'Use /notify-both para enviar notificações'
    });
});

// Nova rota principal para notificações
app.post('/send-notification', async (req, res) => {
    // Redirecionar para notify-both
    req.url = '/notify-both';
    req.method = 'POST';
    return app._router.handle(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor MedChat na porta ${PORT}`);
    console.log('📱 Sistema: APENAS Telegram');
    console.log('🚫 WhatsApp: Removido');
    console.log('✅ Dr. Alberto: +5581986509040 → Telegram');
    console.log('✅ Dra. Agatha: +5581987740434 → Telegram');
});
