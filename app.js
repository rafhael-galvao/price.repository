const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// 🔥 SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

// =====================
// POST - Receber mensagens
// =====================
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\nWebhook received ${timestamp}\n`);

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

      // 🔎 CONSULTA NO SUPABASE COM JOIN
      const { data, error } = await supabase
        .from('precos')
        .select(`
          preco_normal,
          preco_promo,
          moeda,
          fonte,
          url,
          data_coleta,
          produtos!precos_produto_fk ( nome ),
          mercados!precos_mercado_fk(nome)
        `)
        .ilike('produtos.nome', `%${text}%`);

      if (error) {
        console.log(error);
        resposta = "Erro ao consultar preços 😕";
      } 
      else if (!data || data.length === 0) {
        resposta = `Não encontrei preços para *${text}*`;
      } 
      else {
        // Ordena pelo menor preço considerando promo primeiro
        data.sort((a, b) => {
          const precoA = a.preco_promo ?? a.preco_normal;
          const precoB = b.preco_promo ?? b.preco_normal;
          return precoA - precoB;
        });

        const melhor = data[0];
        const outros = data.slice(1, 4);

        const melhorValor = melhor.preco_promo ?? melhor.preco_normal;

        resposta = `🥇 *Melhor preço para ${text}*\n\n`;
        resposta += `🏪 ${melhor.mercados.nome}\n`;
        resposta += `📍 ${melhor.mercados.bairro} - ${melhor.mercados.cidade}\n`;
        resposta += `💰 ${melhor.moeda || "R$"} ${Number(melhorValor).toFixed(2)}\n`;
        resposta += `🔗 Fonte: ${melhor.fonte}\n`;
        if (melhor.url) resposta += `🌐 ${melhor.url}\n`;
        resposta += `📅 Coletado em: ${melhor.data_coleta}\n\n`;

        if (outros.length > 0) {
          resposta += `Outras opções:\n\n`;
          outros.forEach((p, i) => {
            const valor = p.preco_promo ?? p.preco_normal;
            resposta += `${i + 2}️⃣ ${p.mercados.nome}\n`;
            resposta += `💰 ${p.moeda || "R$"} ${Number(valor).toFixed(2)}\n\n`;
          });
        }
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
  console.log(`Listening on port ${port}`);
});
