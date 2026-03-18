import React from "react"
import { Link, useLocation } from "react-router-dom"

function Sidebar() {

  const location = useLocation()

  function ativo(path){
    return location.pathname === path ? "sidebar-link ativo" : "sidebar-link"
  }

  return (

    <div className="sidebar">

      <h2 className="logo">PetStock ERP</h2>

      <ul className="menu">

        <li>
          <Link className={ativo("/")} to="/">📊 Dashboard</Link>
        </li>

        <li>
          <Link className={ativo("/produtos")} to="/produtos">📦 Produtos</Link>
        </li>

        <li>
          <Link className={ativo("/entradas")} to="/entradas">⬆ Entradas</Link>
        </li>

        <li>
          <Link className={ativo("/saidas")} to="/saidas">⬇ Saídas</Link>
        </li>

        <li>
          <Link className={ativo("/lotes")} to="/lotes">🏷 Lotes</Link>
        </li>

        <li>
          <Link className={ativo("/movimentacoes")} to="/movimentacoes">📋 Movimentações</Link>
        </li>

        <li>
          <Link className={ativo("/relatorios")} to="/relatorios">📈 Relatórios</Link>
        </li>

      </ul>

    </div>

  )

}

export default Sidebar