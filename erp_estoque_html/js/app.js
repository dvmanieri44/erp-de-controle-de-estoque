// ===============================
// CHAVES DO LOCAL STORAGE
// ===============================

const ERP_STORAGE_KEYS = {

  produtos: "erp_produtos",
  fornecedores: "erp_fornecedores",
  movimentacoes: "erp_movimentacoes",
  clientes: "erp_clientes",
  sessao: "erp_usuario_logado",
  tema: "erp_tema"

};


// ===============================
// USUÁRIOS DO SISTEMA
// ===============================

const ERP_USUARIOS = [

  { usuario: "admin", senha: "123", nome: "Administrador", tipo: "admin" },

  { usuario: "joao", senha: "1234", nome: "João Pedro", tipo: "operador" }

];


// ===============================
// STORAGE HELPERS
// ===============================

function readStorage(key, defaultValue = []) {

  try {

    const data = localStorage.getItem(key);

    return data ? JSON.parse(data) : defaultValue;

  } catch {

    return defaultValue;

  }

}

function writeStorage(key, value) {

  localStorage.setItem(key, JSON.stringify(value));

}


// ===============================
// PRODUTOS
// ===============================

function getProdutos() {

  return readStorage(ERP_STORAGE_KEYS.produtos, []);

}

function saveProdutos(produtos) {

  writeStorage(ERP_STORAGE_KEYS.produtos, produtos);

}


// ===============================
// FORNECEDORES
// ===============================

function getFornecedores() {

  return readStorage(ERP_STORAGE_KEYS.fornecedores, []);

}

function saveFornecedores(fornecedores) {

  writeStorage(ERP_STORAGE_KEYS.fornecedores, fornecedores);

}


// ===============================
// MOVIMENTAÇÕES
// ===============================

function getMovimentacoes() {

  return readStorage(ERP_STORAGE_KEYS.movimentacoes, []);

}

function saveMovimentacoes(movimentacoes) {

  writeStorage(ERP_STORAGE_KEYS.movimentacoes, movimentacoes);

}


// ===============================
// CLIENTES
// ===============================

function getClientes() {

  return readStorage(ERP_STORAGE_KEYS.clientes, []);

}

function saveClientes(clientes) {

  writeStorage(ERP_STORAGE_KEYS.clientes, clientes);

}


// ===============================
// USUÁRIO LOGADO
// ===============================

function getUsuarioLogado() {

  return readStorage(ERP_STORAGE_KEYS.sessao, null);

}

function setUsuarioLogado(usuario) {

  writeStorage(ERP_STORAGE_KEYS.sessao, usuario);

}

function clearUsuarioLogado() {

  localStorage.removeItem(ERP_STORAGE_KEYS.sessao);

}


// ===============================
// UTILIDADES
// ===============================

function gerarId() {

  return Date.now() + Math.floor(Math.random() * 1000);

}

function formatCurrency(value) {

  return new Intl.NumberFormat("pt-BR", {

    style: "currency",
    currency: "BRL"

  }).format(Number(value || 0));

}

function formatDate(dateStr) {

  if (!dateStr) return "-";

  const date = new Date(dateStr + "T00:00:00");

  return date.toLocaleDateString("pt-BR");

}

function getTodayISO() {

  return new Date().toISOString().split("T")[0];

}

function escapeHtml(text) {

  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ===============================
// STATUS DE ESTOQUE
// ===============================

function getStatusEstoque(quantidade, estoqueMinimo = 5) {

  const qtd = Number(quantidade || 0);
  const minimo = Number(estoqueMinimo || 0);

  if (qtd <= 0) {

    return { texto: "🔴 Sem estoque", classe: "badge badge-danger" };

  }

  if (qtd <= minimo) {

    return { texto: "🟡 Estoque baixo", classe: "badge badge-warning" };

  }

  return { texto: "🟢 Em estoque", classe: "badge badge-success" };

}


// ===============================
// TOAST (NOTIFICAÇÕES)
// ===============================

function showToast(message, type = "success") {

  const container = document.getElementById("toastContainer");

  if (!container) return;

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {

    toast.remove();

  }, 3000);

}


// ===============================
// TEMA
// ===============================

function aplicarTemaSalvo() {

  const tema = localStorage.getItem(ERP_STORAGE_KEYS.tema) || "light";

  document.body.classList.toggle("dark", tema === "dark");

}

function alternarTema() {

  const escuro = document.body.classList.toggle("dark");

  localStorage.setItem(ERP_STORAGE_KEYS.tema, escuro ? "dark" : "light");

}


// ===============================
// DATA DO SISTEMA
// ===============================

function atualizarDataAtual() {

  const el = document.getElementById("dataAtual");

  if (el) {

    el.textContent = new Date().toLocaleDateString("pt-BR");

  }

}


// ===============================
// USUÁRIO NA TELA
// ===============================

function atualizarUsuarioNaTela() {

  const usuario = getUsuarioLogado();

  const nome = usuario?.nome || "Usuário";

  const sidebarUser = document.getElementById("sidebarUser");

  const topbarUser = document.getElementById("topbarUser");

  if (sidebarUser) sidebarUser.textContent = `👤 ${nome}`;

  if (topbarUser) topbarUser.textContent = `👤 ${nome}`;

}


// ===============================
// LOGIN
// ===============================

function controlarLogin() {

  const loginOverlay = document.getElementById("loginOverlay");

  const loginForm = document.getElementById("loginForm");

  if (!loginOverlay || !loginForm) return;

  const usuarioLogado = getUsuarioLogado();

  if (usuarioLogado) {

    loginOverlay.classList.remove("show");

    atualizarUsuarioNaTela();

  } else {

    loginOverlay.classList.add("show");

  }

  loginForm.addEventListener("submit", (event) => {

    event.preventDefault();

    const usuarioDigitado = document.getElementById("loginUsuario").value.trim();

    const senhaDigitada = document.getElementById("loginSenha").value.trim();

    const usuarioEncontrado = ERP_USUARIOS.find(

      u => u.usuario === usuarioDigitado && u.senha === senhaDigitada

    );

    if (!usuarioEncontrado) {

      showToast("Usuário ou senha incorretos", "error");

      return;

    }

    setUsuarioLogado(usuarioEncontrado);

    loginOverlay.classList.remove("show");

    atualizarUsuarioNaTela();

    showToast(`Bem-vindo, ${usuarioEncontrado.nome}!`);

  });

}


// ===============================
// LOGOUT
// ===============================

function controlarLogout() {

  const logoutBtn = document.getElementById("logoutBtn");

  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {

    clearUsuarioLogado();

    location.reload();

  });

}


// ===============================
// INICIALIZAÇÃO GLOBAL
// ===============================

document.addEventListener("DOMContentLoaded", () => {

  aplicarTemaSalvo();

  atualizarDataAtual();

  controlarLogin();

  controlarLogout();

  atualizarUsuarioNaTela();

  const themeToggle = document.getElementById("themeToggle");

  if (themeToggle) {

    themeToggle.addEventListener("click", alternarTema);

  }

});