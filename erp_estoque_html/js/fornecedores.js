document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formFornecedor");
  const tabela = document.getElementById("tabelaFornecedores");
  const buscarFornecedor = document.getElementById("buscarFornecedor");
  const fornecedorEditId = document.getElementById("fornecedorEditId");
  const btnSalvar = document.getElementById("btnSalvarFornecedor");
  const btnLimpar = document.getElementById("btnLimparFornecedor");

  if (!form || !tabela) return;

  function limparFormulario() {
    form.reset();
    fornecedorEditId.value = "";
    btnSalvar.textContent = "Salvar Fornecedor";
  }

  function editarFornecedor(id) {
    const fornecedores = getFornecedores();
    const fornecedor = fornecedores.find((item) => String(item.id) === String(id));
    if (!fornecedor) return;

    fornecedorEditId.value = fornecedor.id;
    document.getElementById("nomeFornecedor").value = fornecedor.nome || "";
    document.getElementById("cnpjFornecedor").value = fornecedor.cnpj || "";
    document.getElementById("telefoneFornecedor").value = fornecedor.telefone || "";
    document.getElementById("emailFornecedor").value = fornecedor.email || "";
    document.getElementById("responsavelFornecedor").value = fornecedor.responsavel || "";
    document.getElementById("cidadeFornecedor").value = fornecedor.cidade || "";
    document.getElementById("enderecoFornecedor").value = fornecedor.endereco || "";
    btnSalvar.textContent = "Atualizar Fornecedor";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluirFornecedor(id) {
    const fornecedores = getFornecedores();
    const fornecedor = fornecedores.find((item) => String(item.id) === String(id));
    if (!fornecedor) return;

    const confirmar = window.confirm(`Deseja excluir o fornecedor "${fornecedor.nome}"?`);
    if (!confirmar) return;

    const atualizados = fornecedores.filter((item) => String(item.id) !== String(id));
    saveFornecedores(atualizados);
    renderizarFornecedores();
    showToast("Fornecedor excluído com sucesso.", "warning");
  }

  function filtrarFornecedores(lista) {
    const termo = (buscarFornecedor?.value || "").trim().toLowerCase();

    return lista.filter((item) => {
      return (
        item.nome?.toLowerCase().includes(termo) ||
        item.cnpj?.toLowerCase().includes(termo) ||
        item.responsavel?.toLowerCase().includes(termo)
      );
    });
  }

  function renderizarFornecedores() {
    const fornecedores = filtrarFornecedores(getFornecedores());
    tabela.innerHTML = "";

    if (fornecedores.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">Nenhum fornecedor encontrado.</div>
          </td>
        </tr>
      `;
      return;
    }

    fornecedores.forEach((fornecedor) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(fornecedor.nome || "-")}</td>
        <td>${escapeHtml(fornecedor.cnpj || "-")}</td>
        <td>${escapeHtml(fornecedor.telefone || "-")}</td>
        <td>${escapeHtml(fornecedor.email || "-")}</td>
        <td>${escapeHtml(fornecedor.responsavel || "-")}</td>
        <td>${escapeHtml(fornecedor.cidade || "-")}</td>
        <td>
          <div class="actions-row">
            <button class="btn btn-edit btn-editar" data-id="${fornecedor.id}" type="button">Editar</button>
            <button class="btn btn-delete btn-excluir" data-id="${fornecedor.id}" type="button">Excluir</button>
          </div>
        </td>
      `;
      tabela.appendChild(tr);
    });

    tabela.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", () => editarFornecedor(btn.dataset.id));
    });

    tabela.querySelectorAll(".btn-excluir").forEach((btn) => {
      btn.addEventListener("click", () => excluirFornecedor(btn.dataset.id));
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fornecedores = getFornecedores();
    const idEdicao = fornecedorEditId.value.trim();

    const nome = document.getElementById("nomeFornecedor").value.trim();
    const cnpj = document.getElementById("cnpjFornecedor").value.trim();
    const telefone = document.getElementById("telefoneFornecedor").value.trim();
    const email = document.getElementById("emailFornecedor").value.trim();
    const responsavel = document.getElementById("responsavelFornecedor").value.trim();
    const cidade = document.getElementById("cidadeFornecedor").value.trim();
    const endereco = document.getElementById("enderecoFornecedor").value.trim();

    if (!nome) {
      showToast("Digite o nome do fornecedor.", "error");
      return;
    }

    if (idEdicao) {
      const index = fornecedores.findIndex((item) => String(item.id) === String(idEdicao));
      if (index !== -1) {
        fornecedores[index] = {
          ...fornecedores[index],
          nome,
          cnpj,
          telefone,
          email,
          responsavel,
          cidade,
          endereco
        };
      }
      saveFornecedores(fornecedores);
      showToast("Fornecedor atualizado com sucesso.");
    } else {
      fornecedores.push({
        id: gerarId(),
        nome,
        cnpj,
        telefone,
        email,
        responsavel,
        cidade,
        endereco
      });
      saveFornecedores(fornecedores);
      showToast("Fornecedor cadastrado com sucesso.");
    }

    limparFormulario();
    renderizarFornecedores();
  });

  btnLimpar?.addEventListener("click", () => {
    setTimeout(() => limparFormulario(), 50);
  });

  buscarFornecedor?.addEventListener("input", renderizarFornecedores);

  renderizarFornecedores();
});