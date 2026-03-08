import streamlit as st
import pandas as pd
import os
from datetime import datetime

st.set_page_config(page_title="ERP Controle de Estoque", layout="wide")

# =========================
# LOGIN
# =========================
usuarios = {
    "admin": "123",
    "joao": "1234"
}

if "logado" not in st.session_state:
    st.session_state.logado = False

if "usuario" not in st.session_state:
    st.session_state.usuario = ""

if "cancelar_produto" not in st.session_state:
    st.session_state.cancelar_produto = False

if not st.session_state.logado:
    st.title("🔐 Login do Sistema")

    usuario = st.text_input("Usuário")
    senha = st.text_input("Senha", type="password")

    if st.button("Entrar"):
        if usuario in usuarios and usuarios[usuario] == senha:
            st.session_state.logado = True
            st.session_state.usuario = usuario
            st.rerun()
        else:
            st.error("Usuário ou senha incorretos")

    st.stop()

# =========================
# ESTILO
# =========================
st.markdown("""
<style>
.main {
    background-color: #f5f7fa;
}
.topbar {
    background: white;
    padding: 14px 18px;
    border-radius: 14px;
    border: 1px solid #e6eaf0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    margin-bottom: 18px;
}
.topbar-title {
    font-size: 26px;
    font-weight: 700;
    color: #1f2937;
}
.topbar-sub {
    font-size: 14px;
    color: #6b7280;
}
div[data-testid="stMetric"] {
    background-color: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    border: 1px solid #e6eaf0;
}
.block-card {
    background: white;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid #e6eaf0;
}
</style>
""", unsafe_allow_html=True)

# =========================
# TOPO
# =========================
st.markdown(f"""
<div class="topbar">
    <div class="topbar-title">📦 ERP - Controle de Estoque</div>
    <div class="topbar-sub">Usuário logado: {st.session_state.usuario}</div>
</div>
""", unsafe_allow_html=True)

# =========================
# MENU LATERAL
# =========================
st.sidebar.title("📦 ERP Estoque")
st.sidebar.markdown("Sistema de Controle de Estoque")
st.sidebar.write(f"👤 Usuário: {st.session_state.usuario}")

if st.sidebar.button("🚪 Sair"):
    st.session_state.logado = False
    st.session_state.usuario = ""
    st.rerun()

# =========================
# ARQUIVOS
# =========================
arquivo = "produtos.csv"
arquivo_fornecedores = "fornecedores.csv"
arquivo_movimentacoes = "movimentacoes.csv"

if not os.path.exists(arquivo):
    df = pd.DataFrame(columns=[
        "ID", "Produto", "Categoria", "Quantidade", "Preço",
        "Fornecedor", "Estoque_Minimo"
    ])
    df.to_csv(arquivo, index=False)

if not os.path.exists(arquivo_fornecedores):
    df_fornecedores = pd.DataFrame(columns=["ID", "Fornecedor", "Contato", "Telefone", "Email"])
    df_fornecedores.to_csv(arquivo_fornecedores, index=False)

if not os.path.exists(arquivo_movimentacoes):
    df_movimentacoes = pd.DataFrame(
        columns=["Produto", "Tipo", "Quantidade", "Data", "Destino", "Usuario"]
    )
    df_movimentacoes.to_csv(arquivo_movimentacoes, index=False)

df = pd.read_csv(arquivo)
df_fornecedores = pd.read_csv(arquivo_fornecedores)
df_movimentacoes = pd.read_csv(arquivo_movimentacoes)

# garantir colunas em arquivos antigos
if "Destino" not in df_movimentacoes.columns:
    df_movimentacoes["Destino"] = ""

if "Usuario" not in df_movimentacoes.columns:
    df_movimentacoes["Usuario"] = ""

df_movimentacoes.to_csv(arquivo_movimentacoes, index=False)

# garantir colunas em arquivos antigos
if "Fornecedor" not in df.columns:
    df["Fornecedor"] = ""

if "Estoque_Minimo" not in df.columns:
    df["Estoque_Minimo"] = 5

df["Estoque_Minimo"] = pd.to_numeric(df["Estoque_Minimo"], errors="coerce").fillna(5).astype(int)
df["Quantidade"] = pd.to_numeric(df["Quantidade"], errors="coerce").fillna(0).astype(int)
df["Preço"] = pd.to_numeric(df["Preço"], errors="coerce").fillna(0.0)

df.to_csv(arquivo, index=False)

menu = st.sidebar.selectbox(
    "Menu",
    [
        "Dashboard",
        "Produtos",
        "Entrada de Estoque",
        "Saída de Estoque",
        "Relatórios",
        "Fornecedores",
        "Configurações"
    ]
)

# =========================
# FUNÇÕES AUXILIARES
# =========================
def definir_status(qtd, minimo):
    if qtd == 0:
        return "🔴 Sem estoque"
    elif qtd <= minimo:
        return "🟡 Baixo estoque"
    else:
        return "🟢 Em estoque"

# =========================
# DASHBOARD
# =========================
if menu == "Dashboard":
    st.subheader("📊 Visão geral do estoque")

    total_produtos = len(df)
    total_quantidade = int(df["Quantidade"].sum()) if not df.empty else 0
    produtos_baixo = len(df[(df["Quantidade"] > 0) & (df["Quantidade"] <= df["Estoque_Minimo"])]) if not df.empty else 0
    produtos_sem_estoque = len(df[df["Quantidade"] == 0]) if not df.empty else 0

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("📦 Produtos cadastrados", total_produtos)
    col2.metric("📊 Itens em estoque", total_quantidade)
    col3.metric("🟡 Estoque baixo", produtos_baixo)
    col4.metric("🔴 Sem estoque", produtos_sem_estoque)

    st.divider()

    st.subheader("📋 Produtos cadastrados")
    if not df.empty:
        dashboard_df = df.copy()
        dashboard_df["Status"] = dashboard_df.apply(
            lambda row: definir_status(row["Quantidade"], row["Estoque_Minimo"]), axis=1
        )
        st.dataframe(dashboard_df, use_container_width=True)
    else:
        st.info("Ainda não há produtos cadastrados.")

    st.subheader("⚠️ Alerta de estoque baixo")
    if not df.empty:
        estoque_baixo_df = df[
            (df["Quantidade"] > 0) & (df["Quantidade"] <= df["Estoque_Minimo"])
        ].copy()

        if not estoque_baixo_df.empty:
            estoque_baixo_df["Status"] = estoque_baixo_df.apply(
                lambda row: definir_status(row["Quantidade"], row["Estoque_Minimo"]), axis=1
            )
            st.warning("Existem produtos com estoque baixo.")
            st.dataframe(
                estoque_baixo_df[
                    ["ID", "Produto", "Categoria", "Fornecedor", "Quantidade", "Estoque_Minimo", "Preço"]
                ],
                use_container_width=True
            )
        else:
            st.success("Nenhum produto com estoque baixo.")
    else:
        st.info("Ainda não há produtos cadastrados.")

    st.subheader("📈 Quantidade em estoque por produto")
    if not df.empty:
        st.bar_chart(df.set_index("Produto")["Quantidade"])
    else:
        st.info("Ainda não há produtos cadastrados.")

    st.subheader("📊 Movimentação de estoque")
    if not df_movimentacoes.empty:
        resumo_mov = df_movimentacoes.groupby(["Produto", "Tipo"])["Quantidade"].sum().unstack(fill_value=0)
        st.bar_chart(resumo_mov)
    else:
        st.info("Ainda não há movimentações registradas.")

    st.subheader("🕒 Últimas movimentações")
    if not df_movimentacoes.empty:
        ultimas_movimentacoes = df_movimentacoes.tail(5).iloc[::-1]
        st.dataframe(
            ultimas_movimentacoes[["Produto", "Tipo", "Quantidade", "Data", "Destino", "Usuario"]],
            use_container_width=True
        )
    else:
        st.info("Ainda não há movimentações registradas.")

# =========================
# PRODUTOS
# =========================
elif menu == "Produtos":
    st.subheader("Cadastro de Produtos")

    fornecedores_opcoes = [""] + df_fornecedores["Fornecedor"].dropna().astype(str).tolist() if not df_fornecedores.empty else [""]

    with st.form("novo_produto"):
        produto = st.text_input("Nome do produto")
        categoria = st.text_input("Categoria")
        quantidade = st.number_input("Quantidade", min_value=0, step=1)
        preco = st.number_input("Preço", min_value=0.0, step=0.01)
        fornecedor = st.selectbox("Fornecedor", fornecedores_opcoes)
        estoque_minimo = st.number_input("Estoque mínimo", min_value=0, value=5, step=1)

        col_salvar, col_cancelar = st.columns(2)
        salvar = col_salvar.form_submit_button("💾 Salvar")
        cancelar = col_cancelar.form_submit_button("❌ Cancelar")

        if cancelar:
            st.session_state.cancelar_produto = True
            st.rerun()

        if salvar:
            if produto.strip() == "":
                st.error("Digite o nome do produto.")
            else:
                novo_id = 1 if df.empty else int(df["ID"].max()) + 1

                novo_produto = pd.DataFrame([{
                    "ID": novo_id,
                    "Produto": produto,
                    "Categoria": categoria,
                    "Quantidade": int(quantidade),
                    "Preço": float(preco),
                    "Fornecedor": fornecedor,
                    "Estoque_Minimo": int(estoque_minimo)
                }])

                df = pd.concat([df, novo_produto], ignore_index=True)
                df.to_csv(arquivo, index=False)

                st.success("Produto cadastrado com sucesso!")
                st.rerun()

    if st.session_state.cancelar_produto:
        st.info("Cadastro cancelado.")
        st.session_state.cancelar_produto = False

    st.subheader("Lista de produtos")

    busca_nome = st.text_input("🔎 Buscar por nome")
    busca_codigo = st.text_input("🔢 Buscar por código")

    categorias = ["Todas"] + sorted(df["Categoria"].dropna().astype(str).unique().tolist()) if not df.empty else ["Todas"]
    busca_categoria = st.selectbox("📂 Filtrar por categoria", categorias)

    resultado = df.copy()

    if busca_nome:
        resultado = resultado[resultado["Produto"].astype(str).str.contains(busca_nome, case=False, na=False)]

    if busca_codigo:
        resultado = resultado[resultado["ID"].astype(str).str.contains(busca_codigo, case=False, na=False)]

    if busca_categoria != "Todas":
        resultado = resultado[resultado["Categoria"] == busca_categoria]

    resultado_exibir = resultado.copy()
    if not resultado_exibir.empty:
        resultado_exibir["Status"] = resultado_exibir.apply(
            lambda row: definir_status(row["Quantidade"], row["Estoque_Minimo"]), axis=1
        )

    st.dataframe(resultado_exibir, use_container_width=True)

    st.subheader("✏️ Editar produto")

    if not df.empty:
        produto_editar = st.selectbox(
            "Selecione o produto para editar",
            df["Produto"],
            key="editar_produto_select"
        )
        linha = df[df["Produto"] == produto_editar].iloc[0]

        fornecedores_edicao = [""] + df_fornecedores["Fornecedor"].dropna().astype(str).tolist() if not df_fornecedores.empty else [""]
        fornecedor_atual = linha["Fornecedor"] if str(linha["Fornecedor"]) in fornecedores_edicao else ""

        with st.form("editar_produto_form"):
            novo_nome = st.text_input("Nome do produto", value=str(linha["Produto"]))
            nova_categoria = st.text_input("Categoria", value=str(linha["Categoria"]))
            nova_quantidade = st.number_input("Quantidade", min_value=0, value=int(linha["Quantidade"]), step=1)
            novo_preco = st.number_input("Preço", min_value=0.0, value=float(linha["Preço"]), step=0.01)
            novo_fornecedor = st.selectbox(
                "Fornecedor",
                fornecedores_edicao,
                index=fornecedores_edicao.index(fornecedor_atual) if fornecedor_atual in fornecedores_edicao else 0
            )
            novo_estoque_minimo = st.number_input(
                "Estoque mínimo",
                min_value=0,
                value=int(linha["Estoque_Minimo"]),
                step=1
            )

            atualizar = st.form_submit_button("Atualizar produto")

            if atualizar:
                idx = df[df["Produto"] == produto_editar].index[0]
                df.at[idx, "Produto"] = novo_nome
                df.at[idx, "Categoria"] = nova_categoria
                df.at[idx, "Quantidade"] = int(nova_quantidade)
                df.at[idx, "Preço"] = float(novo_preco)
                df.at[idx, "Fornecedor"] = novo_fornecedor
                df.at[idx, "Estoque_Minimo"] = int(novo_estoque_minimo)
                df.to_csv(arquivo, index=False)

                st.success("Produto atualizado com sucesso!")
                st.rerun()
    else:
        st.info("Não há produtos cadastrados para editar.")

    st.subheader("🗑️ Excluir produto")

    if not df.empty:
        produto_excluir = st.selectbox(
            "Selecione o produto para excluir",
            df["Produto"],
            key="excluir_produto_select"
        )

        if st.button("Excluir produto"):
            df = df[df["Produto"] != produto_excluir]
            df.to_csv(arquivo, index=False)
            st.success("Produto excluído com sucesso!")
            st.rerun()
    else:
        st.info("Não há produtos cadastrados para excluir.")

# =========================
# ENTRADA
# =========================
elif menu == "Entrada de Estoque":
    st.subheader("Registrar entrada de produto")

    if not df.empty:
        produto = st.selectbox("Produto", df["Produto"])
        quantidade = st.number_input("Quantidade", min_value=1, step=1)

        if st.button("Registrar entrada"):
            df.loc[df["Produto"] == produto, "Quantidade"] += int(quantidade)
            df.to_csv(arquivo, index=False)

            nova_movimentacao = pd.DataFrame([{
                "Produto": produto,
                "Tipo": "Entrada",
                "Quantidade": int(quantidade),
                "Data": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "Destino": "",
                "Usuario": st.session_state.usuario
            }])

            df_movimentacoes = pd.concat([df_movimentacoes, nova_movimentacao], ignore_index=True)
            df_movimentacoes.to_csv(arquivo_movimentacoes, index=False)

            st.success("Entrada registrada!")
            st.rerun()
    else:
        st.info("Não há produtos cadastrados.")

# =========================
# SAÍDA
# =========================
elif menu == "Saída de Estoque":
    st.subheader("Registrar saída de produto")

    if not df.empty:
        produto = st.selectbox("Produto", df["Produto"])
        quantidade = st.number_input("Quantidade", min_value=1, step=1)
        destino = st.text_input("Destino da saída (ex: cliente, setor, loja)")

        if st.button("Registrar saída"):
            estoque_atual = int(df.loc[df["Produto"] == produto, "Quantidade"].values[0])

            if estoque_atual >= int(quantidade):
                df.loc[df["Produto"] == produto, "Quantidade"] -= int(quantidade)
                df.to_csv(arquivo, index=False)

                nova_movimentacao = pd.DataFrame([{
                    "Produto": produto,
                    "Tipo": "Saída",
                    "Quantidade": int(quantidade),
                    "Data": datetime.now().strftime("%d/%m/%Y %H:%M"),
                    "Destino": destino,
                    "Usuario": st.session_state.usuario
                }])

                df_movimentacoes = pd.concat([df_movimentacoes, nova_movimentacao], ignore_index=True)
                df_movimentacoes.to_csv(arquivo_movimentacoes, index=False)

                st.success("Saída registrada!")
                st.rerun()
            else:
                st.error("Estoque insuficiente para realizar a saída.")
    else:
        st.info("Não há produtos cadastrados.")

# =========================
# RELATÓRIOS
# =========================
elif menu == "Relatórios":
    st.subheader("📑 Relatórios de Estoque")

    total_produtos = len(df)
    total_quantidade = int(df["Quantidade"].sum()) if not df.empty else 0
    estoque_baixo_df = df[
        (df["Quantidade"] > 0) & (df["Quantidade"] <= df["Estoque_Minimo"])
    ] if not df.empty else pd.DataFrame()
    sem_estoque_df = df[df["Quantidade"] == 0] if not df.empty else pd.DataFrame()

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("📦 Total de produtos", total_produtos)
    col2.metric("📊 Quantidade total", total_quantidade)
    col3.metric("🟡 Estoque baixo", len(estoque_baixo_df))
    col4.metric("🔴 Sem estoque", len(sem_estoque_df))

    st.divider()

    relatorio_df = df.copy()
    if not relatorio_df.empty:
        relatorio_df["Status"] = relatorio_df.apply(
            lambda row: definir_status(row["Quantidade"], row["Estoque_Minimo"]),
            axis=1
        )

        relatorio_df = relatorio_df[
            ["ID", "Produto", "Categoria", "Fornecedor", "Quantidade", "Estoque_Minimo", "Preço", "Status"]
        ]

    st.subheader("Relatório geral de produtos")
    st.dataframe(relatorio_df, use_container_width=True)

    st.subheader("Produtos com estoque baixo")
    if not estoque_baixo_df.empty:
        st.dataframe(
            estoque_baixo_df[
                ["ID", "Produto", "Categoria", "Fornecedor", "Quantidade", "Estoque_Minimo", "Preço"]
            ],
            use_container_width=True
        )
    else:
        st.success("Nenhum produto com estoque baixo.")

    st.subheader("Produtos sem estoque")
    if not sem_estoque_df.empty:
        st.dataframe(
            sem_estoque_df[
                ["ID", "Produto", "Categoria", "Fornecedor", "Quantidade", "Estoque_Minimo", "Preço"]
            ],
            use_container_width=True
        )
    else:
        st.success("Nenhum produto sem estoque.")

    csv = relatorio_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "⬇️ Baixar relatório em CSV",
        csv,
        "relatorio_estoque.csv",
        "text/csv"
    )

    st.divider()

    st.subheader("📦 Histórico de movimentações")
    if not df_movimentacoes.empty:
        st.dataframe(
            df_movimentacoes[["Produto", "Tipo", "Quantidade", "Data", "Destino", "Usuario"]],
            use_container_width=True
        )
    else:
        st.info("Ainda não há movimentações registradas.")

# =========================
# FORNECEDORES
# =========================
elif menu == "Fornecedores":
    st.subheader("🏢 Cadastro de Fornecedores")

    with st.form("novo_fornecedor"):
        nome = st.text_input("Nome do fornecedor")
        contato = st.text_input("Contato")
        telefone = st.text_input("Telefone")
        email = st.text_input("Email")

        salvar = st.form_submit_button("Cadastrar fornecedor")

        if salvar:
            if nome.strip() == "":
                st.error("Digite o nome do fornecedor.")
            else:
                novo_id = 1 if df_fornecedores.empty else int(df_fornecedores["ID"].max()) + 1

                novo_fornecedor = pd.DataFrame([{
                    "ID": novo_id,
                    "Fornecedor": nome,
                    "Contato": contato,
                    "Telefone": telefone,
                    "Email": email
                }])

                df_fornecedores = pd.concat([df_fornecedores, novo_fornecedor], ignore_index=True)
                df_fornecedores.to_csv(arquivo_fornecedores, index=False)

                st.success("Fornecedor cadastrado com sucesso!")
                st.rerun()

    st.subheader("Lista de fornecedores")
    st.dataframe(df_fornecedores, use_container_width=True)

# =========================
# CONFIGURAÇÕES
# =========================
elif menu == "Configurações":
    st.subheader("⚙️ Configurações do Sistema")

    st.write("Usuário logado:")
    st.info(st.session_state.usuario)

    st.write("Versão do sistema:")
    st.info("ERP Controle de Estoque v2.0")

    st.divider()

    st.write("Opções futuras:")
    st.write("- Alterar senha")
    st.write("- Gerenciar usuários")
    st.write("- Backup de dados")