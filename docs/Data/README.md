# Medical validation datasets

Place the following Excel files in this folder (relative to project root):

- `CPT Codes.xlsx`
- `ICD Codes.xlsx`
- `Snomed Data 1.xlsx`
- `Snowmed Data 2.xlsx`

If files are missing, the E2E test seeds minimal sample SNOMED/ICD files so the framework can run locally.

Audio files for session upload: add `.mp3` (or `.wav`, `.m4a`) under `testdata/audio/`.  
One file is chosen **at random** when each session is created.

Reports are written to **`testResults/`** — open `testResults/index.html` to browse runs.
