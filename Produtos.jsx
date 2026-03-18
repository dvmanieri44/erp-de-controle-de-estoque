import React, { useEffect, useState } from "react"
import estoqueService from "../services/estoqueService"
import { exportarProdutosCSV } from "../utils/exportarCSV"
import CodigoBarras from "../components/CodigoBarras"

function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState("")

  const [idEditando, setIdEditando] = useState(null)
  const [nome, setNome] = useState("")
  const [categoria, setCategoria] = useState("")
  const [preco, setPreco] = useState("")
  const [validade, setValidade] = useState("")
  const [fornecedor, setFornecedor] = useState("")
  const [estoque, setEstoque] = useState("")
  const [estoqueMinimo, setEstoqueMinimo] = useState("")
  const [consumoMedio, setConsumoMedio] = useState("")
  const [codigoBarras, setCodigoBarras] = useState("")

  useEffect(() => {
    atualizar()
  }, [])

  function atualizar() {
    setProdutos([...estoqueService.listarProdutos()])
  }

  function gerarCodigoBarrasAutomatico() {
    return String(Date.now())
  }

  function limparFormulario() {
    setIdEditando(null)
    setNome("")
    setCategoria("")
    setPreco("")
    setValidade("")
    setFornecedor("")
    setEstoque("")
    setEstoqueMinimo("")
    setConsumoMedio("")
    setCodigoBarras("")
  }

  function cadastrarOuEditar() {
    if (!nome.trim()) {
      alert("Informe o nome do produto")
      return
    }

    const dados = {
      nome,
      categoria,
      preco,
      validade,
      fornecedor,
      estoque,
      estoqueMinimo,
      consumoMedio,
      codigoBarras: codigoBarras || gerarCodigoBarrasAutomatico()
    }

    let resultado

    if (idEditando) {
      resultado = estoqueService.editarProduto(idEditando, dados)
    } else {
      resultado = estoqueService.adicionarProduto(dados)
    }

    alert(resultado.mensagem)

    if (resultado.sucesso) {
      limparFormulario()
      atualizar()
    }
  }

  function editar(produto) {
    setIdEditando(produto.id)
    setNome(produto.nome || "")
    setCategoria(produto.categoria || "")
    setPreco(produto.preco || "")
    setValidade(produto.validade || "")
    setFornecedor(produto.fornecedor || "")
    setEstoque(produto.estoque || "")
    setEstoqueMinimo(produto.estoqueMinimo || "")
    setConsumoMedio(produto.consumoMedio || "")
    setCodigoBarras(produto.codigoBarras || "")
  }

  function excluir(id) {
    const resultado = estoqueService.removerProduto(id)
    alert(resultado.mensagem)
    atualizar()
  }

  const filtrados = produtos.filter((p) =>
    (p.nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (p.fornecedor || "").toLowerCase().includes(busca.toLowerCase()) ||
    (p.codigoBarras || "").toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Produtos</h1>
        <p>Cadastro e gestão de produtos</p>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            placeholder="Buscar por produto, fornecedor ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <button onClick={() => exportarProdutosCSV(produtos)}>
            Exportar CSV
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Categoria</label>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Fornecedor</label>
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Preço</label>
            <input type="number" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Validade</label>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Estoque inicial</label>
            <input type="number" value={estoque} onChange={(e) => setEstoque(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Estoque mínimo</label>
            <input
              type="number"
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Consumo médio diário</label>
            <input
              type="number"
              value={consumoMedio}
              onChange={(e) => setConsumoMedio(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Código de barras</label>
            <input
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Digite ou deixe vazio para gerar automático"
            />
          </div>
        </div>

        <div className="actions">
          <button onClick={cadastrarOuEditar}>
            {idEditando ? "Salvar Alterações" : "Adicionar Produto"}
          </button>

          {!idEditando && (
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setCodigoBarras(gerarCodigoBarrasAutomatico())}
            >
              Gerar código
            </button>
          )}

          {idEditando && (
            <button className="btn-secundario" onClick={limparFormulario}>
              Cancelar edição
            </button>
          )}
        </div>

        {codigoBarras && (
          <div style={{ marginTop: "20px" }}>
            <h3>Pré-visualização do código de barras</h3>
            <CodigoBarras codigo={codigoBarras} />
          </div>
        )}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Preço</th>
              <th>Validade</th>
              <th>Estoque</th>
              <th>Mínimo</th>
              <th>Código de barras</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.categoria}</td>
                <td>{p.fornecedor}</td>
                <td>R$ {Number(p.preco || 0).toFixed(2)}</td>
                <td>{p.validade}</td>
                <td>{p.estoque}</td>
                <td>{p.estoqueMinimo}</td>
                <td>
                  <CodigoBarras codigo={p.codigoBarras} />
                </td>
                <td>
                  <button onClick={() => editar(p)}>Editar</button>
                  <button className="btn-danger" onClick={() => excluir(p.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Produtos