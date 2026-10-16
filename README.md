# Mini BI de Pré-Vendas — Chamfer

Painel interno que lê as planilhas semanais de leads e vendas desta pasta e gera
um arquivo único, `dashboard.html`, que abre em qualquer Chrome ou Edge, **sem
internet** e sem enviar dados para fora da rede.

```
RELATÓRIOS SEMANAIS\
├─ STATUS LEADS E VENDAS.xlsx               ← fonte 1 (aba "Geral")
├─ DISTRIBUIÇÃO DE LEADS E POTENCIAL.xlsx   ← fonte 2 (aba "Potencial dos leads")
└─ BI\
   ├─ atualizar.bat            ← duplo clique para atualizar
   ├─ dashboard.html           ← o painel (abrir este)
   ├─ dados.json               ← dados limpos e cruzados (gerado)
   ├─ atualizacao.log          ← histórico de cada atualização (gerado)
   ├─ config.json              ← mapas de status/itens, cores, limites, caminhos
   ├─ atualizar_dashboard.py   ← o script (ETL + geração do HTML)
   └─ recursos\                ← modelo do painel, Chart.js, SheetJS e fontes (embutidos no HTML)
```

## 1. Instalação (uma vez, só no computador que vai atualizar)

Quem só **olha** o painel não precisa instalar nada: basta abrir `dashboard.html`.

1. Instalar o Python 3.10 ou mais novo (sem precisar de administrador):
   `winget install Python.Python.3.12`
2. Instalar as bibliotecas:
   `"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -m pip install pandas openpyxl`

## 2. Como atualizar

- Salve a nova versão das planilhas na pasta `RELATÓRIOS SEMANAIS` (pode ser em subpastas).
- Dê **duplo clique em `BI\atualizar.bat`**. Em ~10 segundos o painel é regerado e abre sozinho.
- Para cada tipo de planilha o script usa **a versão com data de modificação mais recente**
  (empate: nome em ordem alfabética maior). Arquivos temporários do Excel (`~$...`) e a pasta `BI`
  são ignorados. O rodapé do painel mostra quais arquivos foram usados.
- Um novo mês de pedidos (ex.: coluna `Pedidos Novembro`) é reconhecido automaticamente.
- Se algo der errado (unidade Y: desconectada, planilha corrompida, aba renomeada), o
  `dashboard.html` anterior **é mantido** e o motivo fica em `atualizacao.log`.

## 3. Agendar no Agendador de Tarefas do Windows

Sugestão: todo dia às 7h e toda segunda-feira às 6h30. Abra o **Prompt de Comando** e rode
(ajuste a hora se quiser):

```
schtasks /Create /TN "Mini BI Pre-Vendas (diario)" /SC DAILY /ST 07:00 /TR "\"Y:\2026\DEPARTAMENTO\PRÉ-VENDAS\GERAL\RELATÓRIOS SEMANAIS\BI\atualizar.bat\" /silencioso"
schtasks /Create /TN "Mini BI Pre-Vendas (segunda)" /SC WEEKLY /D MON /ST 06:30 /TR "\"Y:\2026\DEPARTAMENTO\PRÉ-VENDAS\GERAL\RELATÓRIOS SEMANAIS\BI\atualizar.bat\" /silencioso"
```

Ou pela interface: Agendador de Tarefas → *Criar Tarefa Básica* → gatilho Diário →
ação *Iniciar um programa* → Programa: o caminho do `atualizar.bat` → Argumentos: `/silencioso`.
O argumento `/silencioso` evita que a janela fique esperando uma tecla.
A tarefa precisa rodar com o seu usuário logado (é ele que enxerga a unidade Y:).

## 4. Usando o painel

- **Abas:** Visão Geral, Vendedores, Potencial & Score, Geografia, Produtos, Perdas,
  Leads (detalhe) e Qualidade dos Dados. Setas ← → navegam entre abas pelo teclado.
- **Filtros globais** (período, vendedor, Score, status, região, UF, família de item e
  "Excluir outliers") valem para todas as abas. Clicar numa barra, bolha, linha da tabela ou
  estado do mapa aplica o filtro (filtragem cruzada). Os filtros aparecem como etiquetas
  removíveis e ficam no endereço da página: copie o endereço para compartilhar a mesma visão.
- **Exportar CSV** (aba Leads) gera um arquivo com separador `;` que abre direto no Excel.
- **PDF:** botão *PDF* → *Salvar como PDF* (A4 paisagem, sem menus).
- **Tema:** o painel usa sempre o tema claro, com o logo oficial da Chamfer no cabeçalho
  (`recursos\logo_chamfer.png`; para trocar o logo, substitua esse arquivo e rode o `atualizar.bat`).
- **Carregar planilhas** (contingência): se o script não puder rodar, selecione os dois
  `.xlsx` juntos; o próprio navegador lê e aplica as mesmas regras de limpeza. Nada é enviado
  para fora; os dados ficam só naquela janela.

## 5. Ajustes sem mexer no código (`config.json`)

Abra com o Bloco de Notas, altere, salve e rode o `atualizar.bat`.

| Chave | Para que serve |
|---|---|
| `pasta_raiz` | Pasta onde estão as planilhas. |
| `padroes_de_nome` | Padrões para achar cada planilha (`*` = qualquer texto; acentos e caixa são ignorados). |
| `pasta_de_saida` | Onde gravar o painel. Vazio = subpasta `BI`. |
| `limite_outlier_reais` | Potencial acima disso é marcado como outlier (padrão R$ 1.000.000). |
| `cores_da_marca` | Cores do painel. Primária/destaque seguem o Kit de Marca Chamfer. |
| `mapa_de_status.grupos` | Em qual grupo cai cada status. **Para classificar um status novo, acrescente o texto na lista do grupo.** |
| `mapa_de_status.regras_contem` | Regras por trecho de texto (ex.: tudo que contém "homologa" → Em andamento). |
| `mapa_de_status.motivos_de_perda` | Motivo de perda de cada status perdido/descartado. |
| `mapa_de_itens.de_para` | Grafias diferentes do mesmo item (ex.: `"Balde 3,2": "3,2AN"`). |
| `mapa_de_itens.revisar` | Itens suspeitos listados na aba Qualidade com a sugestão. |
| `mapa_de_itens.familias` | Regra (expressão regular) de cada família de item. |
| `valores_de_referencia` | Totais de 09/10/2026 usados para conferência no log. |

Comparações de status ignoram maiúsculas, acentos, espaços e pontuação
(`Pedido Fechado` = `Pedido fechado`; `Em  homologação` = `Em homologação`).

## 6. Regras de cálculo

| Indicador | Fórmula |
|---|---|
| Leads | contagem de leads (linhas) após o cruzamento das duas planilhas |
| Empresas únicas | empresas distintas (nome normalizado) |
| Pedidos fechados | status agrupado = Fechado |
| Conversão | pedidos fechados ÷ leads |
| Faturado | soma das colunas `Pedidos <mês>`; no gráfico mensal vale o **mês do pedido** |
| Ticket médio | faturado ÷ pedidos fechados |
| Potencial total / sem outliers | soma de `Valor total` (com e sem leads acima do limite) |
| Potencial em aberto | potencial dos leads Em andamento, Sem retorno e Sem pedido registrado |
| Realizado ÷ potencial | faturado ÷ potencial total |
| Dias | dias desde a data de entrada do lead (não há data de último contato nas planilhas) |

- **Mês parcial:** o mês da data mais recente da base fica marcado "parcial" e nunca entra na
  comparação "vs mês anterior"; os cartões comparam os dois últimos meses **fechados**.
- **Cruzamento:** empresa normalizada + dia; se não casar, só a empresa quando ela é única nas
  duas planilhas; se ainda não casar, o lead é mantido e marcado "sem correspondência".
  Nenhum lead é descartado.

## 7. Suposições adotadas

1. Leads que existem só na planilha de potencial entram no painel com status
   "Sem pedido registrado" (não têm linha na planilha de status). Hoje são 8; por isso o painel
   mostra 336 leads, e não 328 (a aba Geral sozinha continua batendo 328 no log).
2. Leads que existem só na planilha de status ficam como "Sem UF" (a UF vem do potencial).
3. Colunas `Pedidos <mês>` sem ano usam o ano do lead mais recente; um mês posterior a ele é
   considerado do ano anterior. Para evitar ambiguidade na virada do ano, o cabeçalho pode
   trazer o ano (`Pedidos Janeiro 2027`).
4. Quantidades com texto ("5.000 E 1.260") são lidas assim: se o número de valores bate com o
   número de itens da célula, cada item recebe o seu; se há um item só, os valores são somados.
   Todos os casos aparecem em Qualidade dos Dados → "Quantidade a revisar".
5. "Balde 2,2" foi tratado como o item `2,2L`, e `1.8`/`11.4` como `1,8`/`11,4` (baldes).
6. Vendedor "inativo" = aba com a palavra INATIVO; "sem aba" = vendedor da aba Geral sem aba
   própria (o sufixo REPRESENTANTE é ignorado nessa comparação).
7. Cores: azul #003366 e laranja #F5A800 do Kit de Marca; cores de status conforme o pedido
   original, com "Sem pedido registrado" (azul) e "Descartado" (marrom) ajustados para serem
   distinguíveis por daltônicos. Toda cor vem acompanhada de rótulo.
8. O mapa do Brasil é um mosaico (uma peça por UF, posição aproximada), que funciona offline
   sem arquivos de geografia.

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "A pasta de origem não foi encontrada" | Abra o Explorador e clique na unidade Y: para reconectá-la; rode de novo. |
| "Python ... não foi encontrado" | Veja a seção 1. |
| "biblioteca Python ausente" | `python -m pip install pandas openpyxl` |
| "A aba 'Geral' não existe" | A aba foi renomeada: volte o nome ou ajuste `abas` no `config.json`. |
| "Arquivo em uso" | O script copia a planilha antes de ler e tenta 4 vezes; se persistir, feche o Excel de quem está com o arquivo. |
| Status novo aparece em "Outros (revisar)" | Inclua o texto no grupo certo em `mapa_de_status.grupos` e atualize. |
| Item em "Outros (revisar)" | Inclua em `mapa_de_itens.de_para` ou crie a regra da família. |
| Totais diferentes da referência no log | Normal quando as planilhas mudaram depois de 09/10/2026. |

## 9. Segurança

- Os dados têm nomes de empresas e valores comerciais: **não publique** o `dashboard.html`
  nem o `dados.json` em sites, GitHub ou e-mail externo.
- O painel não faz nenhuma chamada de rede: bibliotecas (Chart.js 4.4.7, SheetJS 0.18.5) e
  fontes (Inter, Montserrat) estão dentro do próprio arquivo. Licenças em `recursos\`.
- As planilhas de origem são abertas só para leitura, a partir de uma cópia temporária.
