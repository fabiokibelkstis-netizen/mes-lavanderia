const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Define a raiz do projeto no Render (/opt/render/project/src ou raiz local)
const ROOT_DIR = process.cwd();

// Carrega variáveis de ambiente se o dotenv estiver disponível
try {
    require('dotenv').config();
} catch (e) {
    console.log('Dotenv não encontrado, utilizando variáveis do ambiente.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// =================================================================
// 1. MIDDLEWARES GLOBAIS E ARQUIVOS ESTÁTICOS
// =================================================================
app.use(cors());
app.use(express.json());

// Serve os arquivos da pasta public localizada na raiz do projeto
app.use(express.static(path.join(ROOT_DIR, 'public')));

// =================================================================
// 2. CONEXÃO COM O BANCO DE DADOS (POSTGRESQL / SUPABASE)
// =================================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Erro ao conectar ao banco PostgreSQL:', err.stack);
    }
    console.log('✅ Conectado ao banco de dados PostgreSQL com sucesso!');
    release();
});

// =================================================================
// 3. IMPORTAÇÃO DE ROTAS EXTERNAS (PLANO ROUTES)
// =================================================================
try {
    let planoRoutes;
    try {
        planoRoutes = require(path.join(ROOT_DIR, 'routes', 'planoRoutes'));
    } catch (e) {
        planoRoutes = require(path.join(ROOT_DIR, 'src', 'routes', 'planoRoutes'));
    }
    app.use('/api', planoRoutes);
    console.log('✅ Módulo planoRoutes carregado com sucesso!');
} catch (err) {
    console.warn('⚠️ Aviso: Não foi possível carregar o módulo planoRoutes:', err.message);
}

// =================================================================
// 4. ROTAS DE CADASTRO GERAIS (CLIENTES, TIPOS DE OS, TARAS)
// =================================================================

// Clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/clientes', async (req, res) => {
    const { nome } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO clientes (nome) VALUES ($1) RETURNING *', [nome]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    try {
        await pool.query('UPDATE clientes SET nome = $1 WHERE id = $2', [nome, id]);
        res.json({ mensagem: 'Cliente atualizado' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Tipos de OS Produção
app.get('/api/tipos-os', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tipos_os ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/tipos-os', async (req, res) => {
    const { nome } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO tipos_os (nome) VALUES ($1) RETURNING *', [nome]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Taras de Gaiolas
app.get('/api/taras-gaiolas', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM taras_gaiolas ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/taras-gaiolas', async (req, res) => {
    const { nome, pesoTara } = req.body;
    try {
        const query = `
            INSERT INTO taras_gaiolas (nome, peso_tara) 
            VALUES ($1, $2)
            ON CONFLICT (nome) DO UPDATE SET peso_tara = EXCLUDED.peso_tara
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [nome, pesoTara]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// =================================================================
// 5. ROTAS MÓDULO PCM & MANUTENÇÃO INDUSTRIAL
// =================================================================

// Macro Máquinas
app.get('/api/pcm/macro-maquinas', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM macro_maquinas ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/macro-maquinas', async (req, res) => {
    const { nome } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO macro_maquinas (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING RETURNING *',
            [nome]
        );
        res.status(201).json(rows[0] || { mensagem: 'Máquina já cadastrada' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Tipos de Componentes
app.get('/api/pcm/macro-componentes', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM macro_componentes ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/macro-componentes', async (req, res) => {
    const { nome } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO macro_componentes (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING RETURNING *',
            [nome]
        );
        res.status(201).json(rows[0] || { mensagem: 'Componente já cadastrado' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Equipamentos / Ativos
app.get('/api/pcm/equipamentos', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM vw_parque_equipamentos ORDER BY tag ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/equipamentos', async (req, res) => {
    const { tag, macro_maquina_id, macro_componente_id, setor, tensao, capacidade, horas_planejadas_dia, observacoes } = req.body;
    try {
        const query = `
            INSERT INTO equipamentos (tag, macro_maquina_id, macro_componente_id, setor, tensao, capacidade, horas_planejadas_dia, observacoes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [tag, macro_maquina_id, macro_componente_id, setor, tensao, capacidade, horas_planejadas_dia || 16, observacoes]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Ordens de Serviço (Manutenção)
app.get('/api/pcm/ordens-servico', async (req, res) => {
    try {
        const { equipamento_id } = req.query;
        let sql = `
            SELECT 
                os.*, 
                e.tag, 
                e.setor,
                COALESCE(t.nome, os.tecnico) AS tecnico_nome
            FROM ordens_servico os
            JOIN equipamentos e ON os.equipamento_id = e.id
            LEFT JOIN tecnicos t ON os.tecnico_id = t.id
        `;
        let params = [];

        if (equipamento_id && equipamento_id !== 'TODOS') {
            sql += ' WHERE os.equipamento_id = $1';
            params.push(equipamento_id);
        }

        sql += ' ORDER BY os.data_os DESC, os.created_at DESC';

        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/ordens-servico', async (req, res) => {
    const { equipamento_id, tipo, descricao, data_os, horas_parada, tecnico_id, tecnico } = req.body;
    try {
        const query = `
            INSERT INTO ordens_servico (equipamento_id, tipo, descricao, data_os, horas_parada, tecnico_id, tecnico)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [
            equipamento_id, 
            tipo, 
            descricao, 
            data_os, 
            horas_parada || 0, 
            tecnico_id || null, 
            tecnico || null
        ]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Lubrificação
app.get('/api/pcm/lubrificacao', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT l.*, e.tag 
            FROM plano_lubrificacao l
            JOIN equipamentos e ON l.equipamento_id = e.id
            ORDER BY e.tag ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/lubrificacao', async (req, res) => {
    const { equipamento_id, ponto_aplicacao, lubrificante, frequencia, quantidade_dose } = req.body;
    try {
        const query = `
            INSERT INTO plano_lubrificacao (equipamento_id, ponto_aplicacao, lubrificante, frequencia, quantidade_dose)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [equipamento_id, ponto_aplicacao, lubrificante, frequencia, quantidade_dose]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Almoxarifado de Peças
app.get('/api/pcm/pecas', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM pecas_reposicao ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/pecas', async (req, res) => {
    const { codigo_part_number, nome, condicao, data_reparo, quantidade_estoque, estoque_minimo } = req.body;
    try {
        const query = `
            INSERT INTO pecas_reposicao (codigo_part_number, nome, condicao, data_reparo, quantidade_estoque, estoque_minimo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [codigo_part_number, nome, condicao || 'Nova', data_reparo || null, quantidade_estoque || 0, estoque_minimo || 1]);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Técnicos
app.get('/api/pcm/tecnicos', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tecnicos WHERE ativo = TRUE ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/pcm/tecnicos', async (req, res) => {
    const { nome, especialidade } = req.body;
    try {
        const query = `
            INSERT INTO tecnicos (nome, especialidade)
            VALUES ($1, $2)
            ON CONFLICT (nome) DO UPDATE SET ativo = TRUE
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [nome, especialidade || 'Geral']);
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/pcm/tecnicos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE tecnicos SET ativo = FALSE WHERE id = $1', [id]);
        res.json({ mensagem: 'Técnico desativado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// =================================================================
// 6. ROTAS OPERACIONAIS (APONTAMENTOS)
// =================================================================

app.post('/api/apontamento', async (req, res) => {
    const { cliente, numeroOs, tipoOs, dataColeta, qtdGaiolas, pesoColeta, gaiolas } = req.body;

    if (!cliente || !numeroOs || !tipoOs) {
        return res.status(400).json({ mensagem: 'Campos obrigatórios ausentes.' });
    }

    const clientBD = await pool.connect();

    try {
        await clientBD.query('BEGIN');
        const dataTratada = dataColeta || new Date().toISOString().split('T')[0];

        const queryApontamento = `
            INSERT INTO apontamentos (cliente, numero_os, tipo_os, data_coleta, qtd_gaiolas, peso_coleta, peso_entrega)
            VALUES ($1, $2, $3, $4, $5, $6, 0)
            RETURNING id;
        `;
        const resApontamento = await clientBD.query(queryApontamento, [
            cliente, numeroOs, tipoOs, dataTratada,
            qtdGaiolas || (gaiolas ? gaiolas.length : 0),
            pesoColeta || 0
        ]);

        const apontamentoId = resApontamento.rows[0].id;

        if (Array.isArray(gaiolas) && gaiolas.length > 0) {
            const queryGaiola = `
                INSERT INTO apontamentos_gaiolas (apontamento_id, numero_gaiola, tipo_gaiola, peso_bruto, peso_tara, peso_liquido, fase)
                VALUES ($1, $2, $3, $4, $5, $6, 'recebimento');
            `;
            for (const g of gaiolas) {
                await clientBD.query(queryGaiola, [
                    apontamentoId, g.numero || 1, g.tipoGaiola || 'Padrão',
                    g.pesoBruto || 0, g.pesoTara || 0, g.pesoLiquido || 0
                ]);
            }
        }

        await clientBD.query('COMMIT');
        return res.status(201).json({ sucesso: true, id: apontamentoId });
    } catch (err) {
        await clientBD.query('ROLLBACK');
        return res.status(500).json({ erro: 'Erro ao salvar recebimento', detalhe: err.message });
    } finally {
        clientBD.release();
    }
});

// =================================================================
// 7. ROTAS DE NAVEGAÇÃO E PÁGINAS HTML
// =================================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'public', 'pcm_manutencao.html'));
});

app.get('/cadastro-pmp', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

// =================================================================
// 8. INICIALIZAÇÃO ÚNICA DO SERVIDOR
// =================================================================

app.listen(PORT, () => {
    console.log(`🚀 Servidor MES & PCM ativo na porta ${PORT}`);
});