document.addEventListener("DOMContentLoaded", () => {

  const cardTotalProdutos = document.getElementById("cardTotalProdutos");
  const cardTotalQuantidade = document.getElementById("cardTotalQuantidade");
  const cardEntradas = document.getElementById("cardEntradas");
  const cardSaidas = document.getElementById("cardSaidas");
  const cardBaixo = document.getElementById("cardBaixo");
  const cardSemEstoque = document.getElementById("cardSemEstoque");

  const alertasEstoque = document.getElementById("alertasEstoque");
  const tabelaUltimasMovimentacoes = document.getElementById("tabelaUltimasMovimentacoes");

  const graficoMovimentacao = document.getElementById("graficoMovimentacao");
  const graficoProdutos = document.getElementById("graficoProdutos");

  const produtos = getProdutos();
  const movimentacoes = getMovimentacoes();



  // ============================
  // INDICADORES
  // ============================

  const totalProdutos = produtos.length;

  const totalQuantidade = produtos.reduce((acc, p) => {
    return acc + Number(p.quantidade || 0);
  }, 0);

  const totalEntradas = movimentacoes
    .filter(m => m.tipo === "Entrada")
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);

  const totalSaidas = movimentacoes
    .filter(m => m.tipo === "Saída")
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);


  const estoqueBaixo = produtos.filter(p => {
    const qtd = Number(p.quantidade || 0);
    const minimo = Number(p.estoqueMinimo || 0);
    return qtd > 0 && qtd <= minimo;
  });

  const semEstoque = produtos.filter(p => Number(p.quantidade || 0) <= 0);



  cardTotalProdutos.textContent = totalProdutos;
  cardTotalQuantidade.textContent = totalQuantidade;
  cardEntradas.textContent = totalEntradas;
  cardSaidas.textContent = totalSaidas;
  cardBaixo.textContent = estoqueBaixo.length;
  cardSemEstoque.textContent = semEstoque.length;



  // ============================
  // ALERTAS
  // ============================

  if (alertasEstoque) {

    if (estoqueBaixo.length === 0 && semEstoque.length === 0) {

      alertasEstoque.innerHTML = `
      <div class="empty-state">
      Nenhum alerta de estoque
      </div>
      `;

    } else {

      const alertas = [...estoqueBaixo, ...semEstoque];

      alertasEstoque.innerHTML = alertas.map(produto => {

        const status = getStatusEstoque(produto.quantidade, produto.estoqueMinimo);

        return `
        <div class="alert-item">

        <strong>${escapeHtml(produto.nome)}</strong>

        <br>

        <span class="small-muted">

        Código: ${escapeHtml(produto.codigo)} |
        Quantidade: ${produto.quantidade}

        </span>

        <br>

        <span class="${status.classe}">
        ${status.texto}
        </span>

        </div>
        `;

      }).join("");

    }

  }



  // ============================
  // ÚLTIMAS MOVIMENTAÇÕES
  // ============================

  if (tabelaUltimasMovimentacoes) {

    const ultimas = [...movimentacoes]
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 8);

    if (ultimas.length === 0) {

      tabelaUltimasMovimentacoes.innerHTML = `
      <tr>
      <td colspan="6">
      <div class="empty-state">
      Nenhuma movimentação registrada
      </div>
      </td>
      </tr>
      `;

    } else {

      tabelaUltimasMovimentacoes.innerHTML = ultimas.map(m => {

        return `
        <tr>

        <td>${formatDate(m.data)}</td>

        <td>${escapeHtml(m.produtoNome)}</td>

        <td>${m.tipo}</td>

        <td>${m.quantidade}</td>

        <td>${escapeHtml(m.destino || m.fornecedor || "-")}</td>

        <td>${escapeHtml(m.usuarioNome || "-")}</td>

        </tr>
        `;

      }).join("");

    }

  }



  // ============================
  // GRÁFICO MOVIMENTAÇÃO
  // ============================

  if (graficoMovimentacao && typeof Chart !== "undefined") {

    const entradas = movimentacoes.filter(m => m.tipo === "Entrada").length;
    const saidas = movimentacoes.filter(m => m.tipo === "Saída").length;

    new Chart(graficoMovimentacao, {

      type: "bar",

      data: {

        labels: ["Entradas", "Saídas"],

        datasets: [{

          label: "Movimentações",

          data: [entradas, saidas],

          backgroundColor: [

            "#22c55e",
            "#ef4444"

          ]

        }]

      },

      options: {

        responsive: true,

        plugins: {

          legend: { display: false }

        }

      }

    });

  }



  // ============================
  // PRODUTOS MAIS MOVIMENTADOS
  // ============================

  if (graficoProdutos && typeof Chart !== "undefined") {

    const contagem = {};

    movimentacoes.forEach(m => {

      if (!contagem[m.produtoNome]) {

        contagem[m.produtoNome] = 0;

      }

      contagem[m.produtoNome] += Number(m.quantidade || 0);

    });

    const nomes = Object.keys(contagem);
    const valores = Object.values(contagem);

    new Chart(graficoProdutos, {

      type: "pie",

      data: {

        labels: nomes,

        datasets: [{

          data: valores,

          backgroundColor: [

            "#3b82f6",
            "#22c55e",
            "#ef4444",
            "#f59e0b",
            "#8b5cf6",
            "#06b6d4"

          ]

        }]

      },

      options: {

        responsive: true

      }

    });

  }

});