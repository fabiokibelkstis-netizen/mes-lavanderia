<?php
// Configurações de conexão com o SQL Server
$serverName = "192.168.1.120, 1433"; 
$connectionOptions = [
    "Database" => "Super_Lavagem_DB",
    "Uid" => "super",
    "PWD" => "123",
    "CharacterSet" => "UTF-8"
];

// Conectando ao SQL Server
$conn = sqlsrv_connect($serverName, $connectionOptions);
if ($conn === false) {
    die("<pre>" . print_r(sqlsrv_errors(), true) . "</pre>");
}

// Verifica se o usuário clicou em uma tabela específica para ver os dados
$tabela_selecionada = isset($_GET['tabela']) ? $_GET['tabela'] : null;
?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Explorador de Banco de Dados - SQL Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f9f9f9; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; background: #fff; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        th { background-color: #0078D4; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .btn-voltar { display: inline-block; margin-bottom: 15px; padding: 10px 15px; background: #333; color: white; text-decoration: none; border-radius: 4px; }
        .lista-tabelas a { color: #0078D4; text-decoration: none; font-weight: bold; }
        .lista-tabelas a:hover { text-decoration: underline; }
    </style>
</head>
<body>

    <?php if (!$tabela_selecionada): ?>
        <!-- ETAPA 1: LISTAR TABELAS DISPONÍVEIS -->
        <h2>Tabelas Disponíveis no Banco de Dados</h2>
        <p>Selecione uma tabela para visualizar seus campos e dados:</p>
        
        <table class="lista-tabelas">
            <thead>
                <tr>
                    <th>Nome da Tabela</th>
                    <th>Ação</th>
                </tr>
            </thead>
            <tbody>
                <?php
                // Consulta para listar todas as tabelas criadas pelo usuário
                $sql_tabelas = "SELECT name FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY name";
                $stmt_tabelas = sqlsrv_query($conn, $sql_tabelas);
                
                if ($stmt_tabelas === false) {
                    die("<pre>" . print_r(sqlsrv_errors(), true) . "</pre>");
                }

                while ($row = sqlsrv_fetch_array($stmt_tabelas, SQLSRV_FETCH_ASSOC)) {
                    $nome_tab = $row['name'];
                    echo "<tr>";
                    echo "<td><strong>" . htmlspecialchars($nome_tab) . "</strong></td>";
                    echo "<td><a href='?tabela=" . urlencode($nome_tab) . "'>Visualizar Dados e Colunas ➔</a></td>";
                    echo "</tr>";
                }
                sqlsrv_free_stmt($stmt_tabelas);
                ?>
            </tbody>
        </table>

    <?php else: ?>
        <!-- ETAPA 2: EXIBIR DADOS DA TABELA SELECIONADA DINAMICAMENTE -->
        <a href="?" class="btn-voltar">⬅ Voltar para a lista de tabelas</a>
        
        <h2>Dados da Tabela: <?php echo htmlspecialchars($tabela_selecionada); ?></h2>

        <?php
        // IMPORTANTE: Como o nome da tabela vem da URL, limpamos para evitar SQL Injection
        // Remove caracteres que não fazem parte de nomes de tabelas no SQL Server
        $tabela_limpa = preg_replace('/[^a-zA-Z0-9_.]/', '', $tabela_selecionada);

        // Consulta dinâmica trazendo todos os registros da tabela escolhida
        $sql_dados = "SELECT * FROM [$tabela_limpa]";
        $stmt_dados = sqlsrv_query($conn, $sql_dados);

        if ($stmt_dados === false) {
            echo "<p style='color:red;'>Erro ao acessar a tabela ou tabela vazia.</p>";
            echo "<pre>" . print_r(sqlsrv_errors(), true) . "</pre>";
        } else {
            // Descobre a estrutura de colunas dinamicamente
            $metadados = sqlsrv_field_metadata($stmt_dados);
            
            if ($metadados) {
                echo "<table>";
                echo "<thead><tr>";
                // Cria os cabeçalhos da tabela dinamicamente com os nomes das colunas
                foreach ($metadados as $campo) {
                    echo "<th>" . htmlspecialchars($campo['Name']) . "</th>";
                }
                echo "</tr></thead>";
                echo "<tbody>";

                // Preenche as linhas com os dados reais
                $contagem = 0;
                while ($row = sqlsrv_fetch_array($stmt_dados, SQLSRV_FETCH_ASSOC)) {
                    $contagem++;
                    echo "<tr>";
                    foreach ($row as $valor) {
                        // Trata objetos de data/hora para não quebrarem o echo
                        if ($valor instanceof DateTime) {
                            $valor = $valor->format('Y-m-d H:i:s');
                        }
                        echo "<td>" . htmlspecialchars($valor ?? '') . "</td>";
                    }
                    echo "</tr>";
                }
                
                if ($contagem === 0) {
                    echo "<tr><td colspan='".count($metadados)."'>Nenhum registro encontrado nesta tabela.</td></tr>";
                }

                echo "</tbody>";
                echo "</table>";
            }
            sqlsrv_free_stmt($stmt_dados);
        }
        ?>

    <?php endif; ?>

    <?php sqlsrv_close($conn); ?>
</body>
</html>
