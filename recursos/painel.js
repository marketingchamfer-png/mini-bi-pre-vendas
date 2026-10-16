/* Mini BI Pré-Vendas Chamfer — aplicação do painel (JavaScript puro + Chart.js).
 * Os dados chegam embutidos em window.__DADOS__ (gerados pelo atualizar_dashboard.py)
 * ou são montados aqui mesmo pelo ETL de contingência ("Carregar planilhas").
 * Nada é enviado para fora do computador. */
(function () {
'use strict';

const CFG = window.__CONFIG__ || {};
const CORES = CFG.cores_da_marca || {};
const MS = CFG.mapa_de_status || {};
const ORDEM_GRUPOS = MS.ordem_dos_grupos || ['Fechado', 'Em andamento', 'Sem retorno', 'Sem pedido registrado', 'Perdido', 'Descartado', 'Outros (revisar)'];
const GRUPOS_ABERTOS = new Set(MS.grupos_em_aberto || ['Em andamento', 'Sem retorno', 'Sem pedido registrado']);
const GRUPOS_PERDA = new Set(MS.grupos_de_perda || ['Perdido', 'Descartado']);
const VAR_GRUPO = { 'Fechado': '--fechado', 'Em andamento': '--andamento', 'Sem retorno': '--semretorno', 'Sem pedido registrado': '--sempedido', 'Perdido': '--perdido', 'Descartado': '--descartado', 'Outros (revisar)': '--outros' };
const SEM = '—';                 // valor de filtro para "sem UF / sem região / sem família"
const MOTIVO_SEM = 'Não especificado';
const REDUZIR = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ABAS = [
  { id: 'geral', t: 'Visão Geral' }, { id: 'vendedores', t: 'Vendedores' }, { id: 'score', t: 'Potencial & Score' },
  { id: 'geo', t: 'Geografia' }, { id: 'produtos', t: 'Produtos' }, { id: 'perdas', t: 'Perdas' },
  { id: 'leads', t: 'Leads' }, { id: 'qualidade', t: 'Qualidade' },
];
const MOSAICO_UF = { RR: [1, 0], AP: [2, 0], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1], AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2], MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3], MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4], PR: [1, 5], SP: [2, 5], RJ: [3, 5], SC: [1, 6], RS: [1, 7] };

const ICO = {
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  lua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  vazio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>',
};

/* ============================ Formatação ============================ */
const nfBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const brl = v => (v == null || isNaN(v)) ? '—' : nfBRL.format(v);
function brlC(v) {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mi';
  if (a >= 1e3) return 'R$ ' + nf0.format(v / 1e3) + ' mil';
  return 'R$ ' + nf0.format(v);
}
const int = v => nf0.format(v || 0);
const pct = (v, d = 1) => (v == null || !isFinite(v)) ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const rotMes = am => { if (!am) return '—'; const [a, m] = am.split('-'); return MESES_ABR[+m - 1] + '/' + a.slice(2); };
const dataBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
const dataHoraBR = iso => iso ? dataBR(iso) + ' ' + iso.slice(11, 16) : '—';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function proxMes(am) { let [a, m] = am.split('-').map(Number); m++; if (m > 12) { m = 1; a++; } return a + '-' + String(m).padStart(2, '0'); }
function faixaMeses(a, b) { const r = []; if (!a || !b) return r; for (let x = a; x <= b && r.length < 240; x = proxMes(x)) r.push(x); return r; }
function ultimoDia(am) { const [a, m] = am.split('-').map(Number); return am + '-' + String(new Date(a, m, 0).getDate()).padStart(2, '0'); }
const soma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
function css(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
function corGrupo(g) { return css(VAR_GRUPO[g] || '--outros'); }
function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function alfa(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function misturar(h1, h2, t) { const a = hexRgb(h1), b = hexRgb(h2); return 'rgb(' + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',') + ')'; }
function luminancia(h1, h2, t) { const a = hexRgb(h1), b = hexRgb(h2); const c = a.map((x, i) => (x + (b[i] - x) * t) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* armazenamento indisponível */ } }
function toast(msg, ms = 4000) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function htmlVazio(msg) { return `<div class="vazio"><div>${ICO.vazio}${esc(msg || 'Nenhum lead para os filtros selecionados')}</div></div>`; }
function seloScore(s) { return s ? `<span class="sc sc-${s}" title="Score ${s}">Score ${s}</span>` : '<span class="sc sc-0">Sem score</span>'; }
function seloStatus(g, texto) { return `<span class="st"><span class="ponto" style="background:${corGrupo(g)}"></span>${esc(texto || g)}</span>`; }

/* ============================ ETL de contingência (espelho do Python) ============================ */
const ETL = (() => {
  const semAcentos = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const limpar = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  const chave = v => semAcentos(limpar(v)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normEmp = v => semAcentos(limpar(v)).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const vazio = v => v == null || limpar(v) === '';

  function numero(v) {
    if (v == null || typeof v === 'boolean') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = limpar(v).replace(/R\$/g, '').replace(/ /g, '');
    if (!s) return null;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
    else if (s.includes(',')) s = s.replace(/,/g, '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
    return Number(s);
  }
  function numerosNoTexto(t) {
    if (typeof t === 'number') return [t];
    return (limpar(t).match(/\d[\d.,]*\d|\d/g) || []).map(numero).filter(n => n != null);
  }
  const p2 = n => String(n).padStart(2, '0');
  function serialParaIso(v) { return new Date(Math.round((v - 25569) * 86400) * 1000).toISOString().slice(0, 19); }
  function paraData(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}T${p2(v.getHours())}:${p2(v.getMinutes())}:${p2(v.getSeconds())}`;
    if (typeof v === 'number') return serialParaIso(v);
    const s = limpar(v); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?$/))) return `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}`;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/))) {
      let a = +m[3]; if (m[3].length === 2) a += a < 69 ? 2000 : 1900;
      return `${a}-${p2(m[2])}-${p2(m[1])}T${p2(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
    }
    return null;
  }

  function mapeador(cfg) {
    const ms = cfg.mapa_de_status, mi = cfg.mapa_de_itens;
    const exato = {}, motivo = {};
    for (const [g, lista] of Object.entries(ms.grupos)) for (const s of lista) exato[chave(s)] = [g, s];
    for (const [m, lista] of Object.entries(ms.motivos_de_perda)) for (const s of lista) motivo[chave(s)] = m;
    const regras = (ms.regras_contem || []).map(r => [chave(r.contem), r]);
    const dePara = {}; for (const [k, v] of Object.entries(mi.de_para)) dePara[chave(k)] = v;
    const revisar = {}; for (const [k, v] of Object.entries(mi.revisar || {})) revisar[chave(k)] = v;
    const sep = new RegExp(mi.separadores_de_itens, 'i');
    const familias = mi.familias.map(f => [new RegExp(f.regex), f.familia]);
    return {
      revisar, familiaPadrao: mi.familia_padrao,
      status(orig) {
        const k = chave(orig);
        if (!k) return ['', null, null];
        if (exato[k]) return [exato[k][1], exato[k][0], motivo[k] || null];
        const contidos = Object.keys(exato).filter(s => s.length >= 10 && k.includes(s));
        if (contidos.length) {
          const s = contidos.reduce((a, b) => b.length > a.length ? b : a);
          return [limpar(orig), exato[s][0], motivo[s] || null];
        }
        for (const [termo, r] of regras) if (termo && k.includes(termo)) return [limpar(orig), r.grupo, r.motivo || null];
        return [limpar(orig), null, null];
      },
      separar: t => limpar(t).split(sep).map(limpar).filter(Boolean),
      padronizar(item) {
        const k = chave(item);
        if (k in dePara) return dePara[k];
        let s = limpar(item);
        if (/^\d+\.\d+[A-Za-z]*$/.test(s)) s = s.replace(/\./g, ',');
        if (/^[Pp]?\d+(,\d+)?\s*[A-Za-z.]*$/.test(s)) s = s.replace(/[\s.]/g, '').toUpperCase();
        return s;
      },
      familia(p) { const a = semAcentos(p).toUpperCase(); for (const [rx, f] of familias) if (rx.test(a)) return f; return mi.familia_padrao; },
    };
  }

  function achar(cols, nome, avisos, arq, obrig) {
    const alvo = chave(nome);
    for (const [i, h] of cols) if (chave(h) === alvo) return i;
    for (const [i, h] of cols) if (chave(h).startsWith(alvo.slice(0, 12))) return i;
    const msg = `Coluna '${nome}' não encontrada em ${arq}.`;
    if (obrig) throw new Error(msg);
    avisos.push(msg); return null;
  }
  const indiceColunas = cab => cab.map((h, i) => [i, limpar(h)]).filter(x => x[1]);
  function vendBase(nome, sufixos) {
    let s = normEmp(nome);
    for (const suf of sufixos) s = s.replace(new RegExp('\\b' + suf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  const r2 = v => Math.round(v * 100) / 100;

  function transformar(bruto, cfg) {
    const mp = mapeador(cfg);
    const avisos = [], qualidade = [];
    const val = (l, i) => (i != null && i < l.length) ? l[i] : null;

    // ---------- Status / vendas ----------
    const st = bruto.status_vendas;
    const cols = indiceColunas(st.cabecalho), arqS = st.arquivo;
    const cData = achar(cols, 'Data', avisos, arqS), cVend = achar(cols, 'Vendedor', avisos, arqS);
    const cEmp = achar(cols, 'Nome da empresa (Razão Social)', avisos, arqS, true);
    const cScore = achar(cols, 'Score', avisos, arqS), cStatus = achar(cols, 'Status', avisos, arqS);
    const usadasS = new Set([cData, cVend, cEmp, cScore, cStatus].filter(c => c != null));
    const datasS = st.linhas.map(l => paraData(val(l, cData)));
    const validas = datasS.filter(Boolean).sort();
    const ref = validas.length ? validas[validas.length - 1] : paraData(new Date());
    const anoRef = +ref.slice(0, 4), mesRef = +ref.slice(5, 7);
    const meses = {}; for (const [k, v] of Object.entries(cfg.meses)) meses[chave(k)] = v;
    const pedCols = [];
    for (const [i, h] of cols) {
      const k = chave(h); if (!k.startsWith('PEDIDOS')) continue;
      let resto = k.slice(7), ano = null; const ma = resto.match(/(20\d\d)$/);
      if (ma) { ano = +ma[1]; resto = resto.slice(0, ma.index); }
      const mes = meses[resto];
      if (mes == null) { avisos.push(`Coluna de pedidos com mês não reconhecido: '${h}' (ignorada).`); continue; }
      if (ano == null) ano = mes <= mesRef ? anoRef : anoRef - 1;
      pedCols.push([i, `${ano}-${p2(mes)}`, h]); usadasS.add(i);
    }
    const linhasS = [];
    st.linhas.forEach((l, n) => {
      if ([...usadasS].every(i => vazio(val(l, i)))) return;
      const empresa = limpar(val(l, cEmp)); if (!empresa) return;
      const scoreTxt = limpar(val(l, cScore)); const m = scoreTxt.match(/(\d+)/);
      const score = m && [1, 2, 3].includes(+m[1]) ? +m[1] : null;
      const pedidos = [];
      for (const [i, am, h] of pedCols) {
        const b = val(l, i); if (vazio(b)) continue;
        const v = numero(b);
        if (v == null) { qualidade.push({ tipo_problema: 'Valor de pedido não numérico', lead_id: null, empresa, vendedor: limpar(val(l, cVend)), detalhe: `${h}: '${limpar(b)}'` }); continue; }
        if (v !== 0) pedidos.push([am, v]);
      }
      linhasS.push({ data: datasS[n], vendedor: limpar(val(l, cVend)), empresa, norm: normEmp(empresa), score, status: limpar(val(l, cStatus)), pedidos });
    });

    // ---------- Potencial ----------
    const pt = bruto.potencial_leads;
    const colp = indiceColunas(pt.cabecalho), arqP = pt.arquivo;
    const pData = achar(colp, 'Data', avisos, arqP), pVend = achar(colp, 'Vendedor', avisos, arqP);
    const pEmp = achar(colp, 'Nome da empresa (Razão Social)', avisos, arqP, true);
    const pUf = achar(colp, 'Estado', avisos, arqP), pVal = achar(colp, 'Valor total', avisos, arqP);
    const pares = [];
    colp.forEach(([i, h], pos) => {
      if (/^ITEM\d*$/.test(chave(h))) {
        const prox = colp[pos + 1];
        pares.push([i, prox && chave(prox[1]).startsWith('QUANTIDADE') ? prox[0] : null]);
      }
    });
    if (!pares.length) avisos.push(`Nenhuma coluna 'item NN' encontrada em ${arqP}.`);
    const usadasP = new Set([pData, pVend, pEmp, pUf, pVal].filter(c => c != null));
    pares.forEach(([a, b]) => { usadasP.add(a); if (b != null) usadasP.add(b); });
    const linhasP = [];
    pt.linhas.forEach(l => {
      if ([...usadasP].every(i => vazio(val(l, i)))) return;
      const empresa = limpar(val(l, pEmp)); if (!empresa) return;
      const itens = [];
      for (const [ci, cq] of pares) {
        const itemTxt = limpar(val(l, ci)); const qb = cq != null ? val(l, cq) : null;
        if (!itemTxt) { if (!vazio(qb)) itens.push({ erro: 'Quantidade sem item', detalhe: limpar(qb) }); continue; }
        const cods = mp.separar(itemTxt);
        const qtds = (qb == null || qb === '') ? [] : numerosNoTexto(qb);
        let alerta = null, pq;
        if (!vazio(qb) && !qtds.length) alerta = `Quantidade não numérica: '${limpar(qb)}' (${itemTxt})`;
        if (cods.length === qtds.length) pq = cods.map((c, i) => [c, qtds[i]]);
        else if (qtds.length === 1) { pq = cods.map(c => [c, qtds[0]]); if (cods.length > 1) alerta = `Uma quantidade para vários itens: '${itemTxt}' = ${limpar(qb)}`; }
        else if (qtds.length > 1 && cods.length === 1) { pq = [[cods[0], qtds.reduce((a, b) => a + b, 0)]]; alerta = `Quantidade composta somada: '${limpar(qb)}' (${itemTxt})`; }
        else { pq = cods.map(c => [c, null]); if (qtds.length) alerta = `Quantidades não batem com os itens: '${itemTxt}' = ${limpar(qb)}`; }
        for (const [cod, q] of pq) { const p = mp.padronizar(cod); itens.push({ item_original: cod, item_padrao: p, familia: mp.familia(p), quantidade: q }); }
        if (alerta) itens.push({ erro: 'Quantidade a revisar', detalhe: alerta });
      }
      const vb = val(l, pVal);
      linhasP.push({ data: paraData(val(l, pData)), vendedor: limpar(val(l, pVend)), empresa, norm: normEmp(empresa), estado: limpar(val(l, pUf)), potencial: numero(vb), potencial_invalido: !(vb == null || vb === '') && numero(vb) == null, itens });
    });

    // ---------- Junção ----------
    const suf = cfg.vendedores.sufixos_ignorados;
    const dia = d => d ? d.slice(0, 10) : '';
    const porChaveP = new Map(), porChaveS = new Map();
    linhasP.forEach((p, j) => { const k = p.norm + '|' + dia(p.data); if (!porChaveP.has(k)) porChaveP.set(k, []); porChaveP.get(k).push(j); });
    linhasS.forEach((s, i) => { const k = s.norm + '|' + dia(s.data); if (!porChaveS.has(k)) porChaveS.set(k, []); porChaveS.get(k).push(i); });
    const par = new Map(), usadosP = new Set(), tipo = new Map();
    for (const [k, listaS] of porChaveS) {
      const livres = (porChaveP.get(k) || []).filter(j => !usadosP.has(j));
      for (const i of listaS) {
        const vb = vendBase(linhasS[i].vendedor, suf);
        const pos = livres.findIndex(j => vendBase(linhasP[j].vendedor, suf) === vb);
        if (pos >= 0) { const j = livres.splice(pos, 1)[0]; par.set(i, j); usadosP.add(j); }
      }
      for (const i of listaS) if (!par.has(i) && livres.length) { const j = livres.shift(); par.set(i, j); usadosP.add(j); }
    }
    const casadosChave = par.size;
    for (const i of par.keys()) tipo.set(i, 'empresa+data');
    const contS = {}, contP = {}, idxP = {};
    linhasS.forEach(s => { contS[s.norm] = (contS[s.norm] || 0) + 1; });
    linhasP.forEach((p, j) => { contP[p.norm] = (contP[p.norm] || 0) + 1; idxP[p.norm] = j; });
    linhasS.forEach((s, i) => {
      if (par.has(i)) return;
      if (contS[s.norm] === 1 && contP[s.norm] === 1) { const j = idxP[s.norm]; if (!usadosP.has(j)) { par.set(i, j); usadosP.add(j); tipo.set(i, 'empresa'); } }
    });
    const regs = linhasS.map((s, i) => [s, par.has(i) ? linhasP[par.get(i)] : null, tipo.get(i) || 'nenhuma']);
    linhasP.forEach((p, j) => { if (!usadosP.has(j)) regs.push([null, p, 'nenhuma']); });
    regs.sort((a, b) => {
      const da = (a[0] || a[1]).data || '9999', db = (b[0] || b[1]).data || '9999';
      if (da !== db) return da < db ? -1 : 1;
      const na = (a[0] || a[1]).norm, nb = (b[0] || b[1]).norm;
      return na < nb ? -1 : na > nb ? 1 : 0;
    });

    // ---------- Modelo ----------
    const regioes = {}; for (const [r, l] of Object.entries(cfg.regioes)) for (const uf of l) regioes[uf] = r;
    const UFS = cfg.ufs || {}; const nomesUf = {}; for (const [s, n] of Object.entries(UFS)) nomesUf[chave(n)] = s;
    const limite = +cfg.limite_outlier_reais;
    const leads = [], pedidos = [], itens = [];
    const stNM = new Map(), itRev = new Map(), ufNM = new Map();
    const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const flag = (lead, t, d = '') => { lead.flags_qualidade.push(t); qualidade.push({ tipo_problema: t, lead_id: lead.lead_id, empresa: lead.empresa, vendedor: lead.vendedor, detalhe: d }); };
    regs.forEach(([s, p, corresp], idx) => {
      const base = s || p, id = 'L' + String(idx + 1).padStart(5, '0');
      const data = base.data || (p ? p.data : null);
      const stOrig = s ? s.status : '';
      let [stPad, grupo, motivo] = s ? mp.status(stOrig) : ['', null, null];
      if (s && grupo == null) { grupo = 'Outros (revisar)'; inc(stNM, stOrig || '(vazio)'); }
      else if (!s) { grupo = 'Sem pedido registrado'; stPad = '(sem linha na planilha de status)'; }
      let ufSig = null, ufNome = null;
      if (p && p.estado) {
        const i = p.estado.lastIndexOf('-');
        const partes = (i >= 0 ? [p.estado.slice(0, i), p.estado.slice(i + 1)] : [p.estado]).map(x => x.trim());
        const cand = chave(partes[partes.length - 1]);
        if (UFS[cand]) ufSig = cand;
        else if (nomesUf[chave(p.estado)]) ufSig = nomesUf[chave(p.estado)];
        else if (nomesUf[chave(partes[0])]) ufSig = nomesUf[chave(partes[0])];
        if (ufSig) ufNome = UFS[ufSig]; else inc(ufNM, p.estado);
      }
      const fat = r2(s ? s.pedidos.reduce((a, x) => a + x[1], 0) : 0);
      const pot = p ? p.potencial : null;
      const lead = {
        lead_id: id, data_entrada: data, mes_entrada: data ? data.slice(0, 7) : null,
        vendedor: (s ? s.vendedor : '') || (p ? p.vendedor : ''), empresa: base.empresa, empresa_normalizada: base.norm,
        uf_sigla: ufSig, uf_nome: ufNome, regiao: ufSig ? (regioes[ufSig] || null) : null, score: s ? s.score : null,
        status_original: stOrig, status_padrao: stPad, status_grupo: grupo, status_motivo_perda: motivo,
        'potencial_r$': pot, 'faturado_r$': fat, flag_outlier: pot != null && pot > limite, flag_recorrente: false,
        flag_sem_correspondencia: corresp === 'nenhuma', correspondencia: corresp,
        origem: s && p ? 'ambos' : (s ? 'so_status' : 'so_potencial'), familias: [], flags_qualidade: [],
      };
      leads.push(lead);
      for (const [am, v] of (s ? s.pedidos : [])) pedidos.push({ lead_id: id, ano_mes: am, 'valor_r$': r2(v) });
      for (const it of (p ? p.itens : [])) {
        if (it.erro) { flag(lead, it.erro, it.detalhe); continue; }
        itens.push({ lead_id: id, ...it });
        if (!lead.familias.includes(it.familia)) lead.familias.push(it.familia);
        const k = chave(it.item_original);
        if (k in mp.revisar || it.familia === mp.familiaPadrao) {
          if (!itRev.has(it.item_original)) itRev.set(it.item_original, { item: it.item_original, item_padrao: it.item_padrao, familia: it.familia, contagem: 0, sugestao: mp.revisar[k] || 'Sem regra de família: incluir no config.json' });
          itRev.get(it.item_original).contagem++;
        }
      }
      if (!data) flag(lead, 'Data ausente ou inválida');
      if (grupo === 'Outros (revisar)') flag(lead, 'Status não mapeado', stOrig || '(vazio)');
      if (grupo === 'Fechado' && fat === 0) flag(lead, 'Pedido fechado sem valor de pedido lançado');
      if (fat > 0 && grupo !== 'Fechado') flag(lead, 'Valor de pedido lançado com status diferente de fechado', `Status: ${stOrig || '(vazio)'}`);
      if (p && pot == null) flag(lead, 'Sem valor de potencial', p.potencial_invalido ? 'Valor não numérico' : 'Célula vazia');
      if (corresp === 'nenhuma') flag(lead, s ? 'Empresa só na planilha de status' : 'Empresa só na planilha de potencial');
      else if (corresp === 'empresa') flag(lead, 'Correspondência apenas pelo nome da empresa', `Datas: ${dia(s.data)} × ${dia(p.data)}`);
      if (s && p && vendBase(s.vendedor, suf) !== vendBase(p.vendedor, suf)) flag(lead, 'Vendedor diferente entre as planilhas', `${s.vendedor} × ${p.vendedor}`);
      if (p && p.estado && !ufSig) flag(lead, 'UF não reconhecida', p.estado);
    });
    const contEmp = {}; leads.forEach(l => { contEmp[l.empresa_normalizada] = (contEmp[l.empresa_normalizada] || 0) + 1; });
    const vistos = {};
    leads.forEach(l => {
      l.flag_recorrente = contEmp[l.empresa_normalizada] > 1;
      const k = l.empresa_normalizada + '|' + (l.data_entrada || '').slice(0, 10) + '|' + vendBase(l.vendedor, suf);
      vistos[k] = (vistos[k] || 0) + 1;
      if (vistos[k] >= 2) flag(l, 'Linha duplicada (mesma empresa, data e vendedor)');
    });
    const abas = (st.abas || []).filter(a => chave(a) !== chave(cfg.abas.status_vendas));
    const pInat = chave(cfg.vendedores.palavra_inativo);
    const baseAbas = {}; abas.forEach(a => { baseAbas[vendBase(a, suf)] = a; });
    const inativos = new Set(abas.filter(a => chave(a).includes(pInat)).map(a => vendBase(a, suf)));
    const porVend = {}; leads.forEach(l => { if (l.vendedor) porVend[l.vendedor] = (porVend[l.vendedor] || 0) + 1; });
    const vendedores = Object.keys(porVend).sort().map(v => {
      const vb = vendBase(v, suf), aba = baseAbas[vb] || null, qtd = porVend[v];
      let situacao = 'ativo';
      if (inativos.has(vb)) { situacao = 'inativo'; qualidade.push({ tipo_problema: 'Vendedor marcado como inativo', lead_id: null, empresa: '', vendedor: v, detalhe: `Aba '${aba}' · ${qtd} lead(s)` }); }
      else if (!aba) { situacao = 'sem aba'; qualidade.push({ tipo_problema: 'Vendedor sem aba própria', lead_id: null, empresa: '', vendedor: v, detalhe: `${qtd} lead(s) na aba Geral` }); }
      return { vendedor: v, aba, situacao, leads: qtd };
    });
    const datas = leads.map(l => l.data_entrada).filter(Boolean).sort();
    const desc = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([valor, contagem]) => ({ valor, contagem }));
    const normsS = new Set(linhasS.map(s => s.norm));
    return {
      leads, pedidos_mensais: pedidos, itens, qualidade,
      nao_mapeados: { status: desc(stNM), itens: [...itRev.values()].sort((a, b) => b.contagem - a.contagem), ufs: desc(ufNM) },
      vendedores,
      meta: {
        total_linhas_lidas: st.linhas.length + pt.linhas.length, total_linhas_validas: linhasS.length + linhasP.length,
        mes_parcial: datas.length ? datas[datas.length - 1].slice(0, 7) : null,
        data_min: datas[0] || null, data_max: datas[datas.length - 1] || null,
        meses_pedidos: [...new Set(pedCols.map(x => x[1]))].sort(), colunas_pedidos: pedCols.map(x => x[2]),
        resumo: {
          linhas_status: st.linhas.length, linhas_potencial: pt.linhas.length, validas_status: linhasS.length, validas_potencial: linhasP.length,
          casados_empresa_data: casadosChave, casados_so_empresa: [...tipo.values()].filter(t => t === 'empresa').length,
          so_status: leads.filter(l => l.origem === 'so_status').length, so_potencial: leads.filter(l => l.origem === 'so_potencial').length,
          empresas_em_ambos: new Set(linhasP.map(p => p.norm).filter(n => normsS.has(n))).size,
        },
        avisos,
      },
    };
  }

  // Leitura das planilhas no navegador com SheetJS (carregado sob demanda)
  function carregarSheetJS() {
    if (window.XLSX) return;
    const b64 = document.getElementById('lib-sheetjs').textContent.trim();
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    (0, eval)(new TextDecoder('utf-8').decode(bytes)); // biblioteca embutida no próprio arquivo
  }
  function valorCelula(c) {
    if (!c) return null;
    if (c.t === 'd') return paraData(c.v);
    if (c.t === 'n' && c.z && window.XLSX.SSF.is_date(c.z)) return serialParaIso(c.v);
    if (c.t === 'e' || c.t === 'z') return null;
    return c.v;
  }
  function lerAba(buf, nomeAba, arquivo) {
    const X = window.XLSX;
    const wb = X.read(buf, { type: 'array', cellNF: true, cellDates: false });
    const abas = wb.SheetNames.slice();
    const alvo = abas.find(a => chave(a) === chave(nomeAba));
    if (!alvo) throw new Error(`A aba '${nomeAba}' não existe em ${arquivo}. Abas encontradas: ${abas.join(', ')}`);
    const ws = wb.Sheets[alvo];
    let maxR = 0, maxC = 0;
    for (const k in ws) { if (k[0] === '!') continue; const c = X.utils.decode_cell(k); if (c.r > maxR) maxR = c.r; if (c.c > maxC) maxC = c.c; }
    const limite = 200, linhas = []; let cab = null, vazias = 0;
    for (let r = 0; r <= maxR; r++) {
      const linha = []; for (let c = 0; c <= maxC; c++) linha.push(valorCelula(ws[X.utils.encode_cell({ r, c })]));
      if (cab === null) { cab = linha; continue; }
      if (linha.every(v => v == null || (typeof v === 'string' && !v.trim()))) { if (++vazias >= limite) break; continue; }
      vazias = 0; linhas.push(linha);
    }
    return { arquivo, abas, cabecalho: cab || [], linhas };
  }
  const globRegex = g => new RegExp('^' + semAcentos(g).toUpperCase().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  async function deArquivos(files, cfg) {
    carregarSheetJS();
    const tipos = Object.entries(cfg.padroes_de_nome);
    const escolhidos = {};
    for (const f of files) {
      if (f.name.startsWith('~$')) continue;
      const base = semAcentos(f.name.replace(/\.[^.]+$/, '')).toUpperCase();
      let tipo = (tipos.find(([, p]) => globRegex(p).test(base)) || [])[0];
      const buf = new Uint8Array(await f.arrayBuffer());
      if (!tipo) { // nome diferente: reconhece pela aba
        const wb = window.XLSX.read(buf, { type: 'array', bookSheets: true });
        tipo = Object.keys(cfg.abas).find(t => wb.SheetNames.some(a => chave(a) === chave(cfg.abas[t])));
      }
      if (!tipo) continue;
      if (!escolhidos[tipo] || f.lastModified > escolhidos[tipo].f.lastModified) escolhidos[tipo] = { f, buf };
    }
    for (const t of Object.keys(cfg.abas)) if (!escolhidos[t]) throw new Error(`Falta a planilha de ${t === 'status_vendas' ? 'STATUS DE LEADS E VENDAS' : 'DISTRIBUIÇÃO DE LEADS E POTENCIAL'}. Selecione os dois arquivos .xlsx juntos.`);
    const bruto = {}, fontes = [];
    for (const [t, { f, buf }] of Object.entries(escolhidos)) {
      bruto[t] = lerAba(buf, cfg.abas[t], f.name);
      fontes.push({ tipo: t, nome: f.name, caminho: f.name, modificado_em: paraData(new Date(f.lastModified)) });
    }
    const dados = transformar(bruto, cfg);
    Object.assign(dados.meta, { gerado_em: paraData(new Date()), arquivos_origem: fontes, versao_painel: cfg.versao_painel, modo: 'manual', validacao: [] });
    return dados;
  }
  return { transformar, deArquivos, carregarSheetJS };
})();
window.MiniBI_ETL = ETL; // exposto para diagnóstico (comparação com o Python)

/* ============================ Modelo ============================ */
let DADOS = window.__DADOS__;
let M = null;  // modelo pronto para o painel
const HOJE = new Date(); HOJE.setHours(0, 0, 0, 0);

function prepararModelo(d) {
  const pedPorLead = new Map(), itensPorLead = new Map();
  for (const p of d.pedidos_mensais) { if (!pedPorLead.has(p.lead_id)) pedPorLead.set(p.lead_id, []); pedPorLead.get(p.lead_id).push(p); }
  for (const it of d.itens) { if (!itensPorLead.has(it.lead_id)) itensPorLead.set(it.lead_id, []); itensPorLead.get(it.lead_id).push(it); }
  const leads = d.leads.map(l => {
    const dia = (l.data_entrada || '').slice(0, 10);
    let dias = null;
    if (dia) { const [a, m, dd] = dia.split('-').map(Number); dias = Math.max(0, Math.round((HOJE - new Date(a, m - 1, dd)) / 864e5)); }
    return {
      id: l.lead_id, iso: l.data_entrada, dia, mes: l.mes_entrada, vend: l.vendedor || '(sem vendedor)', emp: l.empresa, empN: l.empresa_normalizada,
      uf: l.uf_sigla || null, ufNome: l.uf_nome || null, reg: l.regiao || null, score: l.score || 0,
      stO: l.status_original || '', stP: l.status_padrao || '', grp: l.status_grupo, mot: l.status_motivo_perda || null,
      pot: l['potencial_r$'], fat: l['faturado_r$'] || 0, out: !!l.flag_outlier, rec: !!l.flag_recorrente, semC: !!l.flag_sem_correspondencia,
      origem: l.origem, corresp: l.correspondencia, fams: l.familias || [], flags: l.flags_qualidade || [], dias,
      ped: pedPorLead.get(l.lead_id) || [], itens: itensPorLead.get(l.lead_id) || [],
    };
  });
  const porId = new Map(leads.map(l => [l.id, l]));
  const mesesEntrada = leads.map(l => l.mes).filter(Boolean).sort();
  const mesesPed = d.pedidos_mensais.map(p => p.ano_mes).sort();
  const todos = [...mesesEntrada, ...mesesPed].sort();
  const meses = faixaMeses(todos[0], todos[todos.length - 1]);
  const cont = f => { const m = new Map(); leads.forEach(l => { const v = f(l); (Array.isArray(v) ? v : [v]).forEach(x => m.set(x, (m.get(x) || 0) + 1)); }); return m; };
  return {
    leads, porId, meses, mesParcial: d.meta.mes_parcial, meta: d.meta, d,
    opcoes: {
      v: [...cont(l => l.vend).entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ k, t: k, c })),
      g: ORDEM_GRUPOS.map(g => ({ k: g, t: g, c: leads.filter(l => l.grp === g).length })).filter(o => o.c),
      r: [...Object.keys(CFG.regioes || {}), SEM].map(r => ({ k: r, t: r === SEM ? 'Sem região (sem UF)' : r, c: leads.filter(l => (l.reg || SEM) === r).length })).filter(o => o.c),
      u: [...cont(l => l.uf || SEM).entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ k, t: k === SEM ? 'Sem UF' : `${k} · ${(CFG.ufs || {})[k] || k}`, c })),
      f: [...cont(l => l.fams.length ? l.fams : [SEM]).entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ k, t: k === SEM ? 'Sem itens cotados' : k, c })),
    },
  };
}

/* ============================ Estado e URL ============================ */
const F = { de: '', ate: '', v: [], s: [], g: [], r: [], u: [], f: [], o: false };
const UI = { aba: 'geral', geo: 'leads', heat: 'score', busca: '', qtipo: '' };
const TAB = {};  // estado das tabelas (ordem, página, filtros por coluna)
const ROT_FILTRO = { v: 'Vendedor', s: 'Score', g: 'Status', r: 'Região', u: 'UF', f: 'Família' };

function lerHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  F.de = h.get('de') || ''; F.ate = h.get('ate') || '';
  for (const k of ['v', 's', 'g', 'r', 'u', 'f']) F[k] = h.get(k) ? h.get(k).split('|').filter(Boolean) : [];
  F.o = h.get('o') === '1';
  if (h.get('aba') && ABAS.some(a => a.id === h.get('aba'))) UI.aba = h.get('aba');
  if (h.get('geo')) UI.geo = h.get('geo');
  if (h.get('heat')) UI.heat = h.get('heat');
}
function gravarHash() {
  const h = new URLSearchParams();
  h.set('aba', UI.aba);
  if (F.de) h.set('de', F.de); if (F.ate) h.set('ate', F.ate);
  for (const k of ['v', 's', 'g', 'r', 'u', 'f']) if (F[k].length) h.set(k, F[k].join('|'));
  if (F.o) h.set('o', '1');
  if (UI.geo !== 'leads') h.set('geo', UI.geo);
  if (UI.heat !== 'score') h.set('heat', UI.heat);
  try { history.replaceState(null, '', '#' + h.toString()); } catch (e) { location.hash = h.toString(); }
}
function alternar(chave, valor, unico) {
  const arr = F[chave], i = arr.indexOf(valor);
  if (unico) F[chave] = (i >= 0 && arr.length === 1) ? [] : [valor];
  else if (i >= 0) arr.splice(i, 1); else arr.push(valor);
  atualizar();
}
function filtrar(lista) {
  const S = {}; for (const k of ['v', 's', 'g', 'r', 'u', 'f']) S[k] = F[k].length ? new Set(F[k]) : null;
  return lista.filter(l =>
    (!F.de || (l.dia && l.dia >= F.de)) && (!F.ate || (l.dia && l.dia <= F.ate)) &&
    (!S.v || S.v.has(l.vend)) && (!S.s || S.s.has(String(l.score))) && (!S.g || S.g.has(l.grp)) &&
    (!S.r || S.r.has(l.reg || SEM)) && (!S.u || S.u.has(l.uf || SEM)) &&
    (!S.f || (l.fams.length ? l.fams.some(x => S.f.has(x)) : S.f.has(SEM))) &&
    (!F.o || !l.out));
}

/* ============================ Agregações ============================ */
function indicadores(L) {
  const n = L.length, fech = L.filter(l => l.grp === 'Fechado').length, fat = soma(L, l => l.fat);
  const comPot = L.filter(l => l.pot != null);
  return {
    n, fech, conv: n ? fech / n : null, fat, ticket: fech ? fat / fech : null,
    pot: soma(comPot, l => l.pot), potSemOut: soma(comPot.filter(l => !l.out), l => l.pot), nOut: L.filter(l => l.out).length,
    aberto: soma(comPot.filter(l => GRUPOS_ABERTOS.has(l.grp)), l => l.pot),
    semRet: L.filter(l => l.grp === 'Sem retorno').length, empresas: new Set(L.map(l => l.empN)).size,
  };
}
function serieMensal(L) {
  const idx = new Map(M.meses.map((m, i) => [m, i])), z = () => M.meses.map(() => 0);
  const s = { leads: z(), fech: z(), fat: z(), comPed: z(), pot: z(), aberto: z() };
  const comPed = M.meses.map(() => new Set());
  for (const l of L) {
    const i = idx.get(l.mes);
    if (i != null) { s.leads[i]++; if (l.grp === 'Fechado') s.fech[i]++; if (l.pot != null) { s.pot[i] += l.pot; if (GRUPOS_ABERTOS.has(l.grp)) s.aberto[i] += l.pot; } }
    for (const p of l.ped) { const j = idx.get(p.ano_mes); if (j != null) { s.fat[j] += p['valor_r$']; comPed[j].add(l.id); } }
  }
  s.comPed = comPed.map(x => x.size);
  s.conv = s.leads.map((n, i) => n ? s.fech[i] / n : null);
  s.ticket = s.fat.map((v, i) => s.comPed[i] ? v / s.comPed[i] : null);
  return s;
}
function agrupar(L, f) {
  const m = new Map();
  for (const l of L) { const k = f(l); if (!m.has(k)) m.set(k, []); m.get(k).push(l); }
  return m;
}

/* ============================ Componentes ============================ */
function sparkline(vals, parcialIdx) {
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return '';
  const w = 96, h = 30, max = Math.max(...pts.map(p => p[1])), min = Math.min(0, ...pts.map(p => p[1]));
  const x = i => 2 + (i / Math.max(1, vals.length - 1)) * (w - 4), y = v => h - 3 - ((v - min) / ((max - min) || 1)) * (h - 6);
  const fech = pts.filter(p => p[0] !== parcialIdx), cor = css('--marca-serie');
  let svg = `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${fech.map(p => x(p[0]) + ',' + y(p[1])).join(' ')}"/>`;
  const ult = pts[pts.length - 1];
  if (parcialIdx != null && ult[0] === parcialIdx && fech.length) {
    const a = fech[fech.length - 1];
    svg += `<line x1="${x(a[0])}" y1="${y(a[1])}" x2="${x(ult[0])}" y2="${y(ult[1])}" stroke="${cor}" stroke-width="2" stroke-dasharray="2 3" opacity=".7"/><circle cx="${x(ult[0])}" cy="${y(ult[1])}" r="3" fill="${css('--sup')}" stroke="${cor}" stroke-width="1.5"/>`;
  } else svg += `<circle cx="${x(ult[0])}" cy="${y(ult[1])}" r="3" fill="${cor}"/>`;
  return svg + '</svg>';
}
function delta(serie, tipo, bomSobe = true) {
  // Compara os dois últimos meses FECHADOS (o mês parcial nunca entra na comparação)
  const fechados = M.meses.map((m, i) => i).filter(i => M.meses[i] !== M.mesParcial);
  if (fechados.length < 2) return '<span class="delta neutro">sem mês anterior para comparar</span>';
  const i1 = fechados[fechados.length - 1], i0 = fechados[fechados.length - 2];
  const a = serie[i0], b = serie[i1], rot = `<small>${rotMes(M.meses[i1])} vs ${rotMes(M.meses[i0])}</small>`;
  if (a == null || b == null || (tipo !== 'pp' && !a)) return `<span class="delta neutro">— ${rot}</span>`;
  const d = tipo === 'pp' ? (b - a) * 100 : (b - a) / Math.abs(a);
  const txt = tipo === 'pp' ? `${d >= 0 ? '+' : ''}${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.` : `${d >= 0 ? '+' : ''}${pct(d, 0)}`;
  const cls = Math.abs(d) < 1e-9 || bomSobe === null ? 'neutro' : ((d > 0) === bomSobe ? 'sobe' : 'desce');
  const seta = d > 0 ? '▲' : d < 0 ? '▼' : '■';
  return `<span class="delta ${cls}" data-tip="${esc(`${rotMes(M.meses[i1])}: ${fmtSerie(b, tipo)} · ${rotMes(M.meses[i0])}: ${fmtSerie(a, tipo)}`)}">${seta} ${txt} ${rot}</span>`;
}
function fmtSerie(v, tipo) { return tipo === 'brl' ? brl(v) : tipo === 'pp' ? pct(v) : int(v); }

function listaBarras(el, linhas, opts = {}) {
  if (!linhas.length) { el.innerHTML = htmlVazio(opts.vazio); return; }
  const max = opts.max || Math.max(...linhas.map(r => r.v), 0) || 1;
  el.innerHTML = `<div class="barras" role="list">${linhas.map((r, i) => {
    const tag = opts.onClick ? 'button' : 'div';
    return `<${tag} class="barra${r.ativa ? ' ativa' : ''}${r.esmaecida ? ' esmaecida' : ''}" role="listitem" data-i="${i}" ${r.tip ? `data-tip="${esc(r.tip)}"` : ''} ${opts.onClick ? `aria-pressed="${!!r.ativa}"` : 'style="cursor:default"'}>
      <span class="barra-rot">${r.cor ? `<span class="ponto" style="background:${r.cor}"></span>` : ''}${r.html || esc(r.t)}</span>
      <span class="barra-trilho"><i style="width:${Math.max(r.v > 0 ? 1.5 : 0, r.v / max * 100)}%;background:${r.cor || css('--marca-serie')}"></i></span>
      <span class="barra-val">${r.vt}${r.sec ? `<small>${r.sec}</small>` : ''}</span></${tag}>`;
  }).join('')}</div>`;
  if (opts.onClick) $$('.barra', el).forEach(b => b.addEventListener('click', () => opts.onClick(linhas[+b.dataset.i])));
}

/* Tabela genérica com ordenação, paginação e filtros por coluna */
function tabela(el, id, colunas, linhas, opts = {}) {
  const st = TAB[id] = TAB[id] || { ord: opts.ord || null, dir: opts.dir || -1, pag: 0, tam: opts.tam || 25, fc: {} };
  let rows = linhas;
  if (opts.filtrosColuna) {
    for (const [k, q] of Object.entries(st.fc)) {
      if (!q) continue; const c = colunas.find(c => c.k === k); const qq = q.toLowerCase();
      rows = rows.filter(r => String(c.f ? c.f(r) : c.v(r) ?? '').toLowerCase().includes(qq));
    }
  }
  if (st.ord) {
    const c = colunas.find(c => c.k === st.ord);
    if (c) rows = rows.slice().sort((a, b) => {
      const x = c.v(a), y = c.v(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) * st.dir;
    });
  }
  el._linhas = rows;
  if (!linhas.length) { el.innerHTML = htmlVazio(opts.vazio); return; }
  const paginar = opts.paginar !== false, total = rows.length, paginas = Math.max(1, Math.ceil(total / st.tam));
  if (st.pag >= paginas) st.pag = paginas - 1;
  const vis = paginar ? rows.slice(st.pag * st.tam, (st.pag + 1) * st.tam) : rows;
  const foco = document.activeElement && el.contains(document.activeElement) && document.activeElement.dataset.fc;
  const cab = colunas.map(c => {
    const ord = c.v && c.ordenavel !== false; const at = st.ord === c.k;
    return `<th class="${c.n ? 'n ' : ''}${ord ? 'ord' : ''}" ${ord ? `data-ord="${c.k}" tabindex="0"` : ''} ${at ? `aria-sort="${st.dir > 0 ? 'ascending' : 'descending'}"` : ''} scope="col">${esc(c.t)}${ord ? `<span class="seta">${at ? (st.dir > 0 ? '↑' : '↓') : '↕'}</span>` : ''}</th>`;
  }).join('');
  const filtros = opts.filtrosColuna ? `<tr class="filtro-col">${colunas.map(c => `<th>${c.v || c.f ? `<input data-fc="${c.k}" value="${esc(st.fc[c.k] || '')}" placeholder="Filtrar" aria-label="Filtrar ${esc(c.t)}">` : ''}</th>`).join('')}</tr>` : '';
  const corpo = vis.length ? vis.map((r, i) => `<tr${opts.onLinha ? ' class="clicavel" tabindex="0"' : ''} data-i="${i}"${opts.linhaAtiva && opts.linhaAtiva(r) ? ' style="background:color-mix(in srgb,var(--primaria) 7%,transparent)"' : ''}>${colunas.map(c => `<td class="${c.n ? 'n ' : ''}${c.cls || ''}">${c.h ? c.h(r) : esc(c.v(r))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${colunas.length}">${htmlVazio('Nenhuma linha com estes filtros de coluna')}</td></tr>`;
  const pe = paginar && total > st.tam ? `<div class="tabela-pe"><span>${int(st.pag * st.tam + 1)}–${int(Math.min(total, (st.pag + 1) * st.tam))} de ${int(total)}</span>
    <div class="paginacao"><select data-tam aria-label="Linhas por página">${[25, 50, 100].map(n => `<option ${n === st.tam ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <button data-pag="-1" ${st.pag === 0 ? 'disabled' : ''} aria-label="Página anterior">‹</button><span>${st.pag + 1}/${paginas}</span><button data-pag="1" ${st.pag >= paginas - 1 ? 'disabled' : ''} aria-label="Próxima página">›</button></div></div>`
    : `<div class="tabela-pe"><span>${int(total)} linha(s)</span></div>`;
  el.innerHTML = `<div class="tabela-wrap"${opts.altura ? ` style="max-height:${opts.altura}px"` : ''}><table><thead><tr>${cab}</tr>${filtros}</thead><tbody>${corpo}</tbody></table></div>${pe}`;
  const re = () => tabela(el, id, colunas, linhas, opts);
  $$('th[data-ord]', el).forEach(th => {
    const f = () => { const k = th.dataset.ord; if (st.ord === k) st.dir *= -1; else { st.ord = k; st.dir = colunas.find(c => c.k === k).n ? -1 : 1; } re(); };
    th.addEventListener('click', f); th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } });
  });
  $$('[data-pag]', el).forEach(b => b.addEventListener('click', () => { st.pag += +b.dataset.pag; re(); }));
  const sel = $('[data-tam]', el); if (sel) sel.addEventListener('change', () => { st.tam = +sel.value; st.pag = 0; re(); });
  $$('[data-fc]', el).forEach(inp => inp.addEventListener('input', () => {
    st.fc[inp.dataset.fc] = inp.value; st.pag = 0; re();
    const novo = $(`[data-fc="${inp.dataset.fc}"]`, el); if (novo) { novo.focus(); novo.setSelectionRange(novo.value.length, novo.value.length); }
  }));
  if (foco) { const n = $(`[data-fc="${foco}"]`, el); if (n) n.focus(); }
  if (opts.onLinha) $$('tbody tr[data-i]', el).forEach(tr => {
    const f = () => opts.onLinha(vis[+tr.dataset.i]);
    tr.addEventListener('click', f); tr.addEventListener('keydown', e => { if (e.key === 'Enter') f(); });
  });
}
function miniBarra(v, max, txt, cor) { return `<div class="mini-barra"><i style="width:${max ? Math.max(2, v / max * 90) : 0}px;${cor ? `background:${cor}` : ''}"></i><span>${txt}</span></div>`; }

/* ============================ Gráficos (Chart.js) ============================ */
const GRAF = {};
const rotulosPlugin = {
  id: 'rotulos',
  afterDatasetsDraw(chart) {
    // lê da configuração crua: o Chart.js executaria a função se lida por chart.options
    const raw = chart.config._config || chart.config;
    const o = raw.options && raw.options.plugins && raw.options.plugins.rotulos; if (!o || !o.fmt) return;
    const { ctx } = chart; ctx.save();
    ctx.font = `600 11px ${css('--fonte') || 'Inter'}`; ctx.fillStyle = css('--txt-2');
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di); if (meta.hidden) return;
      meta.data.forEach((el, i) => {
        const v = ds.data[i]; if (v == null || v === 0) return;
        const t = o.fmt(v, i, ds); if (!t) return;
        if (chart.options.indexAxis === 'y') { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, el.x + 6, el.y); }
        else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(t, el.x, el.y - 4); }
      });
    });
    ctx.restore();
  },
};
const nomesBolhaPlugin = {
  id: 'nomesBolha',
  afterDatasetsDraw(chart) {
    const o = chart.options.plugins.nomesBolha; if (!o) return;
    const { ctx } = chart; ctx.save(); ctx.font = `500 11px Inter`; ctx.fillStyle = css('--txt-2'); ctx.textBaseline = 'middle';
    const meta = chart.getDatasetMeta(0), postos = [];
    o.mostrar.forEach(i => {  // rótulos diretos só onde não colidem com outro já desenhado
      const el = meta.data[i]; if (!el) return;
      const p = chart.data.datasets[0].data[i], w = ctx.measureText(p.nome).width;
      let x = el.x + (el.options.radius || 6) + 4;
      if (x + w > chart.chartArea.right + 60) x = el.x - (el.options.radius || 6) - 4 - w;
      const caixa = [x, el.y - 7, x + w, el.y + 7];
      if (postos.some(b => !(caixa[2] < b[0] || caixa[0] > b[2] || caixa[3] < b[1] || caixa[1] > b[3]))) return;
      postos.push(caixa); ctx.fillText(p.nome, x, el.y);
    });
    ctx.restore();
  },
};
function temaGraficos() {
  if (!window.Chart) return;
  const C = window.Chart;
  C.defaults.font.family = "'Inter', system-ui, sans-serif"; C.defaults.font.size = 12;
  C.defaults.color = css('--txt-3'); C.defaults.borderColor = css('--grade');
  C.defaults.animation.duration = REDUZIR ? 0 : 350;
  C.defaults.maintainAspectRatio = false;
  Object.assign(C.defaults.plugins.tooltip, {
    backgroundColor: css('--sup'), titleColor: css('--txt'), bodyColor: css('--txt-2'), borderColor: css('--borda-forte'), borderWidth: 1,
    padding: 10, cornerRadius: 8, titleFont: { weight: '600', size: 12.5 }, bodyFont: { size: 12 }, boxPadding: 4, usePointStyle: true,
  });
  C.defaults.plugins.legend.display = false;
}
function grafico(id, config, vazio) {
  const el = document.getElementById(id); if (!el) return;
  if (GRAF[id]) { GRAF[id].destroy(); delete GRAF[id]; }
  if (vazio || !window.Chart) { el.innerHTML = htmlVazio(window.Chart ? null : 'Biblioteca de gráficos indisponível'); return; }
  el.innerHTML = '<canvas></canvas>';
  config.plugins = [rotulosPlugin, nomesBolhaPlugin, ...(config.plugins || [])];
  GRAF[id] = new window.Chart(el.firstChild, config);
}
function eixos(fmtY, extra = {}) {
  return {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: css('--txt-3') }, ...(extra.x || {}) },
    y: { beginAtZero: true, grid: { color: css('--grade') }, border: { display: false }, ticks: { color: css('--txt-3'), maxTicksLimit: 5, callback: fmtY }, ...(extra.y || {}) },
  };
}

/* ============================ Páginas ============================ */
let L = []; // leads filtrados
const sujas = new Set();

function renderGeral() {
  const k = indicadores(L), s = serieMensal(L);
  const parc = M.meses.indexOf(M.mesParcial); const pi = parc >= 0 ? parc : null;
  const dMin = L.map(l => l.dia).filter(Boolean).sort();
  $('#geral-periodo').textContent = L.length ? `${int(L.length)} leads · entrada de ${dataBR(dMin[0])} a ${dataBR(dMin[dMin.length - 1])} · ${int(k.empresas)} empresas únicas` : 'Nenhum lead nos filtros';
  const cartoes = [
    { r: 'Leads', v: int(k.n), sec: `${int(k.empresas)} empresas únicas`, sp: s.leads, d: delta(s.leads, 'n'), tip: 'Contagem de leads (linhas) no período e filtros' },
    { r: 'Pedidos fechados', v: int(k.fech), sec: 'status "Pedido fechado"', sp: s.fech, d: delta(s.fech, 'n'), tip: 'Leads com status agrupado = Fechado, pelo mês de entrada' },
    { r: 'Conversão', v: pct(k.conv), sec: `${int(k.fech)} de ${int(k.n)} leads`, sp: s.conv, d: delta(s.conv, 'pp'), tip: 'Pedidos fechados ÷ leads' },
    { r: 'Faturado', v: brlC(k.fat), sec: brl(k.fat), sp: s.fat, d: delta(s.fat, 'brl'), tip: 'Soma das colunas "Pedidos <mês>", pelo mês do pedido' },
    { r: 'Ticket médio', v: brlC(k.ticket), sec: 'faturado ÷ pedidos fechados', sp: s.ticket, d: delta(s.ticket, 'brl'), tip: `${brl(k.ticket)} · mensal = faturado do mês ÷ leads com pedido no mês` },
    { r: 'Potencial total', v: brlC(k.pot), sec: `sem outliers: <b>${brlC(k.potSemOut)}</b>${k.nOut ? ` · ${int(k.nOut)} outlier(s)` : ''}`, sp: s.pot, d: delta(s.pot, 'brl'), tip: `${brl(k.pot)} · sem outliers ${brl(k.potSemOut)} (limite ${brl(CFG.limite_outlier_reais)})` },
    { r: 'Potencial em aberto', v: brlC(k.aberto), sec: `${pct(k.pot ? k.aberto / k.pot : null)} do potencial · realizado ${pct(k.pot ? k.fat / k.pot : null)}`, sp: s.aberto, d: delta(s.aberto, 'brl', null), tip: `${brl(k.aberto)} · em andamento, sem retorno e sem pedido registrado` },
  ];
  $('#kpis').innerHTML = cartoes.map(c => `<div class="kpi" data-tip="${esc(c.tip)}"><div class="kpi-topo"><span class="kpi-rot">${esc(c.r)}</span>${L.length ? sparkline(c.sp, pi) : ''}</div><div class="kpi-valor">${c.v}</div><div class="kpi-sec">${c.sec}</div><div class="kpi-pe">${L.length ? c.d : ''}</div></div>`).join('');

  // Funil
  const por = agrupar(L, l => l.grp), q = g => (por.get(g) || []).length;
  const n = L.length, avanc = q('Em andamento') + q('Fechado'), fech = q('Fechado');
  const etapas = [
    { t: 'Leads recebidos', sub: 'todos os leads', v: n, cor: css('--primaria'), g: null },
    { t: 'Em andamento ou fechado', sub: 'com avanço comercial', v: avanc, cor: css('--andamento'), g: ['Em andamento', 'Fechado'] },
    { t: 'Fechado', sub: 'pedido fechado', v: fech, cor: css('--fechado'), g: ['Fechado'] },
  ];
  const saidas = [
    { t: 'Perdidos/descartados', g: ['Perdido', 'Descartado'], v: q('Perdido') + q('Descartado'), cor: css('--perdido') },
    { t: 'Sem retorno', g: ['Sem retorno'], v: q('Sem retorno'), cor: css('--semretorno') },
    { t: 'Sem pedido registrado', g: ['Sem pedido registrado'], v: q('Sem pedido registrado'), cor: css('--sempedido') },
  ];
  if (q('Outros (revisar)')) saidas.push({ t: 'Outros (revisar)', g: ['Outros (revisar)'], v: q('Outros (revisar)'), cor: css('--outros') });
  const fun = $('#funil');
  if (!n) fun.innerHTML = htmlVazio();
  else {
    fun.innerHTML = `<div class="funil">${etapas.map((e, i) => `<button class="funil-etapa saida" style="background:none;padding:4px;border:0" data-e="${i}" data-tip="${esc(`${e.t}: ${int(e.v)} (${pct(e.v / n)})`)}"><span class="rot">${e.t}<small>${e.sub}</small></span><span class="funil-trilho"><i style="width:${Math.max(2, e.v / n * 100)}%;background:${e.cor}"></i></span><span class="v">${int(e.v)}<small>${pct(e.v / n)}</small></span></button>`).join('')}</div>
      <div class="funil-saidas" style="grid-template-columns:repeat(${saidas.length},1fr)">${saidas.map((x, i) => `<button class="saida" data-s="${i}"><span class="r"><span class="ponto" style="background:${x.cor}"></span>${x.t}</span><span class="v">${int(x.v)} <small>${pct(x.v / n)}</small></span></button>`).join('')}</div>`;
    $$('[data-e]', fun).forEach(b => b.addEventListener('click', () => { const g = etapas[+b.dataset.e].g; F.g = g ? g.slice() : []; atualizar(); }));
    $$('[data-s]', fun).forEach(b => b.addEventListener('click', () => { F.g = saidas[+b.dataset.s].g.slice(); atualizar(); }));
  }

  // Status
  listaBarras($('#status-barras'), ORDEM_GRUPOS.filter(g => q(g)).map(g => {
    const pot = soma(por.get(g), l => l.pot);
    return { k: g, t: g, v: q(g), vt: `${int(q(g))} · ${pct(q(g) / n)}`, sec: brlC(pot), cor: corGrupo(g), ativa: F.g.includes(g), tip: `${g}: ${int(q(g))} leads (${pct(q(g) / n)}) · potencial ${brl(pot)}` };
  }), { onClick: r => alternar('g', r.k) });

  // Faturado por mês (mês do pedido) e leads recebidos (mês de entrada) — dois gráficos, um eixo cada
  const mp = M.d.meta.meses_pedidos || [];
  const mesesFat = M.meses.filter(m => m >= (mp[0] || M.meses[0]));
  const cor = css('--marca-serie');
  const rot = m => rotMes(m) + (m === M.mesParcial ? ' (parcial)' : '');
  const fatVals = mesesFat.map(m => s.fat[M.meses.indexOf(m)]);
  const opBar = (labels, dados, fmt, tipTxt, clique) => ({
    type: 'bar',
    data: { labels: labels.map(rot), datasets: [{ data: dados, backgroundColor: labels.map(m => m === M.mesParcial ? alfa(cor, .4) : cor), borderColor: labels.map(m => m === M.mesParcial ? cor : 'transparent'), borderWidth: labels.map(m => m === M.mesParcial ? 1.5 : 0), borderDash: [4, 3], borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 46 }] },
    options: {
      layout: { padding: { top: 22 } }, scales: eixos(fmt),
      plugins: { rotulos: { fmt: v => fmt(v) }, tooltip: { callbacks: { title: it => it[0].label, label: tipTxt } } },
      onClick: (e, els) => { if (els.length) clique(labels[els[0].index]); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
  });
  const cliqueMes = m => { const de = m + '-01', ate = ultimoDia(m); if (F.de === de && F.ate === ate) { F.de = ''; F.ate = ''; } else { F.de = de; F.ate = ate; } atualizar(); };
  grafico('g-faturado-mes', opBar(mesesFat, fatVals, v => brlC(v), c => {
    const i = c.dataIndex, ant = i > 0 ? fatVals[i - 1] : null, v = c.raw;
    return [` Faturado: ${brl(v)}`, ` ${pct(k.fat ? v / k.fat : null)} do total`, ...(ant ? [` vs mês anterior: ${pct((v - ant) / ant, 0)}`] : []), ...(mesesFat[i] === M.mesParcial ? [' Mês em andamento (parcial)'] : [])];
  }, cliqueMes), !L.length || !fatVals.some(v => v));
  const leadsVals = M.meses.map((m, i) => s.leads[i]);
  grafico('g-leads-mes', opBar(M.meses, leadsVals, v => int(v), c => [` Leads: ${int(c.raw)}`, ` Fechados: ${int(s.fech[c.dataIndex])} (${pct(s.conv[c.dataIndex])})`, ...(M.meses[c.dataIndex] === M.mesParcial ? [' Mês em andamento (parcial)'] : [])], cliqueMes), !L.length);
}

function porVendedor(Lx) {
  return [...agrupar(Lx, l => l.vend).entries()].map(([v, ls]) => {
    const k = indicadores(ls); return { vend: v, ...k };
  });
}
function renderVendedores() {
  const R = porVendedor(L);
  const maxFat = Math.max(0, ...R.map(r => r.fat)), maxAb = Math.max(0, ...R.map(r => r.aberto));
  const info = new Map((M.d.vendedores || []).map(v => [v.vendedor, v]));
  tabela($('#ranking-vend'), 'vend', [
    { k: 'vend', t: 'Vendedor', v: r => r.vend, h: r => { const i = info.get(r.vend); return `<b style="font-weight:600">${esc(r.vend)}</b>${i && i.situacao !== 'ativo' ? ` <span class="selo selo-alerta">${esc(i.situacao)}</span>` : ''}`; } },
    { k: 'n', t: 'Leads', n: 1, v: r => r.n, h: r => int(r.n) },
    { k: 'fech', t: 'Fechados', n: 1, v: r => r.fech, h: r => int(r.fech) },
    { k: 'conv', t: 'Conversão', n: 1, v: r => r.conv, h: r => pct(r.conv) },
    { k: 'fat', t: 'Faturado', n: 1, v: r => r.fat, h: r => miniBarra(r.fat, maxFat, `<span data-tip="${esc(brl(r.fat))}">${brlC(r.fat)}</span>`, css('--fechado')) },
    { k: 'aberto', t: 'Potencial em aberto', n: 1, v: r => r.aberto, h: r => miniBarra(r.aberto, maxAb, `<span data-tip="${esc(brl(r.aberto))}">${brlC(r.aberto)}</span>`) },
    { k: 'semRet', t: 'Sem retorno', n: 1, v: r => r.semRet, h: r => `${int(r.semRet)} <small style="color:var(--txt-3)">${pct(r.n ? r.semRet / r.n : 0, 0)}</small>` },
  ], R, { ord: 'fat', dir: -1, paginar: false, onLinha: r => alternar('v', r.vend), linhaAtiva: r => F.v.includes(r.vend), vazio: 'Nenhum vendedor para os filtros selecionados' });

  const maxF = Math.max(1, ...R.map(r => r.fat));
  const topN = R.map((r, i) => [i, r.fat + r.n]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  const cor = css('--marca-serie');
  grafico('g-bolhas', {
    type: 'bubble',
    data: { datasets: [{ data: R.map(r => ({ x: r.n, y: (r.conv || 0) * 100, r: 5 + Math.sqrt(r.fat / maxF) * 22, nome: r.vend, k: r })), backgroundColor: R.map(r => F.v.includes(r.vend) ? alfa(css('--destaque'), .75) : alfa(cor, .45)), borderColor: css('--sup'), borderWidth: 2, hoverBorderColor: cor }] },
    options: {
      layout: { padding: { right: 24, top: 10 } },
      scales: eixos(v => v + '%', { x: { type: 'linear', beginAtZero: true, title: { display: true, text: 'Leads', color: css('--txt-3') }, grid: { color: css('--grade') } }, y: { title: { display: true, text: 'Conversão (%)', color: css('--txt-3') }, suggestedMax: 100 } }),
      plugins: {
        nomesBolha: { mostrar: topN },
        tooltip: { callbacks: { title: it => it[0].raw.nome, label: c => { const r = c.raw.k; return [` Leads: ${int(r.n)}`, ` Fechados: ${int(r.fech)} · conversão ${pct(r.conv)}`, ` Faturado: ${brl(r.fat)}`]; } } },
      },
      onClick: (e, els) => { if (els.length) alternar('v', R[els[0].index].vend); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
  }, !R.length);

  const sr = R.filter(r => r.semRet).sort((a, b) => b.semRet - a.semRet);
  listaBarras($('#semretorno-vend'), sr.map(r => ({ k: r.vend, t: r.vend, v: r.semRet, vt: int(r.semRet), sec: `${pct(r.semRet / r.n, 0)} dos leads`, cor: css('--semretorno'), ativa: F.v.includes(r.vend), tip: `${r.vend}: ${int(r.semRet)} de ${int(r.n)} leads sem retorno` })),
    { onClick: r => alternar('v', r.k), vazio: 'Nenhum lead sem retorno nos filtros' });
}

function renderScore() {
  const ordem = [3, 2, 1, 0], por = agrupar(L, l => l.score), n = L.length;
  const linhas = ordem.map(s => ({ s, ...indicadores(por.get(s) || []) })).filter(r => r.n);
  const maxConv = Math.max(0, ...linhas.map(r => r.conv || 0));
  tabela($('#tabela-score'), 'score', [
    { k: 's', t: 'Score', v: r => r.s, h: r => seloScore(r.s), ordenavel: false },
    { k: 'n', t: 'Leads', n: 1, v: r => r.n, h: r => `${int(r.n)} <small style="color:var(--txt-3)">${pct(r.n / n, 0)}</small>` },
    { k: 'fech', t: 'Fechados', n: 1, v: r => r.fech, h: r => int(r.fech) },
    { k: 'conv', t: 'Conversão', n: 1, v: r => r.conv, h: r => miniBarra(r.conv || 0, maxConv, pct(r.conv)) },
    { k: 'fat', t: 'Faturado', n: 1, v: r => r.fat, h: r => `<span data-tip="${esc(brl(r.fat))}">${brlC(r.fat)}</span>` },
    { k: 'ticket', t: 'Ticket médio', n: 1, v: r => r.ticket, h: r => brlC(r.ticket) },
    { k: 'pot', t: 'Potencial', n: 1, v: r => r.pot, h: r => `<span data-tip="${esc(brl(r.pot))}">${brlC(r.pot)}</span>` },
    { k: 'potm', t: 'Potencial médio', n: 1, v: r => r.n ? r.pot / r.n : null, h: r => brlC(r.n ? r.pot / r.n : null) },
    { k: 'real', t: 'Realizado ÷ potencial', n: 1, v: r => r.pot ? r.fat / r.pot : null, h: r => pct(r.pot ? r.fat / r.pot : null) },
  ], linhas, { paginar: false, onLinha: r => alternar('s', String(r.s)), linhaAtiva: r => F.s.includes(String(r.s)) });

  const cor = css('--marca-serie');
  grafico('g-conv-score', {
    type: 'bar',
    data: { labels: linhas.map(r => r.s ? `Score ${r.s}` : 'Sem score'), datasets: [{ data: linhas.map(r => (r.conv || 0) * 100), backgroundColor: linhas.map(r => F.s.includes(String(r.s)) ? css('--destaque') : cor), borderRadius: 4, maxBarThickness: 56 }] },
    options: {
      layout: { padding: { top: 22 } }, scales: eixos(v => v + '%'),
      plugins: { rotulos: { fmt: v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' }, tooltip: { callbacks: { label: c => { const r = linhas[c.dataIndex]; return [` Conversão: ${pct(r.conv)}`, ` ${int(r.fech)} fechados de ${int(r.n)} leads`, ` Ticket médio: ${brl(r.ticket)}`]; } } } },
      onClick: (e, els) => { if (els.length) alternar('s', String(linhas[els[0].index].s)); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
  }, !linhas.length);

  const pr = $('#pot-real-score');
  if (!linhas.length) pr.innerHTML = htmlVazio();
  else {
    const max = Math.max(...linhas.map(r => Math.max(r.pot, r.fat))) || 1, cP = css('--marca-serie'), cF = css('--fechado');
    pr.innerHTML = `<div class="legenda" style="margin-bottom:12px"><span><span class="ponto" style="background:${cP}"></span>Potencial cotado</span><span><span class="ponto" style="background:${cF}"></span>Faturado</span></div>
      <div class="barras">${linhas.map(r => `<button class="barra${F.s.includes(String(r.s)) ? ' ativa' : ''}" data-s="${r.s}" style="grid-template-columns:90px 1fr auto;align-items:center" data-tip="${esc(`Potencial ${brl(r.pot)} · faturado ${brl(r.fat)} · realizado ${pct(r.pot ? r.fat / r.pot : null)}`)}">
        <span class="barra-rot">${seloScore(r.s)}</span>
        <span style="display:flex;flex-direction:column;gap:4px"><span class="barra-trilho"><i style="width:${r.pot / max * 100}%;background:${cP}"></i></span><span class="barra-trilho"><i style="width:${Math.max(r.fat ? 1 : 0, r.fat / max * 100)}%;background:${cF}"></i></span></span>
        <span class="barra-val">${brlC(r.pot)}<br><span style="color:var(--txt-3)">${brlC(r.fat)} · ${pct(r.pot ? r.fat / r.pot : null)}</span></span></button>`).join('')}</div>`;
    $$('[data-s]', pr).forEach(b => b.addEventListener('click', () => alternar('s', b.dataset.s)));
  }

  const top = L.filter(l => GRUPOS_ABERTOS.has(l.grp) && l.pot != null).sort((a, b) => b.pot - a.pot).slice(0, 15);
  tabela($('#top-abertos'), 'top', [
    { k: 'pos', t: '#', v: r => top.indexOf(r) + 1, n: 1, ordenavel: false },
    { k: 'emp', t: 'Empresa', v: r => r.emp, cls: 'emp', h: r => `${esc(r.emp)}${r.out ? ' <span class="out">OUTLIER</span>' : ''}` },
    { k: 'score', t: 'Score', v: r => r.score, h: r => seloScore(r.score) },
    { k: 'vend', t: 'Vendedor', v: r => r.vend },
    { k: 'uf', t: 'UF', v: r => r.uf || '—' },
    { k: 'st', t: 'Status', v: r => r.stP || r.grp, h: r => seloStatus(r.grp, r.stP || r.grp) },
    { k: 'pot', t: 'Potencial', n: 1, v: r => r.pot, h: r => brl(r.pot) },
    { k: 'dias', t: 'Dias', n: 1, v: r => r.dias, h: r => r.dias == null ? '—' : `<span${r.dias > 60 ? ' class="ruim"' : ''}>${int(r.dias)}</span>` },
  ], top, { paginar: false, vazio: 'Nenhum lead em aberto com potencial nos filtros' });
}

function seqCor(t) { return misturar(css('--seq-0'), css('--seq-1'), Math.max(0, Math.min(1, t))); }
function seqTxt(t) { return luminancia(css('--seq-0'), css('--seq-1'), t) > 0.45 ? '#1C2633' : '#FFFFFF'; }
function renderGeo() {
  const met = UI.geo, f = { leads: ls => ls.length, pot: ls => soma(ls, l => l.pot), fat: ls => soma(ls, l => l.fat) }[met];
  const fmt = met === 'leads' ? int : brlC, fmtF = met === 'leads' ? int : brl;
  const seg = $('#geo-metrica');
  seg.innerHTML = '<span class="rot">Métrica</span>' + [['leads', 'Leads'], ['pot', 'Potencial'], ['fat', 'Faturado']].map(([k, t]) => `<button aria-pressed="${k === met}" data-m="${k}">${t}</button>`).join('');
  $$('button', seg).forEach(b => b.addEventListener('click', () => { UI.geo = b.dataset.m; gravarHash(); renderGeo(); }));
  const por = agrupar(L, l => l.uf || SEM), tot = f(L);
  const vals = Object.keys(MOSAICO_UF).map(uf => [uf, f(por.get(uf) || [])]);
  const max = Math.max(0, ...vals.map(v => v[1])) || 1;
  const nomes = CFG.ufs || {};
  $('#mapa').innerHTML = L.length ? `<div class="mapa" role="group" aria-label="Mapa do Brasil em mosaico por UF">${vals.map(([uf, v]) => {
    const [c, r] = MOSAICO_UF[uf], t = v / max;
    const estilo = v ? `background:${seqCor(0.08 + t * 0.92)};color:${seqTxt(0.08 + t * 0.92)}` : '';
    return `<button class="uf${v ? '' : ' nada'}${F.u.includes(uf) ? ' sel' : ''}" style="grid-column:${c + 1};grid-row:${r + 1};${estilo}" data-uf="${uf}" aria-pressed="${F.u.includes(uf)}" aria-label="${esc(nomes[uf] || uf)}: ${esc(fmtF(v))}" data-tip="${esc(`${nomes[uf] || uf} (${uf}) · ${fmtF(v)}${tot ? ` · ${pct(v / tot)}` : ''}`)}">${uf}<small>${v ? fmt(v) : ''}</small></button>`;
  }).join('')}</div><div class="legenda-seq"><span>${fmt(0)}</span><i></i><span>${fmt(max)}</span></div>${por.get(SEM) ? `<p class="nota" style="text-align:center">${int(por.get(SEM).length)} lead(s) sem UF (não estão na planilha de potencial ou UF não reconhecida).</p>` : ''}` : htmlVazio();
  $$('[data-uf]', $('#mapa')).forEach(b => b.addEventListener('click', () => alternar('u', b.dataset.uf)));
  $('#geo-sub').textContent = { leads: 'Quantidade de leads', pot: 'Potencial cotado (R$)', fat: 'Faturado (R$)' }[met] + ' · clique para filtrar';
  const ufs = [...por.entries()].map(([uf, ls]) => ({ k: uf, t: uf === SEM ? 'Sem UF' : `${uf} · ${nomes[uf] || ''}`, v: f(ls), n: ls.length })).filter(r => r.v || r.n).sort((a, b) => b.v - a.v);
  listaBarras($('#ranking-uf'), ufs.map(r => ({ ...r, vt: fmt(r.v), sec: tot ? pct(r.v / tot, 0) : '', ativa: F.u.includes(r.k), tip: `${r.t}: ${fmtF(r.v)} · ${int(r.n)} leads` })), { onClick: r => alternar('u', r.k) });
  const regs = [...agrupar(L, l => l.reg || SEM).entries()].map(([g, ls]) => ({ k: g, t: g === SEM ? 'Sem região' : g, v: f(ls), n: ls.length })).sort((a, b) => b.v - a.v);
  listaBarras($('#ranking-reg'), regs.map(r => ({ ...r, vt: fmt(r.v), sec: `${tot ? pct(r.v / tot, 0) : ''} · ${int(r.n)} leads`, ativa: F.r.includes(r.k), tip: `${r.t}: ${fmtF(r.v)}` })), { onClick: r => alternar('r', r.k) });
}

function itensFiltrados() {
  const fs = F.f.length ? new Set(F.f) : null;
  return L.flatMap(l => l.itens.map(it => ({ ...it, l }))).filter(it => !fs || fs.has(it.familia));
}
function renderProdutos() {
  const its = itensFiltrados();
  const porItem = [...agrupar(its, i => i.item_padrao).entries()].map(([k, a]) => ({ k, fam: a[0].familia, q: soma(a, i => i.quantidade), leads: new Set(a.map(i => i.l.id)).size, ls: a }));
  const top = porItem.slice().sort((a, b) => b.q - a.q).slice(0, 15);
  const cor = css('--marca-serie');
  grafico('g-itens', {
    type: 'bar',
    data: { labels: top.map(r => r.k), datasets: [{ data: top.map(r => r.q), backgroundColor: top.map(r => F.f.includes(r.fam) ? css('--destaque') : cor), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] },
    options: {
      indexAxis: 'y', layout: { padding: { right: 56 } },
      scales: { x: { beginAtZero: true, grid: { color: css('--grade') }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: v => int(v) } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: css('--txt-2'), autoSkip: false } } },
      plugins: { rotulos: { fmt: v => int(v) }, tooltip: { callbacks: { label: c => { const r = top[c.dataIndex]; return [` Quantidade potencial: ${int(r.q)}`, ` Leads que cotaram: ${int(r.leads)}`, ` Família: ${r.fam}`]; } } } },
      onClick: (e, els) => { if (els.length) alternar('f', top[els[0].index].fam); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
  }, !top.length);

  const fams = [...agrupar(its, i => i.familia).entries()].map(([k, a]) => ({ k, q: soma(a, i => i.quantidade), leads: new Set(a.map(i => i.l.id)).size })).sort((a, b) => b.q - a.q);
  const totQ = soma(fams, f => f.q);
  listaBarras($('#familias'), fams.map(f => ({ k: f.k, t: f.k, v: f.q, vt: pct(totQ ? f.q / totQ : 0, 0), sec: `${int(f.leads)} leads`, ativa: F.f.includes(f.k), tip: `${f.k}: ${int(f.q)} unidades (${pct(totQ ? f.q / totQ : 0)}) · ${int(f.leads)} leads` })),
    { onClick: r => alternar('f', r.k), vazio: 'Nenhum item cotado nos filtros' });

  // Mapa de calor: itens × Score ou × UF (nº de leads que cotaram)
  const seg = $('#heat-eixo');
  seg.innerHTML = '<span class="rot">Por</span>' + [['score', 'Score'], ['uf', 'UF']].map(([k, t]) => `<button aria-pressed="${k === UI.heat}" data-h="${k}">${t}</button>`).join('');
  $$('button', seg).forEach(b => b.addEventListener('click', () => { UI.heat = b.dataset.h; gravarHash(); renderProdutos(); }));
  const linhas = porItem.slice().sort((a, b) => b.leads - a.leads).slice(0, 12);
  let colunas;
  if (UI.heat === 'score') colunas = [3, 2, 1, 0].map(s => ({ k: s, t: s ? `Score ${s}` : 'Sem score', f: i => i.l.score === s }));
  else colunas = [...agrupar(its, i => i.l.uf || SEM).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([uf]) => ({ k: uf, t: uf === SEM ? 'Sem UF' : uf, f: i => (i.l.uf || SEM) === uf }));
  const cel = linhas.map(r => colunas.map(c => new Set(r.ls.filter(c.f).map(i => i.l.id)).size));
  const max = Math.max(1, ...cel.flat());
  $('#heatmap').innerHTML = linhas.length ? `<div class="tabela-wrap" style="border:0"><table class="heat"><thead><tr><th></th>${colunas.map(c => `<th>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${linhas.map((r, i) => `<tr><td class="rot">${esc(r.k)} <small style="color:var(--txt-3)">${esc(r.fam)}</small></td>${cel[i].map((v, j) => `<td style="${v ? `background:${seqCor(0.1 + v / max * 0.9)};color:${seqTxt(0.1 + v / max * 0.9)}` : 'background:var(--sup-2);color:var(--txt-3)'}" data-tip="${esc(`${r.k} · ${colunas[j].t}: ${v} lead(s)`)}">${v || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : htmlVazio('Nenhum item cotado nos filtros');
}

function renderPerdas() {
  const perd = L.filter(l => GRUPOS_PERDA.has(l.grp)), semRet = L.filter(l => l.grp === 'Sem retorno');
  const mot = [...agrupar(perd, l => l.mot || MOTIVO_SEM).entries()].map(([k, a]) => ({ k, n: a.length, pot: soma(a, l => l.pot) })).sort((a, b) => b.n - a.n);
  const linhas = mot.map(m => ({ k: m.k, t: m.k, v: m.n, vt: `${int(m.n)} leads`, sec: brlC(m.pot), cor: css('--perdido'), tip: `${m.k}: ${int(m.n)} leads · potencial perdido ${brl(m.pot)}` }));
  if (semRet.length) linhas.push({ k: '_sr', t: 'Sem retorno (ainda em aberto)', v: semRet.length, vt: `${int(semRet.length)} leads`, sec: brlC(soma(semRet, l => l.pot)), cor: css('--semretorno'), ativa: F.g.includes('Sem retorno'), tip: `Leads sem retorno: ${int(semRet.length)} · potencial ${brl(soma(semRet, l => l.pot))}` });
  listaBarras($('#motivos'), linhas, { onClick: r => { F.g = r.k === '_sr' ? ['Sem retorno'] : ['Perdido', 'Descartado']; atualizar(); }, vazio: 'Nenhuma perda nos filtros' });
  const porMes = agrupar(perd, l => l.mes);
  const meses = M.meses.filter(m => L.some(l => l.mes === m));
  const vals = meses.map(m => (porMes.get(m) || []).length), tot = meses.map(m => L.filter(l => l.mes === m).length);
  grafico('g-perdas-mes', {
    type: 'bar',
    data: { labels: meses.map(m => rotMes(m) + (m === M.mesParcial ? ' (parcial)' : '')), datasets: [{ data: vals, backgroundColor: meses.map(m => m === M.mesParcial ? alfa(css('--perdido'), .45) : css('--perdido')), borderRadius: 4, maxBarThickness: 46 }] },
    options: {
      layout: { padding: { top: 22 } }, scales: eixos(v => int(v)),
      plugins: { rotulos: { fmt: (v, i) => `${int(v)} · ${pct(tot[i] ? v / tot[i] : 0, 0)}` }, tooltip: { callbacks: { label: c => { const ls = porMes.get(meses[c.dataIndex]) || []; const m = [...agrupar(ls, l => l.mot || MOTIVO_SEM).entries()].sort((a, b) => b[1].length - a[1].length); return [` Perdidos/descartados: ${int(c.raw)} de ${int(tot[c.dataIndex])} leads do mês`, ...m.map(([k, a]) => `  · ${k}: ${a.length}`)]; } } } },
    },
  }, !perd.length);
  tabela($('#lista-perdas'), 'perdas', [
    { k: 'dia', t: 'Entrada', v: r => r.dia, h: r => dataBR(r.dia) },
    { k: 'emp', t: 'Empresa', v: r => r.emp, cls: 'emp' },
    { k: 'vend', t: 'Vendedor', v: r => r.vend },
    { k: 'score', t: 'Score', v: r => r.score, h: r => seloScore(r.score) },
    { k: 'stO', t: 'Status original', v: r => r.stO, h: r => seloStatus(r.grp, r.stO) },
    { k: 'mot', t: 'Motivo', v: r => r.mot || MOTIVO_SEM },
    { k: 'pot', t: 'Potencial', n: 1, v: r => r.pot, h: r => brl(r.pot) },
  ], perd, { ord: 'pot', dir: -1, vazio: 'Nenhum lead perdido nos filtros' });
}

const COLS_LEADS = [
  { k: 'dia', t: 'Entrada', v: r => r.dia, h: r => dataBR(r.dia), f: r => dataBR(r.dia), csv: r => dataBR(r.dia) },
  { k: 'emp', t: 'Empresa', v: r => r.emp, cls: 'emp', h: r => `<span title="${esc(r.emp)}">${esc(r.emp)}</span>${r.out ? ' <span class="out">OUTLIER</span>' : ''}${r.rec ? ' <span class="sc sc-0" title="Empresa com mais de um lead">recorrente</span>' : ''}` },
  { k: 'vend', t: 'Vendedor', v: r => r.vend },
  { k: 'uf', t: 'UF', v: r => r.uf || '', h: r => r.uf || '—' },
  { k: 'score', t: 'Score', v: r => r.score, h: r => seloScore(r.score), f: r => r.score ? 'Score ' + r.score : 'Sem score', csv: r => r.score || '' },
  { k: 'grp', t: 'Status', v: r => r.grp, h: r => seloStatus(r.grp, r.grp), csv: r => r.grp },
  { k: 'stO', t: 'Status original', v: r => r.stO, cls: 'longo', h: r => `<span title="${esc(r.stO)}">${esc(r.stO)}</span>` },
  { k: 'mot', t: 'Motivo de perda', v: r => r.mot || '' },
  { k: 'pot', t: 'Potencial', n: 1, v: r => r.pot, h: r => brl(r.pot), csv: r => r.pot == null ? '' : String(r.pot).replace('.', ',') },
  { k: 'fat', t: 'Faturado', n: 1, v: r => r.fat, h: r => r.fat ? brl(r.fat) : '—', csv: r => String(r.fat).replace('.', ',') },
  { k: 'dias', t: 'Dias', n: 1, v: r => GRUPOS_ABERTOS.has(r.grp) ? r.dias : null, h: r => GRUPOS_ABERTOS.has(r.grp) && r.dias != null ? int(r.dias) : '—', csv: r => GRUPOS_ABERTOS.has(r.grp) && r.dias != null ? r.dias : '' },
  { k: 'flags', t: 'Alertas', v: r => r.flags.length, f: r => r.flags.join(' '), h: r => r.flags.length ? `<span class="alerta-ico" role="img" aria-label="${esc(r.flags.join('; '))}" data-tip="${esc(r.flags.join(' · '))}">${ICO.alerta}</span>` : '', csv: r => r.flags.join(' | ') },
];
function leadsDaTabela() {
  const q = UI.busca.trim().toLowerCase();
  return q ? L.filter(l => `${l.emp} ${l.vend} ${l.stO} ${l.grp} ${l.uf || ''} ${l.mot || ''}`.toLowerCase().includes(q)) : L;
}
function renderLeads() {
  const ls = leadsDaTabela();
  $('#leads-sub').textContent = `${int(ls.length)} de ${int(M.leads.length)} leads · use os campos abaixo dos títulos para filtrar cada coluna`;
  tabela($('#tabela-leads'), 'leads', COLS_LEADS, ls, { ord: 'dia', dir: -1, filtrosColuna: true, tam: 25 });
}
function exportarCSV() {
  const el = $('#tabela-leads'), rows = el._linhas || leadsDaTabela();
  const cols = [{ t: 'ID', csv: r => r.id }, ...COLS_LEADS, { t: 'Região', csv: r => r.reg || '' }, { t: 'Empresa recorrente', csv: r => r.rec ? 'sim' : 'não' }, { t: 'Outlier', csv: r => r.out ? 'sim' : 'não' }, { t: 'Sem correspondência', csv: r => r.semC ? 'sim' : 'não' }, { t: 'Itens', csv: r => r.itens.map(i => `${i.item_padrao}${i.quantidade != null ? ' (' + i.quantidade + ')' : ''}`).join(', ') }];
  const q = s => { s = String(s == null ? '' : s); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const linhas = [cols.map(c => q(c.t)).join(';'), ...rows.map(r => cols.map(c => q(c.csv ? c.csv(r) : c.v(r))).join(';'))];
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `leads_pre_vendas_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(`${int(rows.length)} leads exportados para CSV`);
}

function renderQualidade() {
  const d = M.d, r = d.meta.resumo || {}, ids = new Set(L.map(l => l.id));
  const ql = d.qualidade.filter(q => !q.lead_id || ids.has(q.lead_id));
  const cont = t => ql.filter(q => q.tipo_problema === t).length;
  $('#q-sub').textContent = `Planilhas lidas em ${dataHoraBR(d.meta.gerado_em)} · os números abaixo respeitam os filtros ativos`;
  const cards = [
    ['Linhas lidas (status / potencial)', `${int(r.linhas_status)} / ${int(r.linhas_potencial)}`],
    ['Linhas válidas', `${int(r.validas_status)} / ${int(r.validas_potencial)}`],
    ['Leads no painel', int(L.length)],
    ['Casados empresa + data', int(r.casados_empresa_data)],
    ['Casados só por empresa', int(r.casados_so_empresa)],
    ['Sem correspondência', int(L.filter(l => l.semC).length)],
    ['Sem score', int(L.filter(l => !l.score && l.origem !== 'so_potencial').length)],
    ['Sem potencial', int(L.filter(l => l.pot == null).length)],
    ['Duplicadas', int(cont('Linha duplicada (mesma empresa, data e vendedor)'))],
    ['Empresas recorrentes', int(new Set(L.filter(l => l.rec).map(l => l.empN)).size)],
    ['Outliers de potencial', int(L.filter(l => l.out).length)],
  ];
  $('#q-resumo').innerHTML = cards.map(([t, v]) => `<div class="rq"><div class="r">${esc(t)}</div><div class="v">${v}</div></div>`).join('');
  const nm = d.nao_mapeados || { status: [], itens: [], ufs: [] };
  $('#q-status').innerHTML = nm.status.length || nm.ufs.length ? `<ul class="lista-simples">${nm.status.map(s => `<li><span>${esc(s.valor)}</span><b>${int(s.contagem)}</b></li>`).join('')}${nm.ufs.map(u => `<li><span>UF: ${esc(u.valor)}</span><b>${int(u.contagem)}</b></li>`).join('')}</ul>`
    : `<p class="ok" style="margin:0">Todos os status e UFs foram reconhecidos.</p><p class="nota">Novos status são classificados pelo mapa do config.json.</p>`;
  $('#q-itens').innerHTML = nm.itens.length ? `<ul class="lista-simples">${nm.itens.map(i => `<li><span>${esc(i.item)}<br><small>${esc(i.sugestao)} · família: ${esc(i.familia)}</small></span><b>${int(i.contagem)}</b></li>`).join('')}</ul>` : '<p class="ok" style="margin:0">Todos os itens foram reconhecidos.</p>';
  const val = d.meta.validacao || [];
  const vend = (d.vendedores || []).filter(v => v.situacao !== 'ativo');
  $('#q-validacao').innerHTML = (val.length ? `<p style="margin:0 0 6px"><b class="${val.every(v => v.ok) ? 'ok' : 'ruim'}">${val.filter(v => v.ok).length} de ${val.length}</b> totais iguais à referência de 09/10/2026</p>
      <details><summary style="cursor:pointer;font-size:12.5px;color:var(--txt-2)">Ver detalhes</summary><ul class="lista-simples">${val.map(v => `<li><span>${esc(v.indicador)}</span><span class="${v.ok ? 'ok' : 'ruim'}">${v.ok ? 'OK' : `${esc(v.obtido)} ≠ ${esc(v.esperado)}`}</span></li>`).join('')}</ul></details>`
    : '<p class="nota" style="margin:0">Validação disponível apenas quando o painel é gerado pelo script.</p>') +
    `<h3 style="font-size:13px;margin:16px 0 4px">Vendedores fora do padrão</h3>${vend.length ? `<ul class="lista-simples">${vend.map(v => `<li><span>${esc(v.vendedor)}<br><small>${v.situacao === 'inativo' ? `aba "${esc(v.aba)}" marcada como inativo` : 'sem aba própria na planilha'}</small></span><b>${int(v.leads)}</b></li>`).join('')}</ul>` : '<p class="ok" style="margin:0">Todos com aba própria e ativos.</p>'}` +
    ((d.meta.avisos || []).length ? `<h3 style="font-size:13px;margin:16px 0 4px">Avisos de estrutura</h3><ul class="lista-simples">${d.meta.avisos.map(a => `<li><span>${esc(a)}</span></li>`).join('')}</ul>` : '');
  const tipos = [...new Set(d.qualidade.map(q => q.tipo_problema))].sort();
  const sel = $('#q-tipo');
  sel.innerHTML = `<option value="">Todos (${int(ql.length)})</option>` + tipos.map(t => `<option value="${esc(t)}" ${t === UI.qtipo ? 'selected' : ''}>${esc(t)} (${int(cont(t))})</option>`).join('');
  sel.onchange = () => { UI.qtipo = sel.value; renderQualidade(); };
  const lista = ql.filter(q => !UI.qtipo || q.tipo_problema === UI.qtipo);
  tabela($('#q-lista'), 'qual', [
    { k: 'tipo', t: 'Tipo', v: q => q.tipo_problema },
    { k: 'emp', t: 'Empresa', v: q => q.empresa || '', cls: 'emp' },
    { k: 'vend', t: 'Vendedor', v: q => q.vendedor || '' },
    { k: 'det', t: 'Detalhe', v: q => q.detalhe || '', cls: 'quebra' },
    { k: 'id', t: 'Lead', v: q => q.lead_id || '' },
  ], lista, { ord: 'tipo', dir: 1, filtrosColuna: true, vazio: 'Nenhuma inconsistência para os filtros' });
}

const RENDER = { geral: renderGeral, vendedores: renderVendedores, score: renderScore, geo: renderGeo, produtos: renderProdutos, perdas: renderPerdas, leads: renderLeads, qualidade: renderQualidade };

/* ============================ Filtros (interface) ============================ */
function montarMultiSelecao() {
  $$('.ms').forEach(box => {
    const k = box.dataset.chave, rot = box.dataset.rotulo;
    box.innerHTML = `<button class="ms-btn" aria-haspopup="true" aria-expanded="false"><span class="rot">${esc(rot)}</span><span class="val"></span>${ICO.seta}</button>
      <div class="ms-pop" hidden role="dialog" aria-label="Filtrar ${esc(rot)}">${M.opcoes[k].length > 8 ? '<input class="ms-busca" placeholder="Buscar…" aria-label="Buscar opções">' : ''}<div class="ms-opts"></div>
      <div class="ms-pe"><button data-a="limpar">Limpar</button><button data-a="fechar">Fechar</button></div></div>`;
    const btn = $('.ms-btn', box), pop = $('.ms-pop', box), opts = $('.ms-opts', box), busca = $('.ms-busca', box);
    const desenhar = () => {
      const q = busca ? busca.value.toLowerCase() : '';
      opts.innerHTML = M.opcoes[k].filter(o => !q || o.t.toLowerCase().includes(q)).map(o => `<label class="ms-opt">${k === 'g' ? `<span class="ponto" style="background:${corGrupo(o.k)}"></span>` : ''}<input type="checkbox" value="${esc(o.k)}" ${F[k].includes(o.k) ? 'checked' : ''}><span>${esc(o.t)}</span><span class="c">${int(o.c)}</span></label>`).join('') || '<div class="vazio" style="min-height:0;padding:12px">Nada encontrado</div>';
      $$('input', opts).forEach(i => i.addEventListener('change', () => { alternar(k, i.value); }));
    };
    const abrir = v => { pop.hidden = !v; btn.setAttribute('aria-expanded', v); if (v) { $$('.ms-pop').forEach(p => { if (p !== pop) { p.hidden = true; p.parentNode.querySelector('.ms-btn').setAttribute('aria-expanded', 'false'); } }); desenhar(); (busca || $('input', opts) || btn).focus(); } };
    btn.addEventListener('click', e => { e.stopPropagation(); abrir(pop.hidden); });
    pop.addEventListener('click', e => e.stopPropagation());
    pop.addEventListener('keydown', e => { if (e.key === 'Escape') { abrir(false); btn.focus(); } });
    if (busca) busca.addEventListener('input', desenhar);
    $('[data-a="limpar"]', pop).addEventListener('click', () => { F[k] = []; atualizar(); desenhar(); });
    $('[data-a="fechar"]', pop).addEventListener('click', () => { abrir(false); btn.focus(); });
    box._desenhar = desenhar;
  });
}
let filtrosMontados = false;
function montarFiltros() {
  montarMultiSelecao();
  const selMes = $('#f-mes');
  selMes.innerHTML = '<option value="">Todo o período</option>' + M.meses.filter(m => M.leads.some(l => l.mes === m)).map(m => `<option value="${m}">${MESES_NOME[+m.slice(5) - 1]} ${m.slice(0, 4)}${m === M.mesParcial ? ' (parcial)' : ''}</option>`).join('');
  if (filtrosMontados) return; // ouvintes fixos só uma vez (o painel pode ser recarregado manualmente)
  filtrosMontados = true;
  document.addEventListener('click', () => $$('.ms-pop').forEach(p => { if (!p.hidden) { p.hidden = true; p.parentNode.querySelector('.ms-btn').setAttribute('aria-expanded', 'false'); } }));
  const sc = $('#f-score');
  sc.innerHTML = '<span class="rot">Score</span>' + [['3', '3'], ['2', '2'], ['1', '1'], ['0', 'Sem']].map(([k, t]) => `<button data-s="${k}" aria-pressed="false" aria-label="${k === '0' ? 'Sem score' : 'Score ' + k}">${t}</button>`).join('');
  $$('button', sc).forEach(b => b.addEventListener('click', () => alternar('s', b.dataset.s)));
  selMes.addEventListener('change', () => { const m = selMes.value; F.de = m ? m + '-01' : ''; F.ate = m ? ultimoDia(m) : ''; atualizar(); });
  $('#f-de').addEventListener('change', e => { F.de = e.target.value; atualizar(); });
  $('#f-ate').addEventListener('change', e => { F.ate = e.target.value; atualizar(); });
  $('#f-outlier').addEventListener('change', e => { F.o = e.target.checked; atualizar(); });
  $('#filtros-toggle').addEventListener('click', () => { const f = $('#filtros'), v = !f.classList.contains('aberto'); f.classList.toggle('aberto', v); $('#filtros-toggle').setAttribute('aria-expanded', v); });
}
function sincronizarFiltros() {
  $('#f-de').value = F.de; $('#f-ate').value = F.ate;
  const m = F.de && F.ate && F.de.slice(0, 7) === F.ate.slice(0, 7) && F.de.endsWith('-01') && F.ate === ultimoDia(F.de.slice(0, 7)) ? F.de.slice(0, 7) : '';
  $('#f-mes').value = [...$('#f-mes').options].some(o => o.value === m) ? m : '';
  $('#f-outlier').checked = F.o;
  $$('#f-score button').forEach(b => b.setAttribute('aria-pressed', F.s.includes(b.dataset.s)));
  $$('.ms').forEach(box => {
    const k = box.dataset.chave, sel = F[k], ops = M.opcoes[k];
    $('.val', box).textContent = !sel.length ? 'Todos' : sel.length === 1 ? (ops.find(o => o.k === sel[0]) || { t: sel[0] }).t : `${sel.length} selecionados`;
    $('.ms-btn', box).classList.toggle('ativo', !!sel.length);
    if (!$('.ms-pop', box).hidden) box._desenhar();
  });
  // chips
  const chips = [];
  if (F.de || F.ate) chips.push({ r: 'Período', t: `${F.de ? dataBR(F.de) : 'início'} – ${F.ate ? dataBR(F.ate) : 'hoje'}`, x: () => { F.de = ''; F.ate = ''; } });
  for (const k of ['v', 's', 'g', 'r', 'u', 'f']) for (const v of F[k]) {
    const o = k === 's' ? { t: v === '0' ? 'Sem score' : 'Score ' + v } : (M.opcoes[k].find(o => o.k === v) || { t: v });
    chips.push({ r: ROT_FILTRO[k], t: o.t, x: () => { F[k] = F[k].filter(z => z !== v); } });
  }
  if (F.o) chips.push({ r: 'Outliers', t: 'excluídos', x: () => { F.o = false; } });
  $('#chips').innerHTML = chips.map((c, i) => `<span class="chip"><b>${esc(c.r)}</b> ${esc(c.t)}<button data-c="${i}" aria-label="Remover filtro ${esc(c.r)} ${esc(c.t)}">${ICO.x}</button></span>`).join('') + (chips.length ? '<button class="limpar" id="limpar-filtros">Limpar filtros</button>' : '');
  $$('[data-c]', $('#chips')).forEach(b => b.addEventListener('click', () => { chips[+b.dataset.c].x(); atualizar(); }));
  const lf = $('#limpar-filtros'); if (lf) lf.addEventListener('click', () => { Object.assign(F, { de: '', ate: '', v: [], s: [], g: [], r: [], u: [], f: [], o: false }); atualizar(); });
  $('#filtros-cont').textContent = chips.length ? `${chips.length} ativo(s)` : '';
  $('#selo-outlier').hidden = !F.o;
  $('#cab-impressao').innerHTML = `<b style="font:700 16px var(--fonte-titulo)">Pré-Vendas Chamfer · ${esc((ABAS.find(a => a.id === UI.aba) || {}).t)}</b><br><span style="color:var(--txt-3)">Dados de ${dataHoraBR(M.meta.gerado_em)} · filtros: ${chips.length ? chips.map(c => `${esc(c.r)}: ${esc(c.t)}`).join(' · ') : 'nenhum'}</span>`;
}

/* ============================ Abas, tema e ciclo de renderização ============================ */
function montarAbas() {
  const nav = $('#abas');
  nav.innerHTML = ABAS.map(a => `<button class="aba" role="tab" id="aba-${a.id}" aria-controls="pg-${a.id}" aria-selected="false" tabindex="-1" data-aba="${a.id}">${esc(a.t)}</button>`).join('');
  $$('.aba', nav).forEach((b, i, todas) => {
    b.addEventListener('click', () => irPara(b.dataset.aba));
    b.addEventListener('keydown', e => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % todas.length; else if (e.key === 'ArrowLeft') j = (i - 1 + todas.length) % todas.length;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = todas.length - 1;
      if (j != null) { e.preventDefault(); todas[j].focus(); irPara(todas[j].dataset.aba); }
    });
  });
}
function irPara(id) {
  UI.aba = id;
  $$('.aba').forEach(b => { const s = b.dataset.aba === id; b.setAttribute('aria-selected', s); b.tabIndex = s ? 0 : -1; if (s) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  $$('.pagina').forEach(p => p.classList.toggle('ativa', p.id === 'pg-' + id));
  if (sujas.has(id)) { RENDER[id](); sujas.delete(id); }
  gravarHash(); sincronizarFiltros();
}
function atualizar() {
  L = filtrar(M.leads);
  ABAS.forEach(a => sujas.add(a.id));
  sincronizarFiltros();
  RENDER[UI.aba](); sujas.delete(UI.aba);
  gravarHash();
}
function aplicarTema(t, render) {
  document.documentElement.setAttribute('data-theme', t);
  temaGraficos();
  if (render && M) atualizar();
}
function aplicarCoresConfig() {
  const c = CORES; if (!c.primaria) return;
  const st = document.createElement('style');
  st.textContent = `:root{--primaria:${c.primaria};--marca-serie:${c.primaria};--destaque:${c.destaque};--fechado:${c.sucesso_fechado};--andamento:${c.atencao_em_andamento};--perdido:${c.perigo_perdido};--semretorno:${c.neutro_sem_retorno};${c.sem_pedido_registrado ? `--sempedido:${c.sem_pedido_registrado};` : ''}${c.descartado ? `--descartado:${c.descartado};` : ''}${c.outros_revisar ? `--outros:${c.outros_revisar};` : ''}--bg:${c.fundo_claro};--sup:${c.superficie_clara};--seq-1:${c.primaria}}
  :root[data-theme="dark"]{--bg:${c.fundo_escuro};--sup:${c.superficie_escura};--destaque:${c.destaque}}`;
  document.head.appendChild(st);
}
function rodape() {
  const m = M.meta;
  $('#carimbo').innerHTML = `Atualizado em <b>${dataHoraBR(m.gerado_em)}</b>`;
  $('#selo-manual').hidden = m.modo !== 'manual';
  $('#rodape').innerHTML = `<div><b>Arquivos de origem</b><ul>${(m.arquivos_origem || []).map(a => `<li>${esc(a.caminho || a.nome)} · modificado em ${dataHoraBR(a.modificado_em)}</li>`).join('')}</ul></div>
    <div><b>Última atualização:</b> ${dataHoraBR(m.gerado_em)}${m.modo === 'manual' ? ' (carregado manualmente no navegador)' : ''}<br>
    <b>Mês parcial:</b> ${m.mes_parcial ? rotMes(m.mes_parcial) + ' — ainda em andamento, não comparado como mês fechado' : '—'}<br>
    <b>Versão do painel:</b> ${esc(m.versao_painel || CFG.versao_painel || '')} · uso interno · dados não saem deste computador</div>`;
}
function iniciar(d) {
  DADOS = d; M = prepararModelo(d);
  rodape();
  if (!$('#abas').children.length) montarAbas();
  montarFiltros();
  for (const k of ['v', 'g', 'r', 'u', 'f']) F[k] = F[k].filter(v => M.opcoes[k].some(o => o.k === v));
  Object.keys(TAB).forEach(k => delete TAB[k]);
  L = filtrar(M.leads);
  ABAS.forEach(a => sujas.add(a.id));
  irPara(UI.aba);
  document.body.classList.remove('esqueleto');
}

/* Dica (tooltip) para elementos HTML com data-tip */
function dicas() {
  let tip = null;
  const mostrar = (alvo, x, y) => {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tooltip-html'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = alvo.dataset.tip; tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, x + 12) + 'px';
    tip.style.top = (y + 16 + r.height > window.innerHeight ? y - r.height - 10 : y + 16) + 'px';
  };
  document.addEventListener('mousemove', e => { const a = e.target.closest && e.target.closest('[data-tip]'); if (a) mostrar(a, e.clientX, e.clientY); else if (tip) tip.style.display = 'none'; });
  document.addEventListener('focusin', e => { const a = e.target.closest && e.target.closest('[data-tip]'); if (a) { const r = a.getBoundingClientRect(); mostrar(a, r.left, r.bottom - 8); } else if (tip) tip.style.display = 'none'; });
  document.addEventListener('scroll', () => { if (tip) tip.style.display = 'none'; }, true);
}

function eventosGerais() {
  $('#btn-imprimir').addEventListener('click', () => { sincronizarFiltros(); window.print(); });
  $('#btn-carregar').addEventListener('click', () => $('#arquivo-manual').click());
  $('#arquivo-manual').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    toast('Lendo planilhas no navegador…', 2500);
    try {
      const d = await ETL.deArquivos(files, CFG);
      iniciar(d);
      toast(`Planilhas carregadas: ${int(d.leads.length)} leads. Os dados ficam só nesta janela.`, 5000);
    } catch (err) { console.error(err); toast('Não foi possível ler as planilhas: ' + err.message, 8000); }
  });
  $('#leads-busca').addEventListener('input', e => { UI.busca = e.target.value; if (TAB.leads) TAB.leads.pag = 0; renderLeads(); });
  $('#leads-csv').addEventListener('click', exportarCSV);
  window.addEventListener('hashchange', () => { const antes = location.hash; lerHash(); if (M) { atualizar(); irPara(UI.aba); } if (location.hash !== antes) gravarHash(); });
  window.addEventListener('beforeprint', () => Object.values(GRAF).forEach(g => g.resize()));
}

/* ============================ Início ============================ */
aplicarCoresConfig();
aplicarTema('light', false); // painel sempre no tema claro (pedido do time)
lerHash();
dicas();
eventosGerais();
montarAbas();
requestAnimationFrame(() => {
  if (DADOS && DADOS.leads) iniciar(DADOS);
  else {
    document.body.classList.remove('esqueleto');
    $('#conteudo').innerHTML = `<div class="cartao" style="max-width:640px;margin:40px auto">${htmlVazio('Este painel ainda não tem dados. Rode o atualizar.bat ou use "Carregar planilhas" para ler os arquivos .xlsx.')}</div>`;
  }
});
})();
