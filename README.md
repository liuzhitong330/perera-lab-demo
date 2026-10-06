# Choosing a sterol-pathway follow-up in PDAC

A small exploratory research tool inspired by Rushika M. Perera's UCSF lab. It helps inspect model identity, biological replicate variation and agreement between two gene-targeting guides before choosing a follow-up experiment. This is an independent application project, not a lab-endorsed tool or a validated biological prediction.

## Data and scope

The source is Rademaker et al., **PCSK9 drives sterol-dependent metastatic organ choice in pancreatic cancer**, *Nature* 643, 1381-1390 (2025), [doi:10.1038/s41586-025-09017-8](https://www.nature.com/articles/s41586-025-09017-8). Only the [Figure 3 source-data workbook](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41586-025-09017-8/MediaObjects/41586_2025_9017_MOESM8_ESM.xlsx), sheets `Fig 3c` and `Fig 3d`, is analyzed. The [figure legend](https://www.nature.com/articles/s41586-025-09017-8/figures/3) describes CRISPR-mediated knockout and colony-number measurements.

- Six cell models: CAPAN-2, HPAC and HPAF-II in C2-Lung; MiaPaCa-2, KP4 and Panc-1 in C1-Liver.
- Three biological replicate entries for each model and condition.
- Non-targeting sgRNA control plus two guides each for HMGCR, FDFT1 and SQLE.
- 126 reported measurements, not 126 independent cell models.

The workbook describes the units as colony number. Its fractional values are retained as **processed reported measurements**, not relabeled as raw integer counts. No source normalization beyond what is documented is assumed. Replicate suffixes do not establish matching across conditions. Calculations therefore use condition means, never rowwise paired ratios. Source-cell addresses are retained in `data/colony_measurements.csv`.

## Reproduce

Python 3 and Node.js are sufficient; no third-party packages, API keys or installation are needed. Run from the repository root:

```sh
python3 scripts/extract_source.py
python3 scripts/build_browser_data.py
node scripts/test_analysis.cjs
python3 -m http.server 8000
```

Open `http://localhost:8000` after the checks pass. The extraction command downloads the publisher workbook in memory and verifies its pinned SHA-256 before parsing. It does not run macros or workbook formulas. It stops if the source changes, rather than silently adopting a different version.

For an already downloaded original workbook:

```sh
python3 scripts/extract_source.py --source source.xlsx
python3 scripts/build_browser_data.py
node scripts/test_analysis.cjs
```

The extraction generates the tidy CSV, `data/data.json`, provenance manifest and Python reference calculations. The browser-data command packages the same JSON as `data.js`. Tests compare JavaScript with all 18 model-gene references, both guide effects and every omission scenario to a tolerance of `1e-9`. They also check source coverage, threshold boundaries, invalid inputs and browser-data parity.

## Interpretation

For each guide, reduction is `100 × (1 − guide mean / control mean)`. Both guides must meet the selected minimum reduction. The all-data value is the weaker guide's reduction.

A descriptive stress test omits one observation at a time from the control or either guide: nine omission scenarios, plus the all-data scenario. The most conservative reduction across these ten scenarios determines whether the model-gene combination stays on the shortlist. A case that meets the threshold only with all observations is marked for sensitivity review. The threshold is a user-selected planning rule, not a published biological cutoff.

This does not calculate statistical significance, a confidence interval, off-target specificity, knockout efficiency or experimental reproducibility. It does not pool different cell models as interchangeable replicates. A shortlist is a prompt for checking controls and planning an independently replicated experiment, not proof of a therapeutic target. The source lacks batch, plate, operator and assay-image metadata needed for a full experimental QC review. No measurement is automatically removed as an outlier.

For example, MiaPaCa-2/HMGCR has an all-data weaker-guide reduction of approximately 55.64%, versus 47.48% in the most conservative omission scenario. A 50% planning threshold therefore changes the next action to sensitivity review. This is a newly calculated descriptive result, not a claim made by the paper.

## Reuse and provenance

The input schema groups a named model and biological context with its control values and two guide-value arrays per gene. A future dataset would additionally need explicit biological replicate IDs, batch and plate identifiers, verified perturbation identity and relevant experimental controls before cross-batch interpretation. The current extractor deliberately accepts only the checked publication layout and checksum.

`data/source_manifest.json` records the source URL, checksum, exact cells, transformations, ownership checks and limitations. Official lab pages, publication availability statements and bounded GitHub searches did not identify a verified target-owned research repository. No namesake research was attributed to this UCSF lab, and no laboratory GitHub code was claimed to have been executed.

The publisher states exclusive rights to the article; no Creative Commons license was identified for the source. The original workbook, article text and figure artwork are **not redistributed here**. This repository contains newly organized factual measurements and original analytical code with source attribution. Rights to the source publication remain with their owners; any code license in this repository does not relicense third-party material.

Prepared by Cathy Liu with AI assistance. The analysis is intended to communicate research reasoning and careful interpretation of experimental data. It is not evidence that Cathy performed the paper's CRISPR experiments or independently authored every implementation detail.
