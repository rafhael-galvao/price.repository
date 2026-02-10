const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// =====================
// GET - Verificação webhook
// =====================
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

//SIMULAR BANCO

const produtos = [
  { nome: "arroz", mercado: "Mercado A", preco: 22.90 },
  { nome: "arroz", mercado: "Mercado B", preco: 21.50 },
  { nome: "arroz", mercado: "Mercado C", preco: 23.10 },
  { nome: "feijao", mercado: "Mercado A", preco: 8.90 },
  { nome: "feijao", mercado: "Mercado B", preco: 7.40 }
];

//===================

// =====================
// POST - Receber mensagens
// =====================
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body?.trim().toLowerCase();

    console.log("FROM:", from);
    console.log("TEXT:", text);

    let resposta;

    if (!text) {
      resposta = "Envie o nome de um produto 🙂";
    } 
    else if (text === "olá" || text === "ola") {
      resposta = "Olá! 👋\nDigite o nome do produto para consultar preços.";
    } 
    else {
      const achados = produtos
        .filter(p => p.nome.includes(text))
        .sort((a, b) => a.preco - b.preco);
    
      if (achados.length === 0) {
        resposta = `Não achei preços para: ${text}`;
      } else {
        resposta = `Melhores preços para *${text}*:\n\n`;
        achados.slice(0, 3).forEach(p => {
          resposta += `🏪 ${p.mercado}\n💰 R$ ${p.preco.toFixed(2)}\n\n`;
        });
      }
    }

    await enviarMensagem(from, resposta);
  } catch (err) {
    console.error("Erro:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// =====================
// Enviar mensagem
// =====================
async function enviarMensagem(to, message) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`;

  console.log("Enviando mensagem para:", to);

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// =====================
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
