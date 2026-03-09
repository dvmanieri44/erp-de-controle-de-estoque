document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formProduto");
  const tabela = document.getElementById("tabelaProdutos");
  const buscarProduto = document.getElementById("buscarProduto");
  const filtroCategoria = document.getElementById("filtroCategoria");
  const fornecedorSelect = document.getElementById("fornecedor");
  const produtoEditId = document.getElementById("produtoEditId");
  const modal = document.getElementById("modalDetalhesProduto");
  const conteudoDetalhes = document.getElementById("conteudoDetalhesProduto");
  const fecharModal = document.getElementById("fecharModalDetalhes");
  const btnSalvar = document.getElementById("btnSalvarProduto");
  const btnLimpar = document.getElementById("btnLimparProduto");

  if (!form || !tabela) return;

  function preencherFornecedores() {
    const fornecedores = getFornecedores();
    fornecedorSelect.innerHTML = `<option value="">Selecione um fornecedor</option>`;

    fornecedores.forEach((fornecedor) => {
      const option = document.createElement("option");
      option.value = fornecedor.nome;
      option.textContent = fornecedor.nome;
      fornecedorSelect.appendChild(option);
    });
  }

  function preencherCategorias() {
    const produtos = getProdutos();
    const categorias = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))].sort();

    filtroCategoria.innerHTML = `<option value="">Todas as categorias</option>`;
    categorias.forEach((categoria) => {
      const option = document.createElement("option");
      option.value = categoria;
      option.textContent = categoria;
      filtroCategoria.appendChild(option);
    });
  }

  function limparFormulario() {
    form.reset();
    produtoEditId.value = "";
    document.getElementById("estoqueMinimo").value = 5;
    btnSalvar.textContent = "Salvar Produto";
  }

  function abrirModal(produto) {
    const status = getStatusEstoque(produto.quantidade, produto.estoqueMinimo);

    conteudoDetalhes.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label>Código</label>
          <div>${escapeHtml(produto.codigo)}</div>
        </div>
        <div class="form-group">
          <label>Produto</label>
          <div>${escapeHtml(produto.nome)}</div>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <div>${escapeHtml(produto.categoria)}</div>
        </div>
        <div class="form-group">
          <label>Quantidade</label>
          <div>${produto.quantidade}</div>
        </div>
        <div class="form-group">
          <label>Preço</label>
          <div>${formatCurrency(produto.preco)}</div>
        </div>
        <div class="form-group">
          <label>Fornecedor</label>
          <div>${escapeHtml(produto.fornecedor || "-")}</div>
        </div>
        <div class="form-group">
          <label>Estoque mínimo</label>
          <div>${produto.estoqueMinimo}</div>
        </div>
        <div class="form-group">
          <label>Status</label>
          <div><span class="${status.classe}">${status.texto}</span></div>
        </div>
      </div>
    `;
    modal.classList.add("show");
  }

  function editarProduto(id) {
    const produtos = getProdutos();
    const produto = produtos.find((item) => String(item.id) === String(id));
    if (!produto) return;

    produtoEditId.value = produto.id;
    document.getElementById("codigo").value = produto.codigo;
    document.getElementById("nome").value = produto.nome;
    document.getElementById("categoria").value = produto.categoria;
    document.getElementById("quantidade").value = produto.quantidade;
    document.getElementById("preco").value = produto.preco;
    document.getElementById("fornecedor").value = produto.fornecedor || "";
    document.getElementById("estoqueMinimo").value = produto.estoqueMinimo || 5;
    btnSalvar.textContent = "Atualizar Produto";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluirProduto(id) {
    const produtos = getProdutos();
    const produto = produtos.find((item) => String(item.id) === String(id));
    if (!produto) return;

    const confirmar = window.confirm(`Deseja excluir o produto "${produto.nome}"?`);
    if (!confirmar) return;

    const atualizados = produtos.filter((item) => String(item.id) !== String(id));
    saveProdutos(atualizados);
    renderizarProdutos();
    preencherCategorias();
    showToast("Produto excluído com sucesso.", "warning");
  }

  function filtrarProdutos(produtos) {
    const termo = (buscarProduto?.value || "").trim().toLowerCase();
    const categoria = filtroCategoria?.value || "";

    return produtos.filter((produto) => {
      const bateTermo =
        !termo ||
        produto.nome.toLowerCase().includes(termo) ||
        produto.codigo.toLowerCase().includes(termo);

      const bateCategoria = !categoria || produto.categoria === categoria;

      return bateTermo && bateCategoria;
    });
  }

  function renderizarProdutos() {
    const produtos = filtrarProdutos(getProdutos());
    tabela.innerHTML = "";

    if (produtos.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">Nenhum produto encontrado.</div>
          </td>
        </tr>
      `;
      return;
    }

    produtos.forEach((produto) => {
      const status = getStatusEstoque(produto.quantidade, produto.estoqueMinimo);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(produto.codigo)}</td>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${escapeHtml(produto.categoria)}</td>
        <td>${produto.quantidade}</td>
        <td>${formatCurrency(produto.preco)}</td>
        <td>${escapeHtml(produto.fornecedor || "-")}</td>
        <td><span class="${status.classe}">${status.texto}</span></td>
        <td>
          <div class="actions-row">
            <button class="btn btn-secondary btn-detalhes" data-id="${produto.id}" type="button">Detalhes</button>
            <button class="btn btn-edit btn-editar" data-id="${produto.id}" type="button">Editar</button>
            <button class="btn btn-delete btn-excluir" data-id="${produto.id}" type="button">Excluir</button>
          </div>
        </td>
      `;
      tabela.appendChild(tr);
    });

    tabela.querySelectorAll(".btn-detalhes").forEach((btn) => {
      btn.addEventListener("click", () => {
        const produto = getProdutos().find((item) => String(item.id) === String(btn.dataset.id));
        if (produto) abrirModal(produto);
      });
    });

    tabela.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", () => editarProduto(btn.dataset.id));
    });

    tabela.querySelectorAll(".btn-excluir").forEach((btn) => {
      btn.addEventListener("click", () => excluirProduto(btn.dataset.id));
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const produtos = getProdutos();
    const idEdicao = produtoEditId.value.trim();

    const codigo = document.getElementById("codigo").value.trim();
    const nome = document.getElementById("nome").value.trim();
    const categoria = document.getElementById("categoria").value.trim();
    const quantidade = Number(document.getElementById("quantidade").value);
    const preco = Number(document.getElementById("preco").value);
    const fornecedor = document.getElementById("fornecedor").value.trim();
    const estoqueMinimo = Number(document.getElementById("estoqueMinimo").value);

    if (!codigo || !nome || !categoria) {
      showToast("Preencha os campos obrigatórios.", "error");
      return;
    }

    const codigoJaExiste = produtos.some(
      (item) => item.codigo.toLowerCase() === codigo.toLowerCase() && String(item.id) !== String(idEdicao)
    );

    if (codigoJaExiste) {
      showToast("Já existe um produto com esse código.", "error");
      return;
    }

    if (idEdicao) {
      const index = produtos.findIndex((item) => String(item.id) === String(idEdicao));
      if (index !== -1) {
        produtos[index] = {
          ...produtos[index],
          codigo,
          nome,
          categoria,
          quantidade,
          preco,
          fornecedor,
          estoqueMinimo
        };
        saveProdutos(produtos);
        showToast("Produto atualizado com sucesso.");
      }
    } else {
      produtos.push({
        id: gerarId(),
        codigo,
        nome,
        categoria,
        quantidade,
        preco,
        fornecedor,
        estoqueMinimo
      });
      saveProdutos(produtos);
      showToast("Produto cadastrado com sucesso.");
    }

    limparFormulario();
    preencherCategorias();
    renderizarProdutos();
  });

  btnLimpar?.addEventListener("click", () => {
    setTimeout(() => limparFormulario(), 50);
  });

  buscarProduto?.addEventListener("input", renderizarProdutos);
  filtroCategoria?.addEventListener("change", renderizarProdutos);

  fecharModal?.addEventListener("click", () => modal.classList.remove("show"));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.remove("show");
  });

  preencherFornecedores();
  preencherCategorias();
  renderizarProdutos();
});