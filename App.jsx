import React from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"

import Sidebar from "./components/Sidebar"
import Header from "./components/Header"

import Dashboard from "./pages/Dashboard"
import Produtos from "./pages/Produtos"
import Entradas from "./pages/Entradas"
import Saidas from "./pages/Saidas"
import Relatorios from "./pages/Relatorios"
import Movimentacoes from "./pages/Movimentacoes"
import Lotes from "./pages/Lotes"

import "./style.css"

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Sidebar />

        <div className="main-content">
          <Header />

          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/entradas" element={<Entradas />} />
              <Route path="/saidas" element={<Saidas />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/movimentacoes" element={<Movimentacoes />} />
              <Route path="/lotes" element={<Lotes />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  )
}

export default App