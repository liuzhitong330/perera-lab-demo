(function (root) {
  'use strict';
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  function analyze(control, guides, threshold = 30) {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error('Invalid threshold');
    if (control.length < 3 || guides.length !== 2 || guides.some(a => a.length < 3) || [...control, ...guides.flat()].some(x => !Number.isFinite(x) || x < 0) || mean(control) <= 0) throw new Error('Invalid measurements');
    const effects = guides.map(g => 100 * (1 - mean(g) / mean(control)));
    const conservative = Math.min(...effects);
    const scenarios = [{omitted:'none', effect:conservative}];
    [control, ...guides].forEach((a, k) => a.forEach((_, i) => {
      const arrays = [control, ...guides].map((v, j) => j === k ? v.filter((_, n) => n !== i) : v);
      const ref = mean(arrays[0]);
      if (ref <= 0) throw new Error('Nonpositive control mean under omission');
      scenarios.push({omitted:`${k === 0 ? 'sgNT' : 'guide ' + k} observation ${i + 1}`, effect:Math.min(...arrays.slice(1).map(g => 100 * (1 - mean(g) / ref)))});
    }));
    const worst = scenarios.reduce((a,b) => b.effect < a.effect ? b : a);
    const status = worst.effect >= threshold ? 'Shortlist' : conservative >= threshold ? 'Sensitivity review' : 'Below threshold';
    return {effects, conservative, worst:worst.effect, omitted:worst.omitted, gap:Math.abs(effects[0]-effects[1]), scenarios, status};
  }
  const api = {mean, analyze};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PereraAnalysis = api;
}(typeof window !== 'undefined' ? window : this));
