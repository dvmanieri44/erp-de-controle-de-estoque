document.addEventListener("DOMContentLoaded", () => {
  const relTotalProdutos = document.getElementById("relTotalProdutos");
  const relTotalFornecedores = document.getElementById("relTotalFornecedores");
  const relTotalEntradas = document.getElementById("relTotalEntradas");
  const relTotalSaidas = document.getElementById("relTotalSaidas");
  const tabelaResumoProdutos = document.getElementById("tabelaResumoProdutos");
  const tabelaRelatorioMovimentacoes = document.getElementById("tabelaRelatorioMovimentacoes");
  const btnExportar = document.getElementById("btnExportarRelatorio");
  const btnFiltrar = document.getElementById("btnFiltrarRelatorio");
  const filtroDataInicial = document.getElementById("filtroDataInicial");
  const filtroDataFinal = document.getElementById("filtroDataFinal");

  if (!relTotalProdutos) return;

  function obterMovimentacoesFiltradas() {
    const dataInicial = filtroDataInicial?.value || "";
    const dataFinal = filtroDataFinal?.value || "";
    const movimentacoes = getMovimentacoes();

    return movimentacoes.filter((item) => {
      const data = item.data || "";
      const depoisDoInicio = !dataInicial || data >= dataInicial;
      const antesDoFim = !dataFinal || data <= dataFinal;
      return depoisDoInicio && antesDoFim;
    });
  }

  function renderizar() {
    const produtos = getProdutos();
    const fornecedores = getFornecedores();
    const movimentacoesFiltradas = obterMovimentacoesFiltradas();

    relTotalProdutos.textContent = produtos.length;
    relTotalFornecedores.textContent = fornecedores.length;
    relTotalEntradas.textContent = movimentacoesFiltradas.filter((item) => item.tipo === "Entrada").length;
    relTotalSaidas.textContent = movimentacoesFiltradas.filter((item) => item.tipo === "Saída").length;

    if (tabelaResumoProdutos) {
      if (produtos.length === 0) {
        tabelaResumoProdutos.innerHTML = `
          <tr>
            <td colspan="7">
              <div class="empty-state">Nenhum produto cadastrado.</div>
            </td>
          </tr>
        `;
      } else {
        tabelaResumoProdutos.innerHTML = produtos
          .map((produto) => {
            const status = getStatusEstoque(produto.quantidade, produto.estoqueMinimo);
            return `
              <tr>
                <td>${escapeHtml(produto.codigo)}</td>
                <td>${escapeHtml(produto.nome)}</td>
                <td>${escapeHtml(produto.categoria)}</td>
                <td>${escapeHtml(produto.fornecedor || "-")}</td>
                <td>${produto.quantidade}</td>
                <td>${produto.estoqueMinimo}</td>
                <td><span class="${status.classe}">${status.texto}</span></td>
              </tr>
            `;
          })
          .join("");
      }
    }

    if (tabelaRelatorioMovimentacoes) {
      if (movimentacoesFiltradas.length === 0) {
        tabelaRelatorioMovimentacoes.innerHTML = `
          <tr>
            <td colspan="6">
              <div class="empty-state">Nenhuma movimentação encontrada para o período.</div>
            </td>
          </tr>
        `;
      } else {
        tabelaRelatorioMovimentacoes.innerHTML = [...movimentacoesFiltradas]
          .sort((a, b) => new Date(b.data) - new Date(a.data))
          .map(
            (item) => `
              <tr>
                <td>${formatDate(item.data)}</td>
                <td>${escapeHtml(item.produtoNome)}</td>
                <td>${escapeHtml(item.tipo)}</td>
                <td>${item.quantidade}</td>
                <td>${escapeHtml(item.destino || item.fornecedor || "-")}</td>
                <td>${escapeHtml(item.usuarioNome || "-")}</td>
              </tr>
            `
          )
          .join("");
      }
    }
  }

  function exportarCSV() {
    const produtos = getProdutos();

    if (produtos.length === 0) {
      showToast("Não há produtos para exportar.", "warning");
      return;
    }

    const linhas = [
      ["Código", "Produto", "Categoria", "Fornecedor", "Quantidade", "Estoque Mínimo", "Preço", "Status"]
    ];

    produtos.forEach((produto) => {
      const status = getStatusEstoque(produto.quantidade, produto.estoqueMinimo).texto;
      linhas.push([
        produto.codigo,
        produto.nome,
        produto.categoria,
        produto.fornecedor || "",
        produto.quantidade,
        produto.estoqueMinimo,
        produto.preco,
        status
      ]);
    });

    const csv = linhas.map((linha) => linha.map((valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio_estoque.csv";
    link.click();

    URL.revokeObjectURL(url);
    showToast("Relatório exportado com sucesso.");
  }

  btnFiltrar?.addEventListener("click", renderizar);
  btnExportar?.addEventListener("click", exportarCSV);

  renderizar();
});