(function () {
  'use strict';
  const data = window.UNIVERSITY_LAB_DEMO_DATA;
  const {mean, analyze} = window.PereraAnalysis;
  const $ = id => document.getElementById(id);
  const fmt = x => x.toFixed(1);
  const pct = x => fmt(x) + '%';
  if (!data || !data.models) { $('readout').textContent = 'Source data failed to load. Reload the page or download the source CSV below.'; return; }
  let selected = 'CAPAN-2';
  let gene = 'SQLE';
  let results = [];
  const svgEl = (tag, attrs, text) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
    if (text !== undefined) e.textContent = text;
    return e;
  };
  data.models.forEach(m => { const o=document.createElement('option'); o.value=m.name; o.textContent=`${m.name} · ${m.group}`; $('model').appendChild(o); });
  [['CAPAN-2','SQLE'],['MiaPaCa-2','SQLE'],['MiaPaCa-2','HMGCR']].forEach(([m,g]) => {
    const b=document.createElement('button'); b.type='button'; b.textContent=`${m} / ${g}`; b.onclick=()=>select(m,g); $('suggestions').appendChild(b);
  });
  function select(m,g,scroll=false) {
    selected=m; gene=g; $('model').value=m; $('gene').value=g; render();
    if(scroll) $('a1').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  function draw(model, result) {
    const svg=$('hero-viz'); svg.replaceChildren();
    const width=Math.min(600,Math.max(300,svg.clientWidth));
    svg.setAttribute('viewBox',`0 0 ${width} 310`);
    const arrays=[model.control,...model.genes[gene]];
    const labels=['sgNT',`sg${gene}_1`,`sg${gene}_2`];
    const colors=['#777','#1f7a8c','#1f7a8c'];
    const ymax=Math.ceil(Math.max(...arrays.flat())/20)*20;
    const y=v=>245-v/ymax*200;
    svg.setAttribute('aria-label',`${model.name}, ${gene}. Individual reported colony measurements and group means. Guide reductions ${pct(result.effects[0])} and ${pct(result.effects[1])}.`);
    svg.appendChild(svgEl('text',{x:48,y:18,'font-size':12,fill:'#666'},'Reported colony number'));
    for(let i=0;i<=4;i++) { const v=ymax*i/4; svg.appendChild(svgEl('line',{x1:48,y1:y(v),x2:width-15,y2:y(v),stroke:'#e6e6e6'})); svg.appendChild(svgEl('text',{x:40,y:y(v)+4,'font-size':12,'text-anchor':'end',fill:'#666'},Number(v.toFixed(1)))); }
    arrays.forEach((a,k)=> {
      const x=48+(k+.5)*(width-63)/3;
      a.forEach((v,i)=> { const c=svgEl('circle',{cx:x+(i-1)*12,cy:y(v),r:5,fill:colors[k],opacity:.8}); c.appendChild(svgEl('title',{},`${labels[k]} observation ${i+1}: ${v}`)); svg.appendChild(c); });
      svg.appendChild(svgEl('line',{x1:x-32,x2:x+32,y1:y(mean(a)),y2:y(mean(a)),stroke:'#1a1a1a','stroke-width':2}));
      svg.appendChild(svgEl('text',{x,y:271,'font-size':13,'text-anchor':'middle',fill:'#333'},labels[k]));
      svg.appendChild(svgEl('text',{x,y:293,'font-size':12,'text-anchor':'middle',fill:'#666'},k===0?`mean ${fmt(mean(a))}`:`${pct(result.effects[k-1])}${width<400?'':' reduction'}`));
    });
    const body=$('raw-table').querySelector('tbody'); body.replaceChildren();
    arrays.forEach((a,k)=> {const tr=document.createElement('tr'); [labels[k],a.map(v=>v.toFixed(3)).join(' · '),mean(a).toFixed(3)].forEach(v=> {const td=document.createElement('td');td.textContent=v;tr.appendChild(td);});body.appendChild(tr);});
  }
  function render() {
    const threshold=Number($('threshold').value);
    $('threshold-value').textContent=threshold+'%';
    const m=data.models.find(x=>x.name===selected), r=analyze(m.control,m.genes[gene],threshold);
    draw(m,r);
    $('metric-one').textContent=pct(r.conservative);
    $('metric-two').textContent=pct(r.worst);
    $('metric-three').textContent=fmt(r.gap)+' pp';
    $('readout').textContent=`${m.name} · ${m.group} · ${gene}: ${r.status.toLowerCase()} at a ${threshold}% cutoff. The two signed guide reductions are ${pct(r.effects[0])} and ${pct(r.effects[1])}; a negative value means an increase. The smaller reduction falls to ${pct(r.worst)} in the most conservative scenario (${r.omitted === 'none' ? 'full dataset' : 'omit ' + r.omitted}). Omission is a stress test, not a recommendation to discard that measurement.`;
    results=data.models.flatMap(model=>Object.entries(model.genes).map(([target,guides])=>({model:model.name,group:model.group,gene:target,...analyze(model.control,guides,threshold)})))
      .filter(x=>$('group').value==='all'||x.group===$('group').value)
      .sort((a,b)=>b.worst-a.worst||a.model.localeCompare(b.model)||a.gene.localeCompare(b.gene));
    const counts=Object.fromEntries(['Shortlist','Sensitivity review','Below threshold'].map(s=>[s,results.filter(x=>x.status===s).length]));
    $('shortlist-summary').textContent=`${results.length} comparisons · ${counts.Shortlist} shortlisted · ${counts['Sensitivity review']} need sensitivity review · ${counts['Below threshold']} below threshold. Ordered by the most conservative two-guide reduction, not by statistical significance.`;
    const body=$('comparison').querySelector('tbody');body.replaceChildren();
    results.forEach(x=>{
      const tr=document.createElement('tr'); if(x.model===selected&&x.gene===gene)tr.className='selected-row';
      const td=document.createElement('td'),b=document.createElement('button'),s=document.createElement('small');
      b.type='button'; b.textContent=`${x.model} / ${x.gene}`;b.onclick=()=>select(x.model,x.gene,true); s.textContent=x.group; td.append(b,s);tr.appendChild(td);
      [pct(x.conservative),pct(x.worst),x.status].forEach((v,i)=>{const c=document.createElement('td');c.textContent=v;if(i===2)c.className=x.status.toLowerCase().replaceAll(' ','-');tr.appendChild(c);});body.appendChild(tr);
    });
    const selectedDataAll=results.some(x=>x.model===selected&&x.gene===gene);
    const targetContext=`Selected comparison: ${selected} / ${gene}${selectedDataAll?'':' (outside the current table filter)'}. `;
    const opposite=data.models.filter(x=>x.group!==m.group).map(x=>({model:x.name,...analyze(x.control,x.genes[gene],threshold)})).sort((a,b)=>a.conservative-b.conservative)[0];
    const action=r.status==='Shortlist'
      ? `It remains above the chosen cutoff in every single-observation check. A reasonable next step is a new independent replication, retaining ${opposite.model} / ${gene} as a cross-group comparator (${pct(opposite.conservative)} smaller-guide reduction in the published data). It is the least responsive opposite-group model by this rule, not necessarily a low-response control. This comparison is descriptive, not proof of a group difference.`
      :r.status==='Sensitivity review'
        ? `Do not select it on the full-data mean alone. Replicate before deciding: the smaller-guide effect is ${pct(r.conservative)}, but the omission check reaches ${pct(r.worst)}. Review ${r.omitted} against original assay records; do not delete it based on this analysis.`
        : `It does not meet the selected effect-size rule. Keep it as a potential low-response comparison, subject to growth-rate and editing-efficiency checks, rather than calling it biologically insensitive.`;
    $('next-experiment').textContent=targetContext+action+(gene==='HMGCR'?' HMGCR also supplies non-sterol mevalonate products, so this effect cannot be labeled cholesterol-specific.':'');
  }
  $('model').addEventListener('change',()=>select($('model').value,gene));
  $('gene').addEventListener('change',()=>select(selected,$('gene').value));
  $('threshold').addEventListener('input',render);$('group').addEventListener('change',render);
  window.addEventListener('resize',render);
  $('export').addEventListener('click',()=>{
    const escape=v=>'"'+String(v).replaceAll('"','""')+'"';
    const head=['model','published_group','target','guide_1_reduction_pct','guide_2_reduction_pct','smaller_guide_reduction_pct','worst_single_omission_reduction_pct','most_sensitive_omission','analyst_threshold_pct','status','source_doi','source_sha256'];
    const rows=results.map(r=>[r.model,r.group,r.gene,...r.effects,r.conservative,r.worst,r.omitted,$('threshold').value,r.status,data.source.doi,data.source.source_sha256]);
    const content=[head,...rows].map(r=>r.map(escape).join(',')).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`perera-review-${$('group').value}-${$('threshold').value}pct.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('export-status').textContent=`Exported ${results.length} comparisons at the ${$('threshold').value}% descriptive cutoff. Full source observations remain unchanged.`;
  });
  select(selected,gene);
}());
