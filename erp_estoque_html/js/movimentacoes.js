document.addEventListener("DOMContentLoaded", () => {
  const bodyPage = document.body.dataset.page;

  if (bodyPage === "entradas") {
    inicializarEntradas();
  }

  if (bodyPage === "saidas") {
    inicializarSaidas();
  }
});

function preencherSelectProdutos(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const produtos = getProdutos();
  select.innerHTML = `<option value="">Selecione um produto</option>`;

  produtos.forEach((produto) => {
    const option = document.createElement("option");
    option.value = produto.id;
    option.textContent = `${produto.codigo} - ${produto.nome}`;
    select.appendChild(option);
  });
}

function inicializarEntradas() {
  const form = document.getElementById("formEntrada");
  const tabela = document.getElementById("tabelaEntradas");
  const buscarEntrada = document.getElementById("buscarEntrada");
  const dataInput = document.getElementById("entradaData");

  if (!form || !tabela) return;

  preencherSelectProdutos("entradaProduto");
  if (dataInput) dataInput.value = getTodayISO();

  function renderizarEntradas() {
    const termo = (buscarEntrada?.value || "").trim().toLowerCase();
    const movimentacoes = getMovimentacoes()
      .filter((item) => item.tipo === "Entrada")
      .filter((item) => {
        return (
          !termo ||
          item.produtoNome?.toLowerCase().includes(termo) ||
          item.fornecedor?.toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));

    tabela.innerHTML = "";

    if (movimentacoes.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">Nenhuma entrada registrada.</div>
          </td>
        </tr>
      `;
      return;
    }

    movimentacoes.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(item.data)}</td>
        <td>${escapeHtml(item.produtoNome)}</td>
        <td>${escapeHtml(item.fornecedor || "-")}</td>
        <td>${item.quantidade}</td>
        <td>${formatCurrency(item.precoCompra || 0)}</td>
        <td>${escapeHtml(item.usuarioNome || "-")}</td>
      `;
      tabela.appendChild(tr);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const produtoId = document.getElementById("entradaProduto").value;
    const fornecedor = document.getElementById("entradaFornecedor").value.trim();
    const quantidade = Number(document.getElementById("entradaQuantidade").value);
    const precoCompra = Number(document.getElementById("entradaPreco").value || 0);
    const data = document.getElementById("entradaData").value;
    const usuario = getUsuarioLogado();

    if (!produtoId || quantidade <= 0 || !data) {
      showToast("Preencha os campos obrigatórios da entrada.", "error");
      return;
    }

    const produtos = getProdutos();
    const indexProduto = produtos.findIndex((item) => String(item.id) === String(produtoId));
    if (indexProduto === -1) {
      showToast("Produto não encontrado.", "error");
      return;
    }

    produtos[indexProduto].quantidade = Number(produtos[indexProduto].quantidade || 0) + quantidade;
    saveProdutos(produtos);

    const movimentacoes = getMovimentacoes();
    movimentacoes.push({
      id: gerarId(),
      tipo: "Entrada",
      produtoId,
      produtoNome: produtos[indexProduto].nome,
      quantidade,
      data,
      fornecedor,
      precoCompra,
      destino: "",
      usuarioNome: usuario?.nome || "Usuário"
    });
    saveMovimentacoes(movimentacoes);

    form.reset();
    document.getElementById("entradaData").value = getTodayISO();
    preencherSelectProdutos("entradaProduto");
    renderizarEntradas();
    showToast("Entrada registrada com sucesso.");
  });

  buscarEntrada?.addEventListener("input", renderizarEntradas);

  renderizarEntradas();
}

function inicializarSaidas() {
  const form = document.getElementById("formSaida");
  const tabela = document.getElementById("tabelaSaidas");
  const buscarSaida = document.getElementById("buscarSaida");
  const dataInput = document.getElementById("saidaData");

  if (!form || !tabela) return;

  preencherSelectProdutos("saidaProduto");
  if (dataInput) dataInput.value = getTodayISO();

  function renderizarSaidas() {
    const termo = (buscarSaida?.value || "").trim().toLowerCase();
    const movimentacoes = getMovimentacoes()
      .filter((item) => item.tipo === "Saída")
      .filter((item) => {
        return (
          !termo ||
          item.produtoNome?.toLowerCase().includes(termo) ||
          item.destino?.toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));

    tabela.innerHTML = "";

    if (movimentacoes.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">Nenhuma saída registrada.</div>
          </td>
        </tr>
      `;
      return;
    }

    movimentacoes.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(item.data)}</td>
        <td>${escapeHtml(item.produtoNome)}</td>
        <td>${item.quantidade}</td>
        <td>${escapeHtml(item.destino || "-")}</td>
        <td>${escapeHtml(item.usuarioNome || "-")}</td>
      `;
      tabela.appendChild(tr);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const produtoId = document.getElementById("saidaProduto").value;
    const quantidade = Number(document.getElementById("saidaQuantidade").value);
    const destino = document.getElementById("saidaDestino").value.trim();
    const data = document.getElementById("saidaData").value;
    const usuario = getUsuarioLogado();

    if (!produtoId || quantidade <= 0 || !destino || !data) {
      showToast("Preencha os campos obrigatórios da saída.", "error");
      return;
    }

    const produtos = getProdutos();
    const indexProduto = produtos.findIndex((item) => String(item.id) === String(produtoId));
    if (indexProduto === -1) {
      showToast("Produto não encontrado.", "error");
      return;
    }

    const estoqueAtual = Number(produtos[indexProduto].quantidade || 0);
    if (quantidade > estoqueAtual) {
      showToast("Estoque insuficiente para realizar a saída.", "error");
      return;
    }

    produtos[indexProduto].quantidade = estoqueAtual - quantidade;
    saveProdutos(produtos);

    const movimentacoes = getMovimentacoes();
    movimentacoes.push({
      id: gerarId(),
      tipo: "Saída",
      produtoId,
      produtoNome: produtos[indexProduto].nome,
      quantidade,
      data,
      fornecedor: "",
      precoCompra: 0,
      destino,
      usuarioNome: usuario?.nome || "Usuário"
    });
    saveMovimentacoes(movimentacoes);

    form.reset();
    document.getElementById("saidaData").value = getTodayISO();
    preencherSelectProdutos("saidaProduto");
    renderizarSaidas();
    showToast("Saída registrada com sucesso.");
  });

  buscarSaida?.addEventListener("input", renderizarSaidas);

  renderizarSaidas();
}