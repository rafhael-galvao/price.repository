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
    const text = msg.text?.body?.trim().toLowerCase() || "";

    console.log("FROM:", from);
    console.log("TEXT:", text);

    let resposta;

    // 🔹 Ignorar mensagens muito curtas
    if (text.length < 3) {
      resposta = "Digite o nome de um produto para consultar preços 🙂";
      await enviarMensagem(from, resposta);
      return res.sendStatus(200);
    }
    
    // 🔹 Detectar saudações comuns
    const saudacoes = ["oi", "oii", "olá", "ola", "bom dia", "boa tarde", "boa noite"];
    
    if (saudacoes.includes(text)) {
      resposta = "Olá! 👋\nDigite o nome do produto que deseja consultar.";
      await enviarMensagem(from, resposta);
      return res.sendStatus(200);
    }

    // 🔎 CONSULTA NO SUPABASE COM JOIN
    const { data, error } = await supabase
    .from('precos')
    .select(`
      preco_normal,
      preco_promocional,
      moeda,
      fonte,
      url,
      data_coleta,
      mercados (
        nome,
        bairro,
        cidade
      )
    `)
    .eq('produto_id', produtoId);


      if (error) {
        console.log(error);
        resposta = "Erro ao consultar preços 😕";
      } 
      else if (!data || data.length === 0) {
        resposta = `Não encontrei preços para *${text}*`;
      } 
      else {
        // Remove preços inválidos (0 ou null)
        const precosValidos = data.filter(p => {
          const valor = p.preco_promocional ?? p.preco_normal;
          return valor && Number(valor) > 0;
        });
        
        if (precosValidos.length === 0) {
          resposta = `Não encontrei preços válidos para *${text}*`;
        } else {
        
          precosValidos.sort((a, b) => {
            const precoA = a.preco_promocional ?? a.preco_normal;
            const precoB = b.preco_promocional ?? b.preco_normal;
            return precoA - precoB;
          });
        
        const melhor = precosValidos[0];
        const outros = precosValidos.slice(1, 4);

        const melhorValor = melhor.preco_promocional ?? melhor.preco_normal;

        const nomeProduto = melhor.produtos?.nome || text;

        resposta = `🥇 *Melhor preço para ${nomeProduto}*\n\n`;
        resposta += `🏪 ${melhor.mercados.nome}\n`;
        resposta += `📍 ${melhor.mercados.bairro} - ${melhor.mercados.cidade}\n`;
        resposta += `💰 ${melhor.moeda || "R$"} ${Number(melhorValor).toFixed(2)}\n`;
        resposta += `🔗 Fonte: ${melhor.fonte}\n`;
        if (melhor.url) resposta += `🌐 ${melhor.url}\n`;
        resposta += `📅 Coletado em: ${melhor.data_coleta}\n\n`;

        if (outros.length > 0) {
          resposta += `Outras opções:\n\n`;
          outros.forEach((p, i) => {
            const valor = p.preco_promocional ?? p.preco_normal;
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
