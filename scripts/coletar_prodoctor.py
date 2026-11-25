#Coleta dados do ProDoctor e guarda a resposta BRUTA em arquivos.

#Este é o primeiro passo do projeto: trazer uma cópia dos dados para casa.
#Nao altera nada no ProDoctor. So le.

#Como usar:
#    python3 scripts/coletar_prodoctor.py

#Precisa do arquivo .env na raiz do projeto (veja .env.example).

import json
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib import request, error

# Pasta raiz do projeto (a pasta que contem este script)
RAIZ = Path(__file__).resolve().parent.parent
ARQUIVO_ENV = RAIZ / ".env"
PASTA_DADOS = RAIZ / "dados_brutos"


# -----------------------------------------------------------------------------
# 1. Ler o arquivo .env (onde estao as chaves)
# -----------------------------------------------------------------------------
def carregar_env():
    if not ARQUIVO_ENV.exists():
        print("ERRO: nao achei o arquivo .env na raiz do projeto.")
        print("Copie .env.example para .env e preencha suas chaves.")
        sys.exit(1)

    valores = {}
    for linha in ARQUIVO_ENV.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valores[chave.strip()] = valor.strip().strip('"').strip("'")

    obrigatorias = ["X_APIKEY", "X_APIPASSWORD"]
    faltando = [c for c in obrigatorias if not valores.get(c) or "cole_" in valores[c]]
    if faltando:
        print("ERRO: preencha no .env: " + ", ".join(faltando))
        sys.exit(1)

    return valores


# -----------------------------------------------------------------------------
# 2. Periodo padrao: o mes anterior
# -----------------------------------------------------------------------------
def mes_anterior():
    hoje = date.today()
    primeiro_deste_mes = hoje.replace(day=1)
    ultimo_anterior = primeiro_deste_mes - timedelta(days=1)
    primeiro_anterior = ultimo_anterior.replace(day=1)
    return primeiro_anterior.strftime("%d/%m/%Y"), ultimo_anterior.strftime("%d/%m/%Y")


def periodo_questionado():
    inicio_padrao, fim_padrao = mes_anterior()
    print(f"\nPeriodo sugerido (mes anterior): {inicio_padrao} a {fim_padrao}")
    print("Dê ENTER para aceitar, ou digite outro no formato DD/MM/YYYY")
    inicio = input(f"  De [{inicio_padrao}]: ").strip() or inicio_padrao
    fim = input(f"  Ate [{fim_padrao}]: ").strip() or fim_padrao
    return {"dataInicial": inicio, "dataFinal": fim}


# -----------------------------------------------------------------------------
# 3. Os enderecos que vamos chamar
#    Cada entrada diz: nome do arquivo, endereco, e como montar o pedido
# -----------------------------------------------------------------------------
def montar_endpoints(periodo, filtros=None):
    """Monta as chamadas. Os filtros vem dos cadastros ja baixados (opcao 0)."""
    filtros = filtros or {}
    return {
        "1": {
            "titulo": "Unidades (Locais ProDoctor)",
            "arquivo": "locais",
            "caminho": "/api/v1/LocaisProDoctor",
            "lista": "locaisProDoctor",
            "corpo": {"pagina": 1, "quantidade": 5000, "somenteAtivos": True},
        },
        "2": {
            "titulo": "Usuarios (medicos e funcionarios)",
            "arquivo": "usuarios",
            "caminho": "/api/v1/Usuarios",
            "lista": "usuarios",
            "corpo": {"pagina": 1, "quantidade": 5000, "somenteAtivos": True},
        },
        "3": {
            "titulo": "Convenios",
            "arquivo": "convenios",
            "caminho": "/api/v1/Convenios",
            "lista": "convenios",
            "corpo": {"pagina": 1, "quantidade": 5000, "somenteAtivos": True},
        },
        "4": {
            "titulo": "Faturas de convenio",
            "arquivo": "faturas",
            "caminho": "/api/v1/Exportacoes/GerenciarFaturas",
            "lista": "registros",
            "corpo": {
                "pagina": 1,
                "tipoPeriodo": 0,
                "periodo": periodo,
                "convenios": filtros.get("convenios", []),
                "locaisProDoctor": filtros.get("locais", []),
                "situacaoAberta": True,
                "situacaoFechada": True,
            },
        },
        "5": {
            "titulo": "Procedimentos das contas",
            "arquivo": "procedimentos",
            "caminho": "/api/v1/Exportacoes/ProcedimentosContasPacientes",
            "lista": "registros",
            "corpo": {
                "pagina": 1,
                "periodo": periodo,
                "convenios": filtros.get("convenios", []),
                "usuarios": filtros.get("usuarios", []),
                "locaisProDoctor": filtros.get("locais", []),
            },
        },
        "6": {
            "titulo": "Repasses dos medicos",
            "arquivo": "repasses",
            "caminho": "/api/v1/Exportacoes/Repasses",
            "lista": "registros",
            "corpo": {
                "pagina": 1,
                "periodo": periodo,
                "locaisProDoctor": filtros.get("locais", []),
                "convenios": filtros.get("convenios", []),
                "usuarios": filtros.get("usuarios", []),
            },
        },
        "7": {
            "titulo": "Contas a pagar/receber (grupo de receita/despesa)",
            "arquivo": "contas_pagar_receber",
            "caminho": "/api/v1/Exportacoes/ContasPagarReceber",
            "lista": "registros",
            "corpo": {
                "pagina": 1,
                "tipoPeriodo": 0,
                "periodo": periodo,
                "tipos": [0, 2],
                "GruposReceitasDespesas": filtros.get("grupos", []),
                "ContasContabeis": filtros.get("contas_contabeis", []),
                "locaisProDoctor": filtros.get("locais", []),
                "convenios": filtros.get("convenios", []),
                "usuarios": filtros.get("usuarios", []),
            },
        },
        "8": {
            "titulo": "Grupos de receitas e despesas",
            "arquivo": "grupos_receitas_despesas",
            "caminho": "/api/v1/Financeiro/GruposReceitasDespesas",
            "lista": "gruposReceitasDespesas",
            "corpo": {"pagina": 1, "quantidade": 5000},
        },
        "9": {
            "titulo": "Contas contabeis (plano de contas)",
            "arquivo": "contas_contabeis",
            "caminho": "/api/v1/Financeiro/ContasContabeis",
            "lista": "contasContabeis",
            "corpo": {"pagina": 1, "quantidade": 5000},
        },
    }


# -----------------------------------------------------------------------------
# 4. Fazer a chamada
# -----------------------------------------------------------------------------
def chamar_api(caminho, corpo, env):
    base = env.get("PRODUTOR_BASE_URL", "https://open-api.prodoctor.net").rstrip("/")
    url = base + caminho

    # O JSON do pedido precisa ir como texto codificado
    dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")

    cabecalhos = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "HubGastrocenter-Coleta/1.0",
        "X-APIKEY": env["X_APIKEY"],
        "X-APIPASSWORD": env["X_APIPASSWORD"],
        "X-APITIMEZONE": env.get("X_APITIMEZONE", "-03:00"),
        "X-APITIMEZONENAME": env.get("X_APITIMEZONENAME", "America/Sao_Paulo"),
    }

    pedido = request.Request(url, data=dados, headers=cabecalhos, method="POST")

    with request.urlopen(pedido, timeout=90) as resposta:
        texto = resposta.read().decode("utf-8")
    return json.loads(texto)


# -----------------------------------------------------------------------------
# 5. Achar a lista de registros dentro da resposta
# -----------------------------------------------------------------------------
def extrair_registros(resposta, nome_lista):
    payload = resposta.get("payload") or {}
    if not isinstance(payload, dict):
        return []

    candidatos = [nome_lista, "registros"]

    # Nas rotas de exportacao, os registros ficam dentro de payload.exportacao
    exportacao = payload.get("exportacao") or {}
    if isinstance(exportacao, dict):
        for chave in candidatos:
            valor = exportacao.get(chave)
            if isinstance(valor, list):
                return valor

    for chave in candidatos:
        valor = payload.get(chave)
        if isinstance(valor, list):
            return valor

    return []


# -----------------------------------------------------------------------------
# 6. Montar os filtros obrigatorios das exportacoes a partir dos cadastros
#    A API exige pelo menos 1 local, 1 convenio e (em procedimentos) 1 usuario.
#    Os objetos de filtro sao so {"codigo": ...} - formato aceito pela API.
# -----------------------------------------------------------------------------
def carregar_filtros():
    filtros = {}
    if not PASTA_DADOS.exists():
        return filtros

    pastas = sorted((p for p in PASTA_DADOS.iterdir() if p.is_dir()), reverse=True)
    arquivos = {
        "locais": "locaisProDoctor",
        "usuarios": "usuarios",
        "convenios": "convenios",
        "grupos_receitas_despesas": "gruposReceitasDespesas",
        "contas_contabeis": "contasContabeis",
    }
    destinos = {
        "locais": "locais",
        "usuarios": "usuarios",
        "convenios": "convenios",
        "grupos_receitas_despesas": "grupos",
        "contas_contabeis": "contas_contabeis",
    }

    for nome, chave in arquivos.items():
        for pasta in pastas:
            caminho = pasta / f"{nome}.json"
            if not caminho.exists():
                continue
            try:
                resposta = json.loads(caminho.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                continue
            registros = extrair_registros(resposta, chave)
            codigos = [
                {"codigo": r["codigo"]}
                for r in registros
                if isinstance(r, dict) and "codigo" in r
            ]
            if codigos:
                filtros[destinos[nome]] = codigos
                break
    return filtros


# -----------------------------------------------------------------------------
# 7. Percorrer todas as paginas de um endpoint
#    Algumas rotas (ex.: Repasses) trazem 100 por pagina. Paramos quando uma
#    pagina volta vazia. As paginas extras sao salvas separadamente.
# -----------------------------------------------------------------------------
def colocar_registros(resposta, nome_lista, registros):
    """Devolve a resposta bruta da 1a pagina com a lista completa dentro."""
    payload = resposta.get("payload") or {}
    alvos = []
    if isinstance(payload, dict):
        alvos.append(payload)
        exportacao = payload.get("exportacao")
        if isinstance(exportacao, dict):
            alvos.append(exportacao)
    for alvo in alvos:
        for chave in (nome_lista, "registros"):
            if isinstance(alvo.get(chave), list):
                alvo[chave] = registros
                return resposta
    return resposta


def coletar_todas_paginas(ep, env):
    """Busca pagina por pagina ate nao haver mais registros."""
    todos = []
    resposta_base = None
    paginas_com_dados = 0
    pagina = 1

    while pagina <= 500:
        corpo = dict(ep["corpo"])
        corpo["pagina"] = pagina
        resposta = chamar_api(ep["caminho"], corpo, env)
        da_pagina = extrair_registros(resposta, ep["lista"])

        if resposta_base is None:
            resposta_base = resposta
        elif da_pagina:
            destino = PASTA_DADOS / date.today().isoformat()
            destino.mkdir(parents=True, exist_ok=True)
            caminho = destino / f"{ep['arquivo']}_pagina{pagina}.json"
            caminho.write_text(
                json.dumps(resposta, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"  Pagina {pagina} salva em: {caminho.relative_to(RAIZ)}")

        todos.extend(da_pagina)
        if da_pagina:
            paginas_com_dados += 1
        else:
            break
        pagina += 1

    if resposta_base is not None:
        resposta_base = colocar_registros(resposta_base, ep["lista"], todos)
    return resposta_base, todos, paginas_com_dados


# -----------------------------------------------------------------------------
# 8. Salvar o bruto e mostrar um exemplo
# -----------------------------------------------------------------------------
def salvar(nome_arquivo, resposta, registros, linhas_resumo):
    pasta = PASTA_DADOS / date.today().isoformat()
    pasta.mkdir(parents=True, exist_ok=True)

    caminho = pasta / f"{nome_arquivo}.json"
    caminho.write_text(
        json.dumps(resposta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n  Salvo em: {caminho.relative_to(RAIZ)}")
    print(f"  Registros encontrados: {len(registros)}")

    if registros and nome_arquivo in ("locais", "usuarios", "convenios"):
        print("  Exemplo do primeiro registro:")
        exemplo = json.dumps(registros[0], ensure_ascii=False, indent=2)
        print("\n".join("    " + linha for linha in exemplo.splitlines()[:25]))
    elif registros:
        print("  (exemplo omitido: dados financeiros podem conter nome de paciente)")

    linhas_resumo.append(f"- {nome_arquivo}: {len(registros)} registros -> {caminho.name}")


# -----------------------------------------------------------------------------
# 9. Menu
# -----------------------------------------------------------------------------
def main():
    print("=" * 64)
    print(" COLETA DE DADOS - ProDoctor / Hub Financeiro")
    print("=" * 64)
    print("Esta rotina so LE dados. Nao muda nada no ProDoctor.\n")

    env = carregar_env()
    periodo = None

    while True:
        print("\nEscolha o que quer trazer:")
        print("  1  Unidades (Sabin, Stella Central)")
        print("  2  Usuarios (medicos)")
        print("  3  Convenios")
        print("  4  Faturas (precisa de periodo)")
        print("  5  Procedimentos (precisa de periodo)")
        print("  6  Repasses (precisa de periodo)")
        print("  7  Contas a pagar/receber (precisa de periodo)")
        print("  8  Grupos de receitas e despesas")
        print("  9  Contas contabeis")
        print("  0  Todos os cadastros (1, 2, 3, 8 e 9)")
        print("  s  Sair\n")

        escolha = input("Opção: ").strip().lower()

        if escolha == "s":
            break

        if escolha == "0":
            escolhas = ["1", "2", "3", "8", "9"]
        elif escolha in ["4", "5", "6", "7"]:
            if periodo is None:
                periodo = periodo_questionado()
            escolhas = [escolha]
        elif escolha in ["1", "2", "3", "8", "9"]:
            escolhas = [escolha]
        else:
            print("  Opcao invalida. Tente de novo.")
            continue

        # As exportacoes financeiras exigem filtros preenchidos.
        filtros = {}
        if any(op in ("4", "5", "6", "7") for op in escolhas):
            filtros = carregar_filtros()
            obrigatorios = ["locais", "convenios", "usuarios"]
            if "7" in escolhas:
                obrigatorios += ["grupos", "contas_contabeis"]
            faltando = [nome for nome in obrigatorios if not filtros.get(nome)]
            if faltando:
                print("  AVISO: rode a opcao 0 (cadastros) antes das rotas financeiras.")
                print("  Cadastros nao encontrados: " + ", ".join(faltando))
                continue

        endpoints = montar_endpoints(periodo or {}, filtros)
        linhas_resumo = []

        for opcao in escolhas:
            ep = endpoints[opcao]
            print(f"\n-> Buscando: {ep['titulo']} ...")
            try:
                resposta, registros, paginas = coletar_todas_paginas(ep, env)
            except error.HTTPError as e:
                detalhe = e.read().decode("utf-8", errors="replace")[:500]
                print(f"  ERRO HTTP {e.code}: {detalhe}")
                if e.code == 401:
                    print("  Dica: chave ou senha errada no .env")
                elif e.code == 403:
                    print("  Dica: contrato inativo ou chave sem permissao para esta rota")
                elif e.code == 429:
                    print("  Dica: limite de 120 requisicoes/minuto. Espere 1 minuto.")
                elif e.code in (400, 500):
                    print("  Dica: a API exige filtros de local, convenio e usuario.")
                    print("  Rode a opcao 0 para baixar os cadastros antes.")
                continue
            except Exception as e:
                print(f"  ERRO: {e}")
                continue

            mensagem = resposta.get("message")
            if mensagem:
                print(f"  Aviso da API: {json.dumps(mensagem, ensure_ascii=False)[:300]}")

            if paginas > 1:
                print(f"  Paginas com dados: {paginas}")
            salvar(ep["arquivo"], resposta, registros, linhas_resumo)

        if linhas_resumo:
            resumo = PASTA_DADOS / date.today().isoformat() / "resumo.txt"
            with resumo.open("a", encoding="utf-8") as arquivo:
                arquivo.write("\n".join(linhas_resumo) + "\n")
            print(f"\n  Resumo atualizado: {resumo.relative_to(RAIZ)}")

    print("\nAte logo. Seus arquivos estao em dados_brutos/")


if __name__ == "__main__":
    main()
