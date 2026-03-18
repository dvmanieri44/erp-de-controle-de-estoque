import React from "react";
function Fornecedores() {
  return (
    <div className="page-box">
      <div className="page-box-header">
        <h2>Fornecedores</h2>
        <button>Novo Fornecedor</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Empresa</th>
              <th>Telefone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Carlos Silva</td>
              <td>InfoTech</td>
              <td>(16) 99999-0000</td>
              <td>carlos@infotech.com</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Fornecedores;