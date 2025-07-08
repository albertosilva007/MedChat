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

// Configuração dos médicos e seus contatos
const doctors = {
    'dr_jose': {
        name: 'Dr. José',
        whatsapp: '+5581987654321',
        telegram: '1648736550'
    },
    'dr_alberto': {
        name: 'Dr. Alberto Silva',
        whatsapp: '+5581986509040',
        telegram: '1648736550'
    },
    'dr_novo': {
        name: 'Dr. Novo Médico',
        whatsapp: '+5581987740434',
        telegram: 'PENDING' // Será atualizado após descobrir o Chat ID
    },
    'dra_maria': {
        name: 'Dra. Maria Santos',
        whatsapp: '+5581999888777',
        telegram: '987654321'
    },
    'dr_ana': {
        name: 'Dra. Ana Costa',
        whatsapp: '+5581555444333',
        telegram: '123456789'
    }
};

// Função para enviar mensagem para o Telegram
async function sendTelegramMessage(message, chatId = null) {
    const targetChatId = chatId || TELEGRAM_CHAT_ID;
    
    if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
        throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        const response = await axios.post(telegramUrl, {
            chat_id: targetChatId,
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
async function sendWhatsAppMessage(message, phoneNumber = null) {
    const targetPhone = phoneNumber || '+5581986509040';
    
    try {
        const whatsappMessage = await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${targetPhone}`,
            body: message
        });
        
        console.log('✅ Mensagem WhatsApp enviada:', whatsappMessage.sid);
        return whatsappMessage;
    } catch (error) {
        console.error('❌ Erro ao enviar WhatsApp:', error.message);
        throw error;
    }
}

// Função para enviar notificação personalizada por médico
async function sendDoctorNotification(doctorKey, severity, patientName, cpf, phone, score) {
    const doctor = doctors[doctorKey];
    if (!doctor) {
        throw new Error(`Médico não encontrado: ${doctorKey}`);
    }

    const results = { whatsapp: null, telegram: null, errors: [] };

    // Mensagem personalizada para WhatsApp
    const whatsappMessage = `🏥 ALERTA MÉDICO - ${doctor.name}
    
🚨 Severidade: ${severity}
👤 Paciente: ${patientName || 'Não informado'}
📄 CPF: ${cpf || 'Não informado'}
📞 Contato: ${phone || 'Não informado'}
📊 Score de Risco: ${score}
⏰ Data/Hora: ${new Date().toLocaleString('pt-BR')}

⚠️ Ação necessária conforme protocolo hospitalar.`;

    // Mensagem personalizada para Telegram
    const telegramMessage = `🏥 <b>ALERTA MÉDICO</b> - ${doctor.name}

🚨 <b>Severidade:</b> ${severity}
👤 <b>Paciente:</b> ${patientName || 'Não informado'}
📄 <b>CPF:</b> ${cpf || 'Não informado'}
📞 <b>Contato:</b> ${phone || 'Não informado'}
📊 <b>Score de Risco:</b> ${score}
⏰ <b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR')}

⚠️ <i>Ação necessária conforme protocolo hospitalar.</i>`;

    // Enviar WhatsApp
    if (doctor.whatsapp && accountSid && authToken) {
        try {
            const whatsappResult = await sendWhatsAppMessage(whatsappMessage, doctor.whatsapp);
            results.whatsapp = {
                sid: whatsappResult.sid,
                to: doctor.whatsapp,
                doctor: doctor.name,
                status: 'Enviado'
            };
            console.log(`✅ WhatsApp enviado para ${doctor.name} (${doctor.whatsapp}):`, whatsappResult.sid);
        } catch (error) {
            results.errors.push(`WhatsApp para ${doctor.name}: ${error.message}`);
            console.error(`❌ Erro WhatsApp ${doctor.name}:`, error.message);
        }
    }

    // Enviar Telegram
    if (doctor.telegram && doctor.telegram !== 'PENDING' && TELEGRAM_BOT_TOKEN) {
        try {
            const response = await sendTelegramMessage(telegramMessage, doctor.telegram);
            results.telegram = {
                messageId: response.message_id,
                chatId: doctor.telegram,
                doctor: doctor.name,
                status: 'Enviado'
            };
            console.log(`✅ Telegram enviado para ${doctor.name} (${doctor.telegram}):`, response.message_id);
        } catch (error) {
            results.errors.push(`Telegram para ${doctor.name}: ${error.message}`);
            console.error(`❌ Erro Telegram ${doctor.name}:`, error.message);
        }
    }

    return results;
}

// Rota principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 Servidor MedChat funcionando!',
        timestamp: new Date().toISOString(),
        routes: {
            status: 'GET /status - Verificar configurações',
            sendWhatsApp: 'POST /send-whatsapp - Enviar alerta completo', 
            testTelegram: 'POST /test-telegram - Testar apenas Telegram',
            notifyDoctor: 'POST /notify-doctor - Notificar médico específico',
            notifyMultiple: 'POST /notify-multiple-doctors - Notificar múltiplos médicos',
            doctors: 'GET /doctors - Listar médicos disponíveis',
            telegramUsers: 'GET /telegram/users - Ver usuários do bot',
            setupDoctor: 'POST /setup-new-doctor - Configurar novo médico'
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
        },
        doctors: {
            total: Object.keys(doctors).length,
            configured: Object.values(doctors).filter(d => d.telegram !== 'PENDING').length,
            pending: Object.values(doctors).filter(d => d.telegram === 'PENDING').length
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

// Rota principal para enviar alertas (compatibilidade)
app.post('/send-whatsapp', async (req, res) => {
    console.log('📥 Recebido:', req.body);
    const { severity, patientName, cpf, phone, score, whatsappNumber, telegramChatId } = req.body;

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
            const targetWhatsApp = whatsappNumber || '+5581986509040';
            results.whatsapp = await sendWhatsAppMessage(whatsappMessage, targetWhatsApp);
        } catch (error) {
            console.error('❌ Erro WhatsApp:', error.message);
            results.errors.push(`WhatsApp: ${error.message}`);
        }
    } else {
        results.errors.push('WhatsApp: Configuração incompleta');
    }

    // Enviar para Telegram
    if (TELEGRAM_BOT_TOKEN) {
        try {
            console.log('📱 Enviando mensagem para o Telegram...');
            const targetTelegramChatId = telegramChatId || TELEGRAM_CHAT_ID;
            results.telegram = await sendTelegramMessage(telegramMessage, targetTelegramChatId);
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

// Rota para notificar médico específico
app.post('/notify-doctor', async (req, res) => {
    console.log('📥 Notificação médica recebida:', req.body);
    const { doctorKey, severity, patientName, cpf, phone, score } = req.body;

    // Validação
    if (!doctorKey) {
        return res.status(400).json({
            success: false,
            error: 'Campo obrigatório: doctorKey',
            availableDoctors: Object.keys(doctors)
        });
    }

    if (!doctors[doctorKey]) {
        return res.status(400).json({
            success: false,
            error: `Médico não encontrado: ${doctorKey}`,
            availableDoctors: Object.keys(doctors)
        });
    }

    try {
        const results = await sendDoctorNotification(doctorKey, severity, patientName, cpf, phone, score);
        const doctor = doctors[doctorKey];
        
        // Mensagens de confirmação personalizadas
        const confirmationMessages = [];
        
        if (results.whatsapp) {
            confirmationMessages.push(`📱 **Notificação enviada ao ${doctor.name} via WhatsApp com sucesso!**`);
        }
        
        if (results.telegram) {
            confirmationMessages.push(`📱 **Notificação enviada ao ${doctor.name} via Telegram com sucesso!**`);
        }

        const hasSuccess = results.whatsapp || results.telegram;
        
        if (hasSuccess) {
            res.status(200).json({
                success: true,
                message: `Notificação enviada para ${doctor.name}!`,
                confirmations: confirmationMessages,
                doctor: {
                    key: doctorKey,
                    name: doctor.name,
                    contacts: {
                        whatsapp: doctor.whatsapp,
                        telegram: doctor.telegram
                    }
                },
                results: results,
                errors: results.errors.length > 0 ? results.errors : null
            });
        } else {
            res.status(500).json({
                success: false,
                error: `Falha ao notificar ${doctor.name}`,
                errors: results.errors
            });
        }
    } catch (error) {
        console.error('❌ Erro ao notificar médico:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para notificar múltiplos médicos
app.post('/notify-multiple-doctors', async (req, res) => {
    console.log('📥 Notificação múltipla recebida:', req.body);
    const { doctorKeys, severity, patientName, cpf, phone, score } = req.body;

    if (!doctorKeys || !Array.isArray(doctorKeys)) {
        return res.status(400).json({
            success: false,
            error: 'Campo obrigatório: doctorKeys (array)',
            availableDoctors: Object.keys(doctors)
        });
    }

    const allResults = [];
    const confirmationMessages = [];
    const errors = [];

    for (const doctorKey of doctorKeys) {
        if (!doctors[doctorKey]) {
            errors.push(`Médico não encontrado: ${doctorKey}`);
            continue;
        }

        try {
            const results = await sendDoctorNotification(doctorKey, severity, patientName, cpf, phone, score);
            const doctor = doctors[doctorKey];
            
            allResults.push({
                doctor: doctor.name,
                key: doctorKey,
                results: results
            });

            if (results.whatsapp) {
                confirmationMessages.push(`📱 **Notificação enviada ao ${doctor.name} via WhatsApp com sucesso!**`);
            }
            
            if (results.telegram) {
                confirmationMessages.push(`📱 **Notificação enviada ao ${doctor.name} via Telegram com sucesso!**`);
            }

            if (results.errors.length > 0) {
                errors.push(...results.errors);
            }
        } catch (error) {
            errors.push(`Erro ao notificar ${doctorKey}: ${error.message}`);
        }
    }

    res.status(200).json({
        success: true,
        message: `Processo de notificação concluído para ${doctorKeys.length} médico(s)`,
        confirmations: confirmationMessages,
        results: allResults,
        summary: {
            doctorsNotified: allResults.length,
            totalConfirmations: confirmationMessages.length,
            totalErrors: errors.length
        },
        errors: errors.length > 0 ? errors : null
    });
});

// Rota para listar médicos disponíveis
app.get('/doctors', (req, res) => {
    const doctorsList = Object.keys(doctors).map(key => ({
        key: key,
        name: doctors[key].name,
        whatsapp: doctors[key].whatsapp,
        telegram: doctors[key].telegram,
        status: doctors[key].telegram === 'PENDING' ? 'Aguardando configuração' : 'Ativo'
    }));

    res.json({
        message: 'Médicos disponíveis para notificação',
        count: doctorsList.length,
        doctors: doctorsList
    });
});

// Rota para listar usuários que interagiram com o bot
app.get('/telegram/users', async (req, res) => {
    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
        const response = await axios.get(telegramUrl);
        
        const users = new Map();
        
        if (response.data.result) {
            response.data.result.forEach(update => {
                if (update.message && update.message.from) {
                    const user = update.message.from;
                    
                    users.set(user.id, {
                        chatId: user.id,
                        firstName: user.first_name,
                        lastName: user.last_name || '',
                        username: user.username || '',
                        lastMessage: update.message.text || '',
                        date: new Date(update.message.date * 1000).toLocaleString('pt-BR')
                    });
                }
            });
        }
        
        const userList = Array.from(users.values());
        
        res.json({
            message: 'Usuários que interagiram com o bot',
            count: userList.length,
            users: userList,
            instructions: {
                step1: '📱 Pessoa deve procurar @lbertoBot no Telegram',
                step2: '✅ Clicar em Start e enviar mensagem',
                step3: '🔍 Use esta rota para ver o Chat ID',
                step4: '⚙️ Configure o Chat ID no código dos médicos'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para testar Chat ID específico
app.post('/telegram/test-chat', async (req, res) => {
    const { chatId, doctorName } = req.body;
    
    if (!chatId) {
        return res.status(400).json({
            success: false,
            error: 'Chat ID é obrigatório'
        });
    }
    
    const testMessage = `🧪 <b>Teste de Conexão - MedChat</b>

👋 Olá, ${doctorName || 'Doutor(a)'}!

✅ <b>Chat ID:</b> <code>${chatId}</code>
⏰ <b>Data:</b> ${new Date().toLocaleString('pt-BR')}
🤖 <b>Bot:</b> @lbertoBot

🏥 Se você recebeu esta mensagem, sua configuração está funcionando perfeitamente!

🔔 <i>Agora você receberá alertas médicos importantes.</i>`;

    try {
        const response = await sendTelegramMessage(testMessage, chatId);
        
        res.json({
            success: true,
            message: `✅ Mensagem de teste enviada com sucesso!`,
            chatId: chatId,
            messageId: response.message_id,
            confirmation: `📱 **Notificação enviada via Telegram com sucesso!**`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Verifique se o Chat ID está correto e se o usuário iniciou o bot (@lbertoBot)'
        });
    }
});

// Rota específica para configurar o novo médico (+5581987740434)
app.post('/setup-new-doctor', async (req, res) => {
    const { chatId } = req.body;
    
    if (!chatId) {
        return res.status(400).json({
            success: false,
            error: 'Chat ID é obrigatório',
            instructions: [
                '1. Pessoa deve procurar @lbertoBot no Telegram',
                '2. Clicar em Start e enviar mensagem',
                '3. Usar GET /telegram/users para ver o Chat ID',
                '4. Usar este endpoint com o Chat ID encontrado'
            ]
        });
    }
    
    // Atualizar o médico no objeto (em produção, salvar em banco de dados)
    doctors['dr_novo'].telegram = chatId;
    
    const welcomeMessage = `🏥 <b>Bem-vindo ao Sistema MedChat!</b>

👋 Olá! Seu WhatsApp <b>+5581987740434</b> foi configurado com sucesso!

✅ <b>Chat ID:</b> <code>${chatId}</code>
📱 <b>WhatsApp:</b> +5581987740434
🤖 <b>Bot:</b> @lbertoBot

🔔 <b>Você receberá notificações sobre:</b>
• 🚨 Alertas de pacientes por severidade
• 🏥 Emergências médicas
• 📊 Atualizações do sistema

⚠️ <i>Mantenha as notificações ativadas para não perder alertas importantes.</i>

🏥 <b>Sistema MedChat - Sempre conectado à saúde!</b>`;

    try {
        const response = await sendTelegramMessage(welcomeMessage, chatId);
        
        res.json({
            success: true,
            message: '🎉 Novo médico configurado com sucesso!',
            doctor: {
                name: 'Dr. Novo Médico',
                whatsapp: '+5581987740434',
                telegram: chatId,
                status: 'Ativo'
            },
            confirmation: '📱 **Notificação enviada ao +5581987740434 via Telegram com sucesso!**',
            messageId: response.message_id,
            nextSteps: [
                'Médico já pode receber notificações',
                'Use doctorKey: "dr_novo" para enviar alertas',
                'Teste com POST /notify-doctor'
            ]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para testar notificação do novo médico
app.post('/test-new-doctor', async (req, res) => {
    const { severity = 'Teste', patientName = 'Paciente Teste', score = 85 } = req.body;
    
    if (doctors['dr_novo'].telegram === 'PENDING') {
        return res.status(400).json({
            success: false,
            error: 'Chat ID ainda não configurado para +5581987740434',
            instructions: [
                '1. Pessoa deve interagir com @lbertoBot',
                '2. Use GET /telegram/users para ver Chat ID',
                '3. Use POST /setup-new-doctor com o Chat ID'
            ]
        });
    }
    
    try {
        const results = await sendDoctorNotification('dr_novo', severity, patientName, '123.456.789-00', '+5581987740434', score);
        
        const confirmationMessages = [];
        if (results.whatsapp) {
            confirmationMessages.push('📱 **Notificação enviada ao +5581987740434 via WhatsApp com sucesso!**');
        }
        if (results.telegram) {
            confirmationMessages.push('📱 **Notificação enviada ao +5581987740434 via Telegram com sucesso!**');
        }
        
        res.json({
            success: true,
            message: 'Teste enviado para +5581987740434!',
            confirmations: confirmationMessages,
            results: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
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
            'GET /doctors',
            'GET /telegram/users',
            'POST /send-whatsapp',
            'POST /test-telegram',
            'POST /notify-doctor',
            'POST /notify-multiple-doctors',
            'POST /telegram/test-chat',
            'POST /setup-new-doctor',
            'POST /test-new-doctor'
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
    console.log(`👥 Médicos: http://localhost:${PORT}/doctors`);
    console.log(`📱 Teste Telegram: POST http://localhost:${PORT}/test-telegram`);
    console.log('=====================================');
});
