-- Tabela de Apontamento de Produção Diária
CREATE TABLE producao_diaria (
    data DATE PRIMARY KEY,
    peso_coleta_kg DECIMAL(10,2) DEFAULT 0,
    peso_entrega_kg DECIMAL(10,2) DEFAULT 0,
    peso_lavagem_kg DECIMAL(10,2) DEFAULT 0,
    retorno_perc DECIMAL(5,2) GENERATED ALWAYS AS ((peso_entrega_kg / NULLIF(peso_coleta_kg, 0)) * 100) STORED,
    otd_perc DECIMAL(5,2) DEFAULT 100.0,
    nc_perc DECIMAL(5,2) DEFAULT 0.0
);

-- Tabela de Leituras de Consumos (Utilidades e Telemetria)
CREATE TABLE consumos_utilidades (
    id SERIAL PRIMARY KEY,
    data DATE REFERENCES producao_diaria(data),
    poco_1_litros DECIMAL(10,2) DEFAULT 0,
    poco_2_litros DECIMAL(10,2) DEFAULT 0,
    tunel_1_litros DECIMAL(10,2) DEFAULT 0,
    tunel_2_litros DECIMAL(10,2) DEFAULT 0,
    gas_m3 DECIMAL(10,2) DEFAULT 0,
    energia_kwh DECIMAL(10,2) DEFAULT 0
);

-- Tabela de Produtos Químicos e Estoque
CREATE TABLE produtos_quimicos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50),
    custo_unitario DECIMAL(10,2) NOT NULL,
    unidade_medida VARCHAR(10) DEFAULT 'L'
);

-- Tabela de Consumo Diário de Químicos
CREATE TABLE consumo_quimicos_diario (
    id SERIAL PRIMARY KEY,
    data DATE REFERENCES producao_diaria(data),
    produto_id INT REFERENCES produtos_quimicos(id),
    quantidade_consumida DECIMAL(10,2) NOT NULL,
    custo_total DECIMAL(10,2) GENERATED ALWAYS AS (quantidade_consumida * custo_unitario) STORED
);