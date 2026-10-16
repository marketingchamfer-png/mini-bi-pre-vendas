# Passo a passo: subir o Mini BI de Pré-Vendas no GitHub

> **Leia antes:** o `dashboard.html` e o `dados.json` contêm **nomes de clientes e valores
> comerciais**. Eles **não devem ir para o GitHub**, nem mesmo num repositório privado, e muito
> menos para o GitHub Pages (o Pages deixa o painel aberto para qualquer pessoa na internet).
>
> O que vai para o GitHub é **só o sistema** (script, configuração, modelo do painel). Assim o
> código fica guardado, com histórico de versões, e qualquer computador pode reinstalar o painel.
> Os dados continuam só na rede da Chamfer (unidade Y:).

## O que sobe e o que NÃO sobe

| Sobe (código) | NÃO sobe (dados) |
|---|---|
| `atualizar_dashboard.py` | `dashboard.html` |
| `atualizar.bat` | `dados.json` |
| `config.json` | `atualizacao.log` |
| `README.md`, `PASSO_A_PASSO_GITHUB.md`, `.gitignore` | qualquer `.xlsx` |
| pasta `recursos\` inteira | |

O arquivo `.gitignore` já está na pasta `BI` com essa lista de exclusão.

---

## Opção A — Pelo site do GitHub (sem instalar nada)

### 1. Criar o repositório **privado**
1. Entre em <https://github.com> com a conta da Chamfer (`marketingchamfer-png`).
2. Clique no **+** (canto superior direito) → **New repository**.
3. Preencha:
   - **Repository name:** `mini-bi-pre-vendas`
   - **Description:** `Mini BI de Pré-Vendas — script e modelo do painel (sem dados)`
   - Marque **Private** ⚠️ (obrigatório)
   - Não marque "Add a README" (já temos um).
4. Clique em **Create repository**.

### 2. Enviar os arquivos
1. Na página do repositório recém-criado, clique em **uploading an existing file**.
2. Abra no Explorador a pasta
   `Y:\2026\DEPARTAMENTO\PRÉ-VENDAS\GERAL\RELATÓRIOS SEMANAIS\BI`.
3. Selecione e arraste **apenas** estes itens para a página do GitHub:
   - `atualizar_dashboard.py`
   - `atualizar.bat`
   - `config.json`
   - `README.md`
   - `PASSO_A_PASSO_GITHUB.md`
   - `.gitignore` *(se não aparecer, no Explorador: Exibir → Mostrar → Itens ocultos)*
   - a pasta `recursos` (arraste a pasta inteira)
4. **Confira a lista antes de confirmar:** não pode aparecer `dashboard.html`, `dados.json`,
   `atualizacao.log` nem `.xlsx`. Se aparecer, clique no **X** ao lado para remover.
   *(O envio pelo site não respeita o `.gitignore`, por isso a conferência manual.)*
5. Em **Commit changes**, escreva: `Versão inicial do Mini BI de Pré-Vendas`.
6. Clique em **Commit changes**.

### 3. Atualizar depois de uma mudança
Quando alterar o `config.json` (ex.: novo status no mapa) ou o código:
1. Abra o arquivo no repositório → ícone de **lápis** (Edit) para editar ali mesmo, **ou**
   **Add file → Upload files** e arraste a versão nova (ela substitui a antiga).
2. Descreva a mudança (ex.: `Inclui status "Aguardando proposta" em Em andamento`) →
   **Commit changes**.

---

## Opção B — Pelo Git no computador (atualização com um comando)

Use se preferir sincronizar tudo de uma vez. Precisa do Git instalado uma vez:
`winget install Git.Git` (feche e abra o Prompt de Comando depois).

### 1. Criar o repositório privado
Igual à Opção A, passo 1.

### 2. Primeiro envio
No Prompt de Comando:

```
cd /d "Y:\2026\DEPARTAMENTO\PRÉ-VENDAS\GERAL\RELATÓRIOS SEMANAIS\BI"
git init
git branch -M main
git add .
git status
```

**Confira a saída do `git status`:** a lista "Changes to be committed" não pode ter
`dashboard.html`, `dados.json`, `atualizacao.log` nem `.xlsx` (o `.gitignore` já os exclui).
Se estiver tudo certo:

```
git commit -m "Versão inicial do Mini BI de Pré-Vendas"
git remote add origin https://github.com/marketingchamfer-png/mini-bi-pre-vendas.git
git push -u origin main
```

Na primeira vez abre uma janela para entrar na conta do GitHub; faça o login nela.

> Se o Git reclamar de "dubious ownership" por causa da unidade de rede, rode uma vez:
> `git config --global --add safe.directory "*"`

### 3. Enviar mudanças depois
```
cd /d "Y:\2026\DEPARTAMENTO\PRÉ-VENDAS\GERAL\RELATÓRIOS SEMANAIS\BI"
git add .
git commit -m "Descreva a mudança aqui"
git push
```

---

## Reinstalar o painel em outro lugar a partir do GitHub
1. No repositório: **Code → Download ZIP** e extraia dentro da pasta `RELATÓRIOS SEMANAIS\BI`.
2. Instale o Python e as bibliotecas (README, seção 1).
3. Dê duplo clique em `atualizar.bat`: o `dashboard.html` é gerado de novo a partir das planilhas.

## Se um arquivo de dados for enviado por engano
1. Apague o arquivo no repositório (abra-o → ícone de lixeira → Commit).
2. Isso **não** apaga o histórico: avise o responsável de TI. O caminho mais seguro é apagar o
   repositório (Settings → Danger Zone → Delete this repository) e criar de novo só com o código.

## Por que não usar o GitHub Pages para este painel
O dashboard de orçamentos (`dashboard-chamfer`) usa o Pages porque é público por natureza. Este
painel tem carteira de clientes, valores cotados e faturamento por vendedor. Para compartilhar com
o time, use o próprio `dashboard.html` na pasta de rede (todos com acesso à unidade Y: conseguem
abrir) ou envie o PDF gerado pelo botão **PDF** do painel.
