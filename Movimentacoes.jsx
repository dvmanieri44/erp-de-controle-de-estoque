import React, { useEffect, useState } from "react"
import estoqueService from "../services/estoqueService"

function Movimentacoes() {
  const [movimentos, setMovimentos] = useState([])

  useEffect(() => {
    setMovimentos([...estoqueService.listarMovimentos()])
  }, [])

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Movimentações</h1>
        <p>Histórico do estoque</p>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Produto</th>
              <th>Quantidade</th>
            </tr>
          </thead>

          <tbody>
            {movimentos.map((m, i) => (
              <tr key={i}>
                <td>{m.tipo}</td>
                <td>{m.produto}</td>
                <td>{m.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Movimentacoes