import React, { useEffect, useState } from "react"
import estoqueService from "../services/estoqueService"
import CardInfo from "../components/CardInfo"
import GraficoEstoque from "../components/GraficoEstoque"
import GraficoMovimentacoes from "../components/GraficoMovimentacoes"

function Dashboard() {
  const [produtos, setProdutos] = useState([])
  const [lotes, setLotes] = useState([])
  const [movimentos, setMovimentos] = useState([])

  useEffect(() => {
    atualizarDashboard()
  }, [])

  function atualizarDashboard() {
    setProdutos([...estoqueService.listarProdutos()])
    setLotes([...estoqueService.listarLotes()])
    setMovimentos([...estoqueService.listarMovimentos()])
  }

  const estoqueTotal = produtos.reduce((acc, p) => acc + (p.estoque || 0), 0)

  const valorTotalEstoque = produtos.reduce(
    (acc, p) => acc + (Number(p.preco || 0) * Number(p.estoque || 0)),
    0
  )

  const baixo = produtos.filter(
    (p) => (p.estoque || 0) <= (p.estoqueMinimo || 0)
  )

  const hoje = new Date()

  const vencendo = lotes.filter((l) => {
    if (!l.validade) return false
    const validade = new Date(l.validade)
    const diff = (validade - hoje) / (1000 * 60 * 60 * 24)
    return diff <= 30 && diff >= 0
  })

  const vencidos = lotes.filter((l) => {
    if (!l.validade) return false
    return new Date(l.validade) < hoje
  })

  const previsaoRuptura = produtos
    .filter((p) => {
      if (!p.consumoMedio || Number(p.consumoMedio) <= 0) return false
      const dias = (p.estoque || 0) / p.consumoMedio
      return dias <= 7
    })
    .map((p) => ({
      ...p,
      diasRestantes: Math.floor((p.estoque || 0) / p.consumoMedio)
    }))

  const sugestaoCompra = produtos
    .filter((p) => (p.estoque || 0) <= (p.estoqueMinimo || 0))
    .map((p) => ({
      ...p,
      comprar: Math.max((p.estoqueMinimo || 0) * 2 - (p.estoque || 0), 0)
    }))

  const entradas = movimentos
    .filter((m) => m.tipo === "Entrada" || m.tipo === "Produção")
    .reduce((acc, m) => acc + (Number(m.quantidade) || 0), 0)

  const saidas = movimentos
    .filter((m) => m.tipo === "Saída")
    .reduce((acc, m) => acc + (Number(m.quantidade) || 0), 0)

  const produtosSemEstoque = produtos.filter((p) => (p.estoque || 0) <= 0)

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Dashboard</h1>
        <p>Visão geral do estoque</p>
      </div>

      <div className="cards">
        <CardInfo titulo="Produtos" valor={produtos.length} />
        <CardInfo titulo="Estoque total" valor={estoqueTotal} />
        <CardInfo titulo="Valor em estoque" valor={`R$ ${valorTotalEstoque.toFixed(2)}`} />
        <CardInfo titulo="Reposição" valor={baixo.length} />
        <CardInfo titulo="Sem estoque" valor={produtosSemEstoque.length} />
        <CardInfo titulo="Lotes" valor={lotes.length} />
        <CardInfo titulo="Movimentações" valor={movimentos.length} />
        <CardInfo titulo="Entradas" valor={entradas} />
        <CardInfo titulo="Saídas" valor={saidas} />
        <CardInfo titulo="Lotes vencidos" valor={vencidos.length} />
        <CardInfo titulo="Vencendo em 30 dias" valor={vencendo.length} />
        <CardInfo titulo="Ruptura em 7 dias" valor={previsaoRuptura.length} />
      </div>

      {(vencendo.length > 0 || vencidos.length > 0 || baixo.length > 0) && (
        <div className="alerta">
          ⚠ Atenção: existem produtos com estoque baixo, lotes vencidos ou próximos da validade.
        </div>
      )}

      <div className="grid-dashboard">
        <div className="card">
          <h2>Estoque por produto</h2>
          <GraficoEstoque dados={produtos} />
        </div>

        <div className="card">
          <h2>Movimentações</h2>
          <GraficoMovimentacoes dados={movimentos} />
        </div>
      </div>

      <div className="grid-dashboard">
        <div className="card">
          <h2>Produtos com estoque baixo</h2>

          {baixo.length === 0 ? (
            <p>Nenhum produto com estoque baixo.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {baixo.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.estoque}</td>
                    <td>{p.estoqueMinimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Sugestão de compra</h2>

          {sugestaoCompra.length === 0 ? (
            <p>Nenhum produto precisa de reposição agora.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque atual</th>
                  <th>Mínimo</th>
                  <th>Sugerido comprar</th>
                </tr>
              </thead>
              <tbody>
                {sugestaoCompra.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.estoque}</td>
                    <td>{p.estoqueMinimo}</td>
                    <td>{p.comprar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid-dashboard">
        <div className="card">
          <h2>Produtos com ruptura próxima</h2>

          {previsaoRuptura.length === 0 ? (
            <p>Nenhum produto com ruptura prevista para os próximos 7 dias.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque</th>
                  <th>Consumo médio</th>
                  <th>Dias restantes</th>
                </tr>
              </thead>
              <tbody>
                {previsaoRuptura.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.estoque}</td>
                    <td>{p.consumoMedio}</td>
                    <td>{p.diasRestantes} dias</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Lotes vencendo em até 30 dias</h2>

          {vencendo.length === 0 ? (
            <p>Nenhum lote próximo da validade.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Lote</th>
                  <th>Validade</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {vencendo.map((l) => (
                  <tr key={l.id}>
                    <td>{l.produto}</td>
                    <td>{l.lote}</td>
                    <td>{l.validade}</td>
                    <td>{l.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Lotes vencidos</h2>

        {vencidos.length === 0 ? (
          <p>Nenhum lote vencido.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Lote</th>
                <th>Validade</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {vencidos.map((l) => (
                <tr key={l.id}>
                  <td>{l.produto}</td>
                  <td>{l.lote}</td>
                  <td>{l.validade}</td>
                  <td>{l.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Dashboard