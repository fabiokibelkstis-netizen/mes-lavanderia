const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

// String de conexão direta do Supabase
// Substitua [SUA_SENHA] e [SEU_PROJETO] pelos dados do seu painel Supabase
const connectionString = 'postgresql://postgres.gpplwgegiiuihxwzndrz:Fabiokibe@300376@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';


const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// Teste de conexão
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Erro ao conectar ao Supabase:', err.message);
    } else {
        console.log('✅ Conectado com sucesso ao Supabase!');
        release();
    }
});

// Rota de Autenticação / Login
app.post('/api/login', (req, res) => {
    const { senha } = req.body;

    // Defina a senha de acesso da gerência aqui
    const SENHA_GERENCIA = "dz2026gerencia";

    if (senha === SENHA_GERENCIA) {
        return res.json({ sucesso: true, token: "session_token_dz_2026" });
    } else {
        return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta!" });
    }
});

// Rota de Apontamento
app.post('/api/apontamento', async (req, res) => {
    const { data, pesoColeta, pesoEntrega } = req.body;

    try {
        const query = `
            INSERT INTO producao_diaria (data, peso_coleta_kg, peso_entrega_kg)
            VALUES ($1, $2, $3)
            ON CONFLICT (data) 
            DO UPDATE SET 
                peso_coleta_kg = EXCLUDED.peso_coleta_kg,
                peso_entrega_kg = EXCLUDED.peso_entrega_kg;
        `;
        await pool.query(query, [data, pesoColeta || 0, pesoEntrega || 0]);
        res.json({ status: 'sucesso', mensagem: 'Apontamento gravado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'erro', mensagem: 'Erro ao salvar no banco.' });
    }
});

// Rota de Busca de Métricas
app.get('/api/metrics/:data', async (req, res) => {
    const { data } = req.params;

    try {
        const result = await pool.query('SELECT * FROM producao_diaria WHERE data = $1', [data]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ mensagem: 'Nenhum registro encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ mensagem: 'Erro ao buscar métricas.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`[MES API] Servidor rodando em http://localhost:${PORT}`);
});