let produtos = []
let lotes = []
let movimentos = []

const estoqueService = {
  listarProdutos() {
    return produtos
  },

  listarLotes() {
    return lotes
  },

  listarMovimentos() {
    return movimentos
  },

  adicionarProduto(produto) {
    const novo = {
      id: Date.now(),
      nome: produto.nome,
      categoria: produto.categoria,
      preco: Number(produto.preco) || 0,
      validade: produto.validade || "",
      fornecedor: produto.fornecedor || "",
      estoque: Number(produto.estoque) || 0,
      estoqueMinimo: Number(produto.estoqueMinimo) || 0,
      consumoMedio: Number(produto.consumoMedio) || 0,
      codigoBarras: produto.codigoBarras || String(Date.now())
    }

    produtos.push(novo)

    return {
      sucesso: true,
      mensagem: "Produto cadastrado com sucesso"
    }
  },

  editarProduto(id, dados) {
    const produto = produtos.find((p) => p.id === id)

    if (!produto) {
      return { sucesso: false, mensagem: "Produto não encontrado" }
    }

    Object.assign(produto, {
      ...dados,
      preco: Number(dados.preco) || 0,
      estoque: Number(dados.estoque) || 0,
      estoqueMinimo: Number(dados.estoqueMinimo) || 0,
      consumoMedio: Number(dados.consumoMedio) || 0,
      codigoBarras: dados.codigoBarras || produto.codigoBarras || String(Date.now())
    })

    return {
      sucesso: true,
      mensagem: "Produto atualizado com sucesso"
    }
  },

  removerProduto(id) {
    produtos = produtos.filter((p) => p.id !== id)
    return { sucesso: true, mensagem: "Produto removido com sucesso" }
  },

  adicionarLote(lote) {
    const novo = {
      id: Date.now(),
      produto: lote.produto,
      lote: lote.lote,
      fabricacao: lote.fabricacao,
      validade: lote.validade,
      quantidade: Number(lote.quantidade) || 0,
      fornecedor: lote.fornecedor || ""
    }

    lotes.push(novo)

    const produto = produtos.find((p) => p.nome === lote.produto)
    if (produto) {
      produto.estoque += Number(lote.quantidade) || 0
    }

    movimentos.push({
      tipo: "Produção",
      produto: lote.produto,
      quantidade: Number(lote.quantidade) || 0
    })

    return {
      sucesso: true,
      mensagem: "Lote registrado com sucesso"
    }
  },

  registrarEntrada({ produto, quantidade }) {
    const p = produtos.find((item) => item.nome === produto)

    if (!p) {
      return { sucesso: false, mensagem: "Produto não encontrado" }
    }

    p.estoque += Number(quantidade) || 0

    movimentos.push({
      tipo: "Entrada",
      produto,
      quantidade: Number(quantidade) || 0
    })

    return { sucesso: true, mensagem: "Entrada registrada" }
  },

  registrarSaida({ produto, quantidade }) {
    const qtd = Number(quantidade) || 0
    const p = produtos.find((item) => item.nome === produto)

    if (!p) {
      return { sucesso: false, mensagem: "Produto não encontrado" }
    }

    if (p.estoque < qtd) {
      return { sucesso: false, mensagem: "Estoque insuficiente" }
    }

    let restante = qtd

    const lotesProduto = lotes
      .filter((l) => l.produto === produto && l.quantidade > 0)
      .sort((a, b) => new Date(a.fabricacao) - new Date(b.fabricacao))

    for (const lote of lotesProduto) {
      if (restante <= 0) break

      const retirar = Math.min(lote.quantidade, restante)
      lote.quantidade -= retirar
      restante -= retirar
    }

    p.estoque -= qtd

    movimentos.push({
      tipo: "Saída",
      produto,
      quantidade: qtd
    })

    return { sucesso: true, mensagem: "Saída registrada" }
  }
}

export default estoqueService