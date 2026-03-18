import React from "react";
function Clientes() {
  return (
    <div className="page-box">
      <div className="page-box-header">
        <h2>Clientes</h2>
        <button>Novo Cliente</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Cidade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>João Pedro</td>
              <td>(16) 99999-1111</td>
              <td>joao@email.com</td>
              <td>Ribeirão Bonito</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Clientes;