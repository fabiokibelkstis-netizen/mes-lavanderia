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

// Rota para listar todos os Tipos de OS
app.get('/api/tipos-os', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tipos_os ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar tipos de OS:', err);
        res.status(500).json({ mensagem: 'Erro ao buscar tipos de OS' });
    }
});

// Rota para cadastrar um novo Tipo de OS
app.post('/api/tipos-os', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ mensagem: 'Nome é obrigatório' });

    try {
        const result = await pool.query(
            'INSERT INTO tipos_os (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING RETURNING *',
            [nome.trim()]
        );
        res.status(201).json({ sucesso: true, tipo: result.rows[0] });
    } catch (err) {
        console.error('Erro ao cadastrar tipo de OS:', err);
        res.status(500).json({ mensagem: 'Erro ao cadastrar tipo de OS' });
    }
});

// Buscar lista de Taras de Gaiolas
app.get('/api/taras-gaiolas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM taras_gaiolas ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ mensagem: 'Erro ao buscar taras' });
    }
});

// Cadastrar nova Tara de Gaiola
app.post('/api/taras-gaiolas', async (req, res) => {
    const { nome, pesoTara } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO taras_gaiolas (nome, peso_tara) VALUES ($1, $2) RETURNING *',
            [nome.trim(), parseFloat(pesoTara)]
        );
        res.status(201).json({ sucesso: true, tara: result.rows[0] });
    } catch (err) {
        res.status(500).json({ mensagem: 'Erro ao cadastrar tara' });
    }
});

// Rota de Autenticação / Login
app.post('/api/login', (req, res) => {
    const { senha } = req.body;

    // Digite aqui a sua nova senha desejada:
    const SENHA_GERENCIA = "SUA_NOVA_SENHA_AQUI";

    if (senha === SENHA_GERENCIA) {
        return res.json({ sucesso: true, token: "session_token_dz_2026" });
    } else {
        return res.status(401).json({ sucesso: false, mensagem: "Senha incorreta!" });
    }
});

// Rota para listar todos os Clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clientes ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        res.status(500).json({ mensagem: 'Erro ao buscar clientes' });
    }
});

// Rota para cadastrar um novo Cliente
app.post('/api/clientes', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ mensagem: 'Nome do cliente é obrigatório' });

    try {
        const result = await pool.query(
            'INSERT INTO clientes (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING RETURNING *',
            [nome.trim()]
        );
        res.status(201).json({ sucesso: true, cliente: result.rows[0] });
    } catch (err) {
        console.error('Erro ao cadastrar cliente:', err);
        res.status(500).json({ mensagem: 'Erro ao cadastrar cliente' });
    }
});

// ==========================================
// ROTAS DE CLIENTES (EDIÇÃO E REMOÇÃO)
// ==========================================

// Atualizar nome do Cliente
app.put('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ mensagem: 'Nome é obrigatório' });

    try {
        const result = await pool.query(
            'UPDATE clientes SET nome = $1 WHERE id = $2 RETURNING *',
            [nome.trim(), id]
        );
        res.json({ sucesso: true, cliente: result.rows[0] });
    } catch (err) {
        console.error('Erro ao editar cliente:', err);
        res.status(500).json({ mensagem: 'Erro ao editar cliente' });
    }
});

// Excluir Cliente
app.delete('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        res.json({ sucesso: true, mensagem: 'Cliente excluído com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir cliente:', err);
        res.status(500).json({ mensagem: 'Erro ao excluir cliente' });
    }
});

// ==========================================
// ROTAS DE TARAS DE GAIOLAS (CADASTRO E EDIÇÃO)
// ==========================================

// Cadastrar / Atualizar Tara de Gaiola
app.post('/api/taras-gaiolas', async (req, res) => {
    const { nome, pesoTara } = req.body;
    if (!nome || pesoTara === undefined) {
        return res.status(400).json({ mensagem: 'Nome e peso da tara são obrigatórios' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO taras_gaiolas (nome, peso_tara) 
             VALUES ($1, $2) 
             ON CONFLICT (nome) DO UPDATE SET peso_tara = EXCLUDED.peso_tara 
             RETURNING *`,
            [nome.trim(), parseFloat(pesoTara)]
        );
        res.status(201).json({ sucesso: true, tara: result.rows[0] });
    } catch (err) {
        console.error('Erro ao cadastrar tara:', err);
        res.status(500).json({ mensagem: 'Erro ao cadastrar tara' });
    }
});

// Listar todos os usuários
app.get('/api/usuarios', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, usuario, nivel_acesso FROM usuarios ORDER BY nome ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        res.status(500).json({ mensagem: 'Erro ao buscar usuários' });
    }
});

// Cadastrar novo usuário
app.post('/api/usuarios', async (req, res) => {
    const { nome, usuario, senha, nivelAcesso } = req.body;
    if (!nome || !usuario || !senha || !nivelAcesso) {
        return res.status(400).json({ mensagem: 'Todos os campos são obrigatórios' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO usuarios (nome, usuario, senha, nivel_acesso) VALUES ($1, $2, $3, $4) RETURNING id, nome, usuario, nivel_acesso',
            [nome.trim(), usuario.trim().toLowerCase(), senha, nivelAcesso]
        );
        res.status(201).json({ sucesso: true, usuario: result.rows[0] });
    } catch (err) {
        console.error('Erro ao cadastrar usuário:', err);
        res.status(500).json({ mensagem: 'Erro ou usuário já existente' });
    }
});

// Alterar nível de acesso ou senha do usuário
app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, nivelAcesso, senha } = req.body;

    try {
        if (senha) {
            await pool.query(
                'UPDATE usuarios SET nome = $1, nivel_acesso = $2, senha = $3 WHERE id = $4',
                [nome.trim(), nivelAcesso, senha, id]
            );
        } else {
            await pool.query(
                'UPDATE usuarios SET nome = $1, nivel_acesso = $2 WHERE id = $3',
                [nome.trim(), nivelAcesso, id]
            );
        }
        res.json({ sucesso: true, mensagem: 'Usuário atualizado com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        res.status(500).json({ mensagem: 'Erro ao atualizar usuário' });
    }
});

// Excluir usuário
app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        res.json({ sucesso: true, mensagem: 'Usuário removido' });
    } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        res.status(500).json({ mensagem: 'Erro ao excluir usuário' });
    }
});

// Listar OS que já foram recebidas mas ainda não foram expedidas
app.get('/api/os-pendentes-expedicao', async (req, res) => {
    try {
        const query = `
            SELECT id, cliente, numero_os, tipo_os, data_coleta, peso_coleta, qtd_gaiolas 
            FROM apontamentos 
            WHERE peso_entrega = 0 
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ mensagem: 'Erro ao buscar OS pendentes' });
    }
});

// Salvar a Pesagem de Expedição
app.post('/api/salvar-expedicao', async (req, res) => {
    const { apontamentoId, pesoTotalExpedicao, gaiolas } = req.body;
    const clientBD = await pool.connect();

    try {
        await clientBD.query('BEGIN');

        // 1. Atualiza o peso de entrega na tabela principal
        await clientBD.query(
            'UPDATE apontamentos SET peso_entrega = $1 WHERE id = $2',
            [pesoTotalExpedicao, apontamentoId]
        );

        // 2. Insere as gaiolas da expedição
        const queryGaiola = `
            INSERT INTO apontamentos_gaiolas (apontamento_id, numero_gaiola, tipo_gaiola, peso_bruto, peso_tara, peso_liquido, fase)
            VALUES ($1, $2, $3, $4, $5, $6, 'expedicao');
        `;
        for (const g of gaiolas) {
            await clientBD.query(queryGaiola, [
                apontamentoId, g.numero, g.tipoGaiola, g.pesoBruto, g.pesoTara, g.pesoLiquido
            ]);
        }

        await clientBD.query('COMMIT');
        res.status(200).json({ sucesso: true, mensagem: 'Expedição finalizada com sucesso!' });
    } catch (err) {
        await clientBD.query('ROLLBACK');
        res.status(500).json({ mensagem: 'Erro ao processar expedição' });
    } finally {
        clientBD.release();
    }
});