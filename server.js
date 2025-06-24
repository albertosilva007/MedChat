const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para parsear application/x-www-form-urlencoded

console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Configurado' : 'Não configurado');
console.log('TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

app.post('/send-whatsapp', async (req, res) => {
    console.log('Recebido:', req.body);
    const { severity, patientName, cpf, phone, score } = req.body;

    try {
        const message = await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:+5581986509040`, // Número do Dr. José
            contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e', // ContentSid do curl
            contentVariables: JSON.stringify({
                1: severity,
                2: patientName || 'Não informado',
                3: cpf || 'Não informado',
                4: phone || 'Não informado',
                5: score.toString()
            })
        });
        console.log('Mensagem enviada:', message.sid);
        res.status(200).json({ success: true, messageSid: message.sid });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/webhook-whatsapp', (req, res) => {
    console.log('Webhook recebido:', req.body);
    const message = req.body.Body || 'Mensagem não encontrada';
    const from = req.body.From || 'Remetente desconhecido';

    const twiml = `
         <Response>
           <Message>Mensagem recebida: ${message}. Obrigado por sua resposta!</Message>
         </Response>
       `;
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
});

app.post('/status-callback', (req, res) => {
    console.log('Status callback recebido:', req.body);
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});