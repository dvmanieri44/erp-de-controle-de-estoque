import React, { useEffect, useState } from "react"
import estoqueService from "../services/estoqueService"

function Lotes() {
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])

  const [produto, setProduto] = useState("")
  const [lote, setLote] = useState("")
  const [fabricacao, setFabricacao] = useState("")
  const [validade, setValidade] = useState("")
  const [quantidade, setQuantidade] = useState("")
  const [fornecedor, setFornecedor] = useState("")

  useEffect(() => {
    setProdutos([...estoqueService.listarProdutos()])
    setLotes([...estoqueService.listarLotes()])
  }, [])

  function registrar() {
    const resultado = estoqueService.adicionarLote({
      produto,
      lote,
      fabricacao,
      validade,
      quantidade,
      fornecedor
    })

    alert(resultado.mensagem)

    if (resultado.sucesso) {
      setProduto("")
      setLote("")
      setFabricacao("")
      setValidade("")
      setQuantidade("")
      setFornecedor("")
      setLotes([...estoqueService.listarLotes()])
      setProdutos([...estoqueService.listarProdutos()])
    }
  }

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Controle de Lotes</h1>
        <p>Registro de produção e validade</p>
      </div>

      <div className="card">
        <div className="form-grid">
          <div className="form-group">
            <label>Produto</label>
            <select value={produto} onChange={(e) => setProduto(e.target.value)}>
              <option value="">Selecione produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Número do lote</label>
            <input value={lote} onChange={(e) => setLote(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Fornecedor</label>
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Fabricação</label>
            <input type="date" value={fabricacao} onChange={(e) => setFabricacao(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Validade</label>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Quantidade</label>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
        </div>

        <button onClick={registrar}>Registrar Lote</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Lote</th>
              <th>Fornecedor</th>
              <th>Fabricação</th>
              <th>Validade</th>
              <th>Quantidade</th>
            </tr>
          </thead>

          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td>{l.produto}</td>
                <td>{l.lote}</td>
                <td>{l.fornecedor}</td>
                <td>{l.fabricacao}</td>
                <td>{l.validade}</td>
                <td>{l.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Lotes