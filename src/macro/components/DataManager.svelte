<script lang="ts">
    import { untrack } from "svelte";
    import type { ZoneDataRow } from "src/types";
    import { download, getColumns } from "src/util/common";
    import { csvToObjects } from "src/util/csv";
    import Modal from "src/components/Modal.svelte";

    interface Props {
        data: ZoneDataRow[];
        geoNames: string[];
        onSave: (data: ZoneDataRow[]) => void;
        open: boolean;
        onClose: () => void;
        layerName: string;
    }

    let { data, geoNames, onSave, open = $bindable(), onClose, layerName }: Props = $props();

    let workingData: ZoneDataRow[] = $state([]);
    let columns: string[] = $state([]);
    let errors: string[] = $state([]);
    let warnings: string[] = $state([]);
    let newColumnName = $state("");
    let exportMenuOpen = $state(false);
    let importDialogMessage: string | null = $state(null);

    // Clone data when modal opens
    $effect(() => {
        if (open) {
            untrack(() => {
                workingData = data.map((row) => ({ ...row }));
                columns = getColumns(workingData);
                validateAndWarn();
                newColumnName = "";
                exportMenuOpen = false;
                importDialogMessage = null;
            });
        }
    });

    function rowHasMissingData(row: ZoneDataRow): boolean {
        return columns.some((col) => {
            if (col === "name") return false;
            const val = row[col];
            return val === "" || val === undefined || val === null;
        });
    }

    function validateAndWarn(): void {
        const errs: string[] = [];
        const warns: string[] = [];
        const cols = columns.filter((c) => c !== "name");
        for (const col of cols) {
            let hasNumeric = false;
            let hasString = false;
            let emptyCount = 0;
            for (const row of workingData) {
                const val = row[col];
                if (val === "" || val === undefined || val === null) {
                    emptyCount++;
                    continue;
                }
                if (typeof val === "number") hasNumeric = true;
                else hasString = true;
            }
            if (hasNumeric && hasString) {
                errs.push(`Column '${col}' has mixed types`);
            }
            if (emptyCount > 0) {
                warns.push(`Column '${col}': ${emptyCount} empty cell(s)`);
            }
        }
        errors = errs;
        warnings = warns;
    }

    function updateCell(rowIndex: number, col: string, value: string): void {
        const num = Number(value);
        workingData[rowIndex][col] = value !== "" && !isNaN(num) ? num : value;
        validateAndWarn();
    }

    function addColumn(): void {
        const name = newColumnName.trim();
        if (!name || columns.includes(name)) return;
        for (const row of workingData) {
            row[name] = "";
        }
        columns = [...columns, name];
        newColumnName = "";
        validateAndWarn();
    }

    function removeColumn(col: string): void {
        if (col === "name") return;
        for (const row of workingData) {
            delete row[col];
        }
        columns = columns.filter((c) => c !== col);
        validateAndWarn();
    }

    // --- Import: split into loadFile + reconcileWithGeo ---

    async function loadFile(file: File): Promise<Record<string, string | number>[]> {
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "json") {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                throw new Error("JSON must be an array of objects.");
            }
            return parsed;
        }

        if (ext === "csv") {
            const text = await file.text();
            return csvToObjects(text);
        }

        if (ext === "xlsx" || ext === "xls") {
            const XLSX = await import("xlsx");
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
            return raw.map((row) => {
                const obj: Record<string, string | number> = {};
                for (const [key, val] of Object.entries(row)) {
                    if (typeof val === "number") {
                        obj[key] = val;
                    } else {
                        const str = String(val).trim();
                        const num = Number(str);
                        obj[key] = str !== "" && !isNaN(num) ? num : str;
                    }
                }
                return obj;
            });
        }

        throw new Error("Unsupported file format. Use .csv, .xlsx, .xls, or .json.");
    }

    function reconcileWithGeo(parsed: Record<string, string | number>[]): void {
        if (!parsed.length || !("name" in parsed[0])) {
            errors = ["Imported data must have a 'name' column."];
            return;
        }

        const geoNamesSet = new Set(geoNames);
        const importedNames = new Set(parsed.map((r) => String(r.name)));

        const badNames = parsed
            .map((r) => String(r.name))
            .filter((n) => !geoNamesSet.has(n));
        const missingNames = geoNames.filter((n) => !importedNames.has(n));

        // Filter out unknown names
        let filtered = parsed.filter((r) => geoNamesSet.has(String(r.name)));

        // Get user columns (everything except name)
        const userCols = getColumns(parsed).filter((c) => c !== "name");

        // Add empty rows for missing geo names
        for (const name of missingNames) {
            const emptyRow: Record<string, string | number> = { name };
            for (const col of userCols) {
                emptyRow[col] = "";
            }
            filtered.push(emptyRow as ZoneDataRow);
        }

        workingData = filtered as ZoneDataRow[];
        columns = getColumns(workingData);
        validateAndWarn();

        // Build dialog message for removed/added names
        const msgs: string[] = [];
        if (badNames.length) {
            msgs.push(`Removed ${badNames.length} unknown name(s): ${badNames.join(", ")}`);
        }
        if (missingNames.length) {
            msgs.push(`Added ${missingNames.length} empty row(s) for missing names: ${missingNames.join(", ")}`);
        }
        if (msgs.length) {
            importDialogMessage = msgs.join("\n\n");
        }
    }

    async function handleImport(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const parsed = await loadFile(file);
            reconcileWithGeo(parsed);
        } catch (err) {
            errors = [...errors, (err as Error).message];
        }
        input.value = "";
    }

    // --- Export ---

    function exportData(format: "csv" | "xlsx" | "json"): void {
        exportMenuOpen = false;
        if (format === "json") {
            download(JSON.stringify(workingData, null, "\t"), "text/json", "data.json");
        } else if (format === "csv") {
            const cols = getColumns(workingData);
            const header = cols.map(escapeCsvField).join(",");
            const rows = workingData.map((row) =>
                cols.map((col) => escapeCsvField(String(row[col] ?? ""))).join(","),
            );
            download([header, ...rows].join("\n"), "text/csv", "data.csv");
        } else if (format === "xlsx") {
            exportXlsx();
        }
    }

    function escapeCsvField(field: string): string {
        if (field.includes(",") || field.includes('"') || field.includes("\n")) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }

    async function exportXlsx(): Promise<void> {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(workingData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, "data.xlsx");
    }

    function handleSave(): void {
        onSave(workingData);
        open = false;
        onClose();
    }

    function handleCancel(): void {
        open = false;
        onClose();
    }
</script>

<Modal {open} onClosed={handleCancel} modalWidth="90%">
    <h5 slot="header">Data Manager - {layerName}</h5>
    <div slot="content">
        <!-- Toolbar -->
        <div class="d-flex gap-2 mb-3 align-items-center flex-wrap position-relative">
            <label class="btn btn-outline-primary btn-sm mb-0">
                Import
                <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onchange={handleImport}
                    class="d-none"
                />
            </label>

            <div class="dropdown">
                <button
                    class="btn btn-outline-primary btn-sm dropdown-toggle"
                    type="button"
                    onclick={() => (exportMenuOpen = !exportMenuOpen)}
                >
                    Export
                </button>
                {#if exportMenuOpen}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="export-backdrop" onclick={() => (exportMenuOpen = false)} onkeydown={() => {}}></div>
                    <ul class="dropdown-menu show" style="z-index: 1060;">
                        <li><button class="dropdown-item" onclick={() => exportData("csv")}>CSV</button></li>
                        <li><button class="dropdown-item" onclick={() => exportData("xlsx")}>Excel (.xlsx)</button></li>
                        <li><button class="dropdown-item" onclick={() => exportData("json")}>JSON</button></li>
                    </ul>
                {/if}
            </div>

            <div class="vr"></div>

            <div class="d-flex gap-1 align-items-center">
                <input
                    type="text"
                    class="form-control form-control-sm"
                    placeholder="New column name"
                    bind:value={newColumnName}
                    onkeydown={(e) => e.key === "Enter" && addColumn()}
                    style="width: 150px;"
                />
                <button class="btn btn-outline-secondary btn-sm" onclick={addColumn}>Add column</button>
            </div>

            <div class="ms-auto text-muted small">
                {workingData.length} rows, {columns.length} columns
            </div>
        </div>

        <!-- Data table -->
        <div class="table-wrapper">
            <table class="table table-sm table-bordered mb-0">
                <thead class="table-light sticky-top">
                    <tr>
                        {#each columns as col}
                            <th>
                                <div class="d-flex align-items-center gap-1">
                                    <span class="text-truncate">{col}</span>
                                    {#if col !== "name"}
                                        <button
                                            class="btn btn-link btn-sm text-danger p-0 ms-auto remove-col"
                                            title="Remove column"
                                            onclick={() => removeColumn(col)}
                                        >
                                            &times;
                                        </button>
                                    {/if}
                                </div>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each workingData as row, rowIndex}
                        <tr class:table-warning={rowHasMissingData(row)}>
                            {#each columns as col}
                                <td>
                                    {#if col === "name"}
                                        <span class="text-truncate d-block">{row[col]}</span>
                                    {:else}
                                        <input
                                            type="text"
                                            class="form-control form-control-sm cell-input"
                                            class:border-warning={row[col] === "" || row[col] === undefined || row[col] === null}
                                            value={row[col] ?? ""}
                                            onchange={(e) => updateCell(rowIndex, col, (e.target as HTMLInputElement).value)}
                                        />
                                    {/if}
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <!-- Errors and warnings below the table -->
        {#if errors.length}
            <div class="alert alert-danger py-2 mt-2 mb-0 small">
                <strong>Errors</strong>
                {#each errors as err}
                    <div>{err}</div>
                {/each}
            </div>
        {/if}
        {#if warnings.length}
            <div class="alert alert-warning py-2 mt-2 mb-0 small">
                <strong>Warnings</strong> &mdash; {warnings.length} column(s) have empty cells
                <details>
                    <summary class="text-muted">Details</summary>
                    {#each warnings as warn}
                        <div>{warn}</div>
                    {/each}
                </details>
            </div>
        {/if}
    </div>
    <div slot="footer" class="d-flex gap-2">
        <button class="btn btn-secondary" onclick={handleCancel}>Cancel</button>
        <button class="btn btn-primary" disabled={errors.length > 0} onclick={handleSave}>Save</button>
    </div>
</Modal>

<!-- Import reconciliation dialog -->
{#if importDialogMessage}
    <Modal open={!!importDialogMessage} onClosed={() => (importDialogMessage = null)} modalWidth="40%">
        <h6 slot="header">Import adjustments</h6>
        <div slot="content">
            {#each importDialogMessage.split("\n\n") as msg}
                <p>{msg}</p>
            {/each}
        </div>
        <div slot="footer">
            <button class="btn btn-primary btn-sm" onclick={() => (importDialogMessage = null)}>OK</button>
        </div>
    </Modal>
{/if}

<style lang="scss" scoped>
    .table-wrapper {
        max-height: 60vh;
        overflow: auto;
        border: 1px solid #dee2e6;
        border-radius: 4px;
    }

    .cell-input {
        padding: 2px 6px;
        font-size: 0.8rem;
        border: 1px solid transparent;
        background: transparent;
        width: 100%;
        min-width: 60px;

        &:hover {
            border-color: #dee2e6;
        }

        &:focus {
            border-color: #86b7fe;
            background: white;
        }
    }

    .border-warning {
        border-color: var(--bs-warning) !important;
    }

    .remove-col {
        font-size: 1rem;
        line-height: 1;
        text-decoration: none;
    }

    th {
        white-space: nowrap;
        min-width: 80px;
    }

    td {
        padding: 2px 4px !important;
    }

    .export-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1050;
    }

    .dropdown-menu {
        position: absolute;
    }
</style>
