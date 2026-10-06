#!/usr/bin/env python3
"""Extract reported colony measurements without executing source workbook content.

Python 3 standard library only. The optional --source points to an already
downloaded source workbook. Otherwise the exact publisher URL is downloaded.
No original workbook is written inside the public repository.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
from statistics import mean
import urllib.request
import zipfile
import xml.etree.ElementTree as ET


URL = ('https://media.springernature.com/original/springer-static/esm/'
       'art%3A10.1038%2Fs41586-025-09017-8/MediaObjects/'
       '41586_2025_9017_MOESM8_ESM.xlsx')
SHA256 = '21184a0df0f9d73e679be131fce889b31c2e751529ae223246c743e99943dd48'
ARTICLE = 'https://www.nature.com/articles/s41586-025-09017-8'
FIGURE = ARTICLE + '/figures/3'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
GUIDES = ['sgNT', 'sgHMGCR_1', 'sgHMGCR_2', 'sgFDFT1_1', 'sgFDFT1_2', 'sgSQLE_1', 'sgSQLE_2']
PANELS = {
    'Fig 3c': ('C2-Lung', ['CAPAN_2', 'HPAC', 'HPAF-II']),
    'Fig 3d': ('C1-Liver', ['MiaPaCa-2', 'KP4', 'Panc-1']),
}


def workbook_cells(payload):
    """Read only recorded cell values and names from OpenXML ZIP members."""
    result = {}
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        names = archive.namelist()
        shared = []
        if 'xl/sharedStrings.xml' in names:
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            shared = [''.join(t.text or '' for t in si.findall('.//s:t', NS))
                      for si in root.findall('s:si', NS)]
        rels = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        targets = {item.attrib['Id']: item.attrib['Target'] for item in rels}
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        for sheet in workbook.findall('s:sheets/s:sheet', NS):
            if sheet.attrib['name'] not in PANELS:
                continue
            path = targets[sheet.attrib[REL]]
            path = path.lstrip('/') if path.startswith('/') else 'xl/' + path
            root = ET.fromstring(archive.read(path))
            cells = {}
            for cell in root.findall('.//s:sheetData/s:row/s:c', NS):
                value = cell.find('s:v', NS)
                if cell.attrib.get('t') == 'inlineStr':
                    cells[cell.attrib['r']] = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                elif value is not None and value.text is not None:
                    cells[cell.attrib['r']] = (shared[int(value.text)]
                                               if cell.attrib.get('t') == 's' else value.text)
            result[sheet.attrib['name']] = cells
    return result


def extract(payload):
    digest = hashlib.sha256(payload).hexdigest()
    if digest != SHA256:
        raise ValueError(f'Source checksum changed: {digest}; inspect before using.')
    sheets = workbook_cells(payload)
    records = []
    for sheet_name, (group, models) in PANELS.items():
        cells = sheets[sheet_name]
        assert [cells[f'{column}6'] for column in 'BCDEFGH'] == GUIDES
        for i, model_source in enumerate(models):
            model = 'CAPAN-2' if model_source == 'CAPAN_2' else model_source
            for replicate in range(1, 4):
                row = 7 + 3 * i + replicate - 1
                assert cells[f'A{row}'] == f'{model_source}_{replicate}'
                for column, guide in zip('BCDEFGH', GUIDES):
                    cell = f'{column}{row}'
                    value = float(cells[cell])
                    assert value >= 0
                    target = 'non-targeting control' if guide == 'sgNT' else guide[2:].split('_')[0]
                    records.append({
                        'record_id': f'{sheet_name.replace(" ", "-")}-{cell}',
                        'panel': sheet_name, 'group': group, 'model': model,
                        'source_model_label': model_source,
                        'replicate_index_within_model': replicate,
                        'guide': guide, 'target': target,
                        'perturbation': 'non-targeting sgRNA' if guide == 'sgNT' else 'CRISPR-mediated knockout',
                        'reported_colony_number': value,
                        'source_cell': cell, 'source_row_label': cells[f'A{row}'],
                    })
    assert len(records) == 126
    assert len({r['record_id'] for r in records}) == 126
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data')
    args = parser.parse_args()
    if args.source:
        payload = args.source.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=45) as response:
            payload = response.read()
    records = extract(payload)
    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / 'colony_measurements.csv').open('w', newline='', encoding='utf-8') as output:
        writer = csv.DictWriter(output, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    manifest = {
        'publication': 'Rademaker et al., Nature 643, 1381-1390 (2025)',
        'title': 'PCSK9 drives sterol-dependent metastatic organ choice in pancreatic cancer',
        'doi': '10.1038/s41586-025-09017-8', 'article_url': ARTICLE,
        'figure_legend_url': FIGURE, 'source_url': URL, 'source_sha256': SHA256,
        'source_filename': '41586_2025_9017_MOESM8_ESM.xlsx',
        'accessed': '2026-10-06',
        'ownership': 'Publisher-hosted source data of Rushika M. Perera and coauthors; UCSF lab publication list confirms authorship.',
        'source_ranges': ['Fig 3c!A6:H15', 'Fig 3d!A6:H15'],
        'source_unit': 'Colony number, as described by source workbook and figure legend.',
        'unit_caution': 'Values are fractional, processed reported measurements, not individual raw integer colony counts. No additional normalization is asserted.',
        'design': 'Two organ-avid cell-model groups, three distinct models per group, three biological replicate entries per model and condition. The figure legend reports nine biological replicates per group.',
        'pairing': 'Replicate suffixes are retained for provenance only. Matched samples across guide conditions are not documented; no paired analysis or rowwise control ratio is warranted.',
        'excluded_data': 'Other workbook panels, published figure images, clinical records, original microscopy and raw assay files are not incorporated.',
        'license': 'The Nature page states exclusive publisher/licensor rights; no CC license was identified. This repository does not redistribute the original workbook, article, or figure artwork. It provides newly organized factual measurements and original analysis with attribution. Source rights remain with their owners.',
        'github_search': {
            'result': 'No verified target-owned research repository located in the bounded search.',
            'official_pages_checked': ['https://www.rushikapereralab.com/', 'https://www.rushikapereralab.com/about',
                                       'https://www.rushikapereralab.com/publications',
                                       'https://www.rushikapereralab.com/new-page'],
            'publication_checked': ARTICLE + '#data-availability',
            'queries': ['site:github.com "Rushika" "Perera"', 'site:github.com "Rademaker" "PCSK9"',
                        'site:github.com "PereraLab" lysosome', 'GitHub API repositories: PCSK9 Perera',
                        'GitHub API repositories: Perera lysosome', 'GitHub API users: Rushika Perera'],
            'caution': 'Namesake virology research and unverified accounts were not attributed to this UCSF lab.',
        },
        'transformations': ['Verify source SHA-256.', 'Read only OpenXML cell values.',
                            'Select the two named sheets and explicit A6:H15 ranges.',
                            'Map source CAPAN_2 to display CAPAN-2; preserve original label.',
                            'Retain all 126 nonnegative values, model IDs, source cells and replicate suffixes.',
                            'No exclusions, imputations, pooled-model inference, or paired normalization.'],
    }
    (args.output / 'source_manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    models = []
    for name in dict.fromkeys(r['model'] for r in records):
        selected = [r for r in records if r['model'] == name]
        values = {guide: [r['reported_colony_number'] for r in selected if r['guide'] == guide]
                  for guide in GUIDES}
        models.append({
            'name': name, 'group': selected[0]['group'], 'control': values['sgNT'],
            'genes': {gene: [values[f'sg{gene}_1'], values[f'sg{gene}_2']]
                      for gene in ['HMGCR', 'FDFT1', 'SQLE']},
        })
    data = {'models': models, 'source': manifest,
            'coverage': {'reported_measurements': 126, 'cell_models': 6,
                         'guides_including_control': 7,
                         'biological_replicates_per_model_condition': 3, 'groups': 2}}
    (args.output / 'data.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    reference = []
    for model in models:
        for gene, guides in model['genes'].items():
            control = model['control']
            scenarios = [{'omitted': 'none', 'effects': [100 * (1 - mean(g) / mean(control)) for g in guides]}]
            groups = [control, *guides]
            for group_idx, group in enumerate(groups):
                for value_idx in range(len(group)):
                    altered = [list(g) for g in groups]
                    altered[group_idx].pop(value_idx)
                    effects = [100 * (1 - mean(g) / mean(altered[0])) for g in altered[1:]]
                    scenarios.append({'omitted': f'{["sgNT", gene+"_1", gene+"_2"][group_idx]} observation {value_idx+1}',
                                      'effects': effects})
            assert len(scenarios) == 10
            all_data = min(scenarios[0]['effects'])
            worst = min(min(s['effects']) for s in scenarios)
            reference.append({
                'model': model['name'], 'group': model['group'], 'gene': gene,
                'control_mean': mean(control), 'guide_means': [mean(g) for g in guides],
                'guide_effects': scenarios[0]['effects'],
                'all_data_minimum_reduction_pct': all_data,
                'conservative_reduction_pct': worst,
                'default_threshold_pct': 30,
                'default_classification': 'shortlist' if worst >= 30 else 'sensitivity review' if all_data >= 30 else 'below threshold',
                'scenarios': scenarios,
            })
    (args.output / 'analysis_reference.json').write_text(json.dumps(reference, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(data['coverage']))
    print(json.dumps([{k: r[k] for k in ['model', 'gene', 'conservative_reduction_pct', 'default_classification']} for r in reference], indent=2))


if __name__ == '__main__':
    main()
