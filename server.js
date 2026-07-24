const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do PostgreSQL / Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Teste de conexão
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Erro ao conectar ao banco PostgreSQL:', err.stack);
    }
    console.log('✅ Conectado ao banco de dados PostgreSQL com sucesso!');
    release();
});

// =================================================================
// 1. ROTAS DE CADASTRO (CLIENTES, TIPOS DE OS, TARAS)
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

// Tipos de OS
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

app.put('/api/tipos-os/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    try {
        await pool.query('UPDATE tipos_os SET nome = $1 WHERE id = $2', [nome, id]);
        res.json({ mensagem: 'Tipo de OS atualizado' });
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
// 2. ROTAS DE PROCESSAMENTO (RECEBIMENTO E EXPEDIÇÃO)
// =================================================================

// SALVAR PESAGEM DE RECEBIMENTO (ENTRADA)
app.post('/api/apontamento', async (req, res) => {
    const { cliente, numeroOs, tipoOs, dataColeta, qtdGaiolas, pesoColeta, gaiolas } = req.body;

    if (!cliente || !numeroOs || !tipoOs) {
        return res.status(400).json({ mensagem: 'Campos obrigatórios ausentes.' });
    }

    const clientBD = await pool.connect();

    try {
        await clientBD.query('BEGIN');

        // Define a data segura para gravação (trata 'null' ou 'undefined')
        const dataTratada = dataColeta || new Date().toISOString().split('T')[0];

        // 1. Grava o Apontamento Principal
        const queryApontamento = `
            INSERT INTO apontamentos (cliente, numero_os, tipo_os, data_coleta, qtd_gaiolas, peso_coleta, peso_entrega)
            VALUES ($1, $2, $3, $4, $5, $6, 0)
            RETURNING id;
        `;
        const resApontamento = await clientBD.query(queryApontamento, [
            cliente,
            numeroOs,
            tipoOs,
            dataTratada,
            qtdGaiolas || (gaiolas ? gaiolas.length : 0),
            pesoColeta || 0
        ]);

        const apontamentoId = resApontamento.rows[0].id;

        // 2. Grava os Detalhes das Gaiolas
        if (Array.isArray(gaiolas) && gaiolas.length > 0) {
            const queryGaiola = `
                INSERT INTO apontamentos_gaiolas (apontamento_id, numero_gaiola, tipo_gaiola, peso_bruto, peso_tara, peso_liquido, fase)
                VALUES ($1, $2, $3, $4, $5, $6, 'recebimento');
            `;

            for (const g of gaiolas) {
                await clientBD.query(queryGaiola, [
                    apontamentoId,
                    g.numero || 1,
                    g.tipoGaiola || 'Padrão',
                    g.pesoBruto || 0,
                    g.pesoTara || 0,
                    g.pesoLiquido || 0
                ]);
            }
        }

        // 3. Atualiza ou Insere o Resumo na Produção Diária (Se a tabela for utilizada)
        const queryProducao = `
            INSERT INTO producao_diaria (data, peso_coleta)
            VALUES ($1, $2)
            ON CONFLICT (data) DO UPDATE SET peso_coleta = producao_diaria.peso_coleta + EXCLUDED.peso_coleta;
        `;
        await clientBD.query(queryProducao, [dataTratada, pesoColeta || 0]);

        await clientBD.query('COMMIT');
        return res.status(201).json({ sucesso: true, id: apontamentoId });

    } catch (err) {
        await clientBD.query('ROLLBACK');
        console.error('❌ Erro no banco ao salvar recebimento:', err);
        return res.status(500).json({ erro: 'Erro ao salvar recebimento', detalhe: err.message });
    } finally {
        clientBD.release();
    }
});

// LISTAR OS PENDENTES PARA EXPEDIÇÃO
app.get('/api/os-pendentes-expedicao', async (req, res) => {
    try {
        const query = `
            SELECT id, cliente, numero_os, tipo_os, data_coleta, peso_coleta, qtd_gaiolas 
            FROM apontamentos 
            WHERE peso_entrega = 0 
            ORDER BY created_at DESC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// SALVAR PESAGEM DE EXPEDIÇÃO (SAÍDA)
app.post('/api/salvar-expedicao', async (req, res) => {
    const { apontamentoId, pesoTotalExpedicao, gaiolas } = req.body;

    if (!apontamentoId || !gaiolas) {
        return res.status(400).json({ mensagem: 'Parâmetros inválidos.' });
    }

    const clientBD = await pool.connect();

    try {
        await clientBD.query('BEGIN');

        // 1. Atualiza a OS com o peso final de entrega
        await clientBD.query(
            'UPDATE apontamentos SET peso_entrega = $1 WHERE id = $2',
            [pesoTotalExpedicao, apontamentoId]
        );

        // 2. Grava as gaiolas da fase de expedição
        const queryGaiola = `
            INSERT INTO apontamentos_gaiolas (apontamento_id, numero_gaiola, tipo_gaiola, peso_bruto, peso_tara, peso_liquido, fase)
            VALUES ($1, $2, $3, $4, $5, $6, 'expedicao');
        `;
        for (const g of gaiolas) {
            await clientBD.query(queryGaiola, [
                apontamentoId,
                g.numero,
                g.tipoGaiola,
                g.pesoBruto,
                g.pesoTara,
                g.pesoLiquido
            ]);
        }

        await clientBD.query('COMMIT');
        res.status(200).json({ sucesso: true, mensagem: 'Expedição finalizada com sucesso!' });
    } catch (err) {
        await clientBD.query('ROLLBACK');
        console.error('❌ Erro no banco ao salvar expedição:', err);
        res.status(500).json({ erro: 'Erro ao salvar expedição', detalhe: err.message });
    } finally {
        clientBD.release();
    }
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Servidor MES rodando na porta ${port}`);
});

// ROTA DO DASHBOARD OPERACIONAL
app.get('/api/dashboard', async (req, res) => {
    try {
        const { dataInicio, dataFim, cliente } = req.query;

        let OSRecentesWhere = [];
        let params = [];
        let paramIndex = 1;

        if (dataInicio) {
            OSRecentesWhere.push(`a.data_coleta >= $${paramIndex++}`);
            params.push(dataInicio);
        }
        if (dataFim) {
            OSRecentesWhere.push(`a.data_coleta <= $${paramIndex++}`);
            params.push(dataFim);
        }
        if (cliente) {
            OSRecentesWhere.push(`a.cliente = $${paramIndex++}`);
            params.push(cliente);
        }

        const whereClause = OSRecentesWhere.length > 0 ? `WHERE ${OSRecentesWhere.join(' AND ')}` : '';

        // 1. Totais Gerais de Peso e OSs
        const queryTotais = `
            SELECT 
                COUNT(a.id) AS total_os,
                COUNT(DISTINCT a.cliente) AS total_clientes,
                COALESCE(SUM(a.peso_coleta), 0) AS peso_total_entrada,
                COALESCE(SUM(a.peso_entrega), 0) AS peso_total_saida
            FROM apontamentos a
            ${whereClause};
        `;

        // 2. Contagem de Gaiolas por Fase (Entrada / Saída)
        const queryGaiolas = `
            SELECT 
                g.fase,
                COUNT(g.id) AS qtd_gaiolas,
                COALESCE(SUM(g.peso_liquido), 0) AS peso_liquido_fase
            FROM apontamentos_gaiolas g
            JOIN apontamentos a ON g.apontamento_id = a.id
            ${whereClause}
            GROUP BY g.fase;
        `;

        // 3. Resumo dos Últimos Apontamentos
        const queryUltimos = `
            SELECT a.id, a.cliente, a.numero_os, a.tipo_os, a.data_coleta, a.peso_coleta, a.peso_entrega, a.qtd_gaiolas
            FROM apontamentos a
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT 10;
        `;

        const resTotais = await pool.query(queryTotais, params);
        const resGaiolas = await pool.query(queryGaiolas, params);
        const resUltimos = await pool.query(queryUltimos, params);

        // Organizar gaiolas por fase
        let gaiolasEntrada = 0;
        let gaiolasSaida = 0;

        resGaiolas.rows.forEach(r => {
            if (r.fase === 'recebimento') gaiolasEntrada = parseInt(r.qtd_gaiolas);
            if (r.fase === 'expedicao') gaiolasSaida = parseInt(r.qtd_gaiolas);
        });

        res.json({
            totais: {
                totalOs: parseInt(resTotais.rows[0].total_os),
                totalClientes: parseInt(resTotais.rows[0].total_clientes),
                pesoTotalEntrada: parseFloat(resTotais.rows[0].peso_total_entrada),
                pesoTotalSaida: parseFloat(resTotais.rows[0].peso_total_saida),
                gaiolasEntrada,
                gaiolasSaida
            },
            ultimosApontamentos: resUltimos.rows
        });

    } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        res.status(500).json({ erro: 'Erro ao carregar dados do dashboard', detalhe: err.message });
    }
});

// 3. Resumo dos Últimos Apontamentos (com gaiolas por fase e % de retorno)
const queryUltimos = `
    SELECT 
        a.id, 
        a.cliente, 
        a.numero_os, 
        a.tipo_os, 
        a.data_coleta, 
        a.peso_coleta, 
        a.peso_entrega,
        COALESCE(SUM(CASE WHEN g.fase = 'recebimento' THEN 1 ELSE 0 END), 0) AS gaiolas_entrada,
        COALESCE(SUM(CASE WHEN g.fase = 'expedicao' THEN 1 ELSE 0 END), 0) AS gaiolas_saida
    FROM apontamentos a
    LEFT JOIN apontamentos_gaiolas g ON g.apontamento_id = a.id
    ${whereClause}
    GROUP BY a.id, a.cliente, a.numero_os, a.tipo_os, a.data_coleta, a.peso_coleta, a.peso_entrega, a.created_at
    ORDER BY a.created_at DESC
    LIMIT 10;
`;