const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Página principal
app.get('/', (req, res) => {
    res.json({
        message: '🏥 MedChat - Dr. Alberto ATUALIZADO',
        timestamp: new Date().toISOString(),
        doctor: 'Dr. Alberto Silva (+5581986509040)',
        status: 'Funcionando'
    });
});

// Teste simples
app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Teste funcionando!',
        doctor: 'Dr. Alberto Silva (+5581986509040)'
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

// Teste Telegram
app.get('/test-telegram', async (req, res) => {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `🧪 Teste Dr. Alberto\n⏰ ${new Date().toLocaleString('pt-BR')}\n✅ Sistema funcionando!`,
            parse_mode: 'HTML'
        });
        
        res.json({
            success: true,
            message: '✅ Telegram enviado para Dr. Alberto!',
            telegram: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Sistema de alertas
app.post('/send-whatsapp', async (req, res) => {
    try {
        const { severity = 'Alto', patientName = 'João Silva', score = 95 } = req.body;
        
        const message = `🚨 ALERTA: ${severity}\n👤 Paciente: ${patientName}\n📊 Score: ${score}\n⏰ ${new Date().toLocaleString('pt-BR')}`;
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        
        res.json({
            success: true,
            message: 'Alerta enviado para Dr. Alberto!',
            telegram: response.data,
            confirmations: ['📱 Telegram enviado para Dr. Alberto (+5581986509040)']
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor na porta ${PORT}`);
});
