import React, { useEffect, useState } from "react"
import estoqueService from "../services/estoqueService"

function Entradas() {
  const [produtos, setProdutos] = useState([])
  const [produto, setProduto] = useState("")
  const [quantidade, setQuantidade] = useState("")

  useEffect(() => {
    carregarProdutos()
  }, [])

  function carregarProdutos() {
    const dados = estoqueService.listarProdutos()
    setProdutos([...dados])
  }

  function registrar() {
    const resultado = estoqueService.registrarEntrada({
      produto,
      quantidade: Number(quantidade)
    })

    alert(resultado.mensagem)

    if (resultado.sucesso) {
      setProduto("")
      setQuantidade("")
      carregarProdutos()
    }
  }

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Entrada de Produtos</h1>
        <p>Registrar entrada no estoque</p>
      </div>

      <div className="card">
        <div className="form-group">
          <label>Produto</label>
          <select value={produto} onChange={(e) => setProduto(e.target.value)}>
            <option value="">Selecione</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.nome}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Quantidade</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <button onClick={registrar}>Registrar Entrada</button>
      </div>
    </div>
  )
}

export default Entradas