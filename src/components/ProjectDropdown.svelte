<script lang="ts">
    import { onMount } from "svelte";
    import { Dropdown } from "bootstrap";
    import type { GlobalState } from "../types";
    import { defaultState } from "../stateDefaults";
    import { saveProjectToServer } from "../util/save";
    import Icon from "./Icon.svelte";
    import { icons } from "../shared/icons";

    interface CloudProject {
        id: number;
        name: string;
        createdAt: number;
        updatedAt: number;
    }

    interface Props {
        currentProjectName: string;
        currentProjectId: number | null;
        getProjectJson: () => string;
        applyState: (state: GlobalState) => Promise<void>;
        onSaveError: (message: string) => void;
    }

    let {
        currentProjectName = $bindable(),
        currentProjectId = $bindable(),
        getProjectJson,
        applyState,
        onSaveError,
    }: Props = $props();

    let toggleEl: HTMLElement;
    let dropdown: Dropdown;
    let projects: CloudProject[] = $state([]);
    let loading = $state(false);
    let errorMsg = $state("");
    let editingCurrentName = $state(false);
    let currentNameInput = $state("");
    let renamingId = $state<number | null>(null);
    let renamingValue = $state("");
    let confirmDeleteId = $state<number | null>(null);
    let confirmReset = $state(false);
    let loadingProjectId = $state<number | null>(null);
    let creatingProject = $state(false);
    let showNewProjectInput = $state(false);
    let newProjectNameInput = $state("");

    const MAX_PROJECTS = 20;
    let totalProjectCount = $derived(projects.length + (currentProjectId ? 1 : 0));
    let atProjectLimit = $derived(totalProjectCount >= MAX_PROJECTS);

    onMount(() => {
        dropdown = new Dropdown(toggleEl);
        toggleEl.addEventListener("show.bs.dropdown", fetchProjects);
    });

    async function getServerErrorMessage(res: Response, fallback: string): Promise<string> {
        try {
            const data = await res.json();
            return data?.message || fallback;
        } catch {
            return fallback;
        }
    }

    async function saveCurrentProject() {
        if (!currentProjectId) return;
        const err = await saveProjectToServer(currentProjectId, getProjectJson());
        if (err) onSaveError(err);
    }

    async function fetchProjects() {
        loading = true;
        errorMsg = "";
        try {
            const res = await fetch("/api/projects");
            if (!res.ok) throw new Error();
            const all: CloudProject[] = await res.json();
            projects = all.filter((p) => p.id !== currentProjectId);
        } catch {
            errorMsg = "Could not load projects";
        } finally {
            loading = false;
        }
    }

    async function handleLoad(id: number) {
        loadingProjectId = id;
        errorMsg = "";
        try {
            await saveCurrentProject();
            const res = await fetch(`/api/projects/${id}`);
            const project = await res.json();
            const state: GlobalState = JSON.parse(project.projectJson);
            await applyState(state);
            currentProjectId = id;
            currentProjectName = project.name;
            dropdown.hide();
        } catch (e) {
            errorMsg = "Could not load project";
        } finally {
            loadingProjectId = null;
        }
    }

    async function handleRenameCurrentProject() {
        if (!currentNameInput.trim() || !currentProjectId) return;
        const newName = currentNameInput.trim();
        try {
            const res = await fetch(`/api/projects/${currentProjectId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            });
            if (!res.ok) throw new Error();
            currentProjectName = newName;
            editingCurrentName = false;
        } catch {
            errorMsg = "Could not rename project";
        }
    }

    async function handleRename(id: number) {
        if (!renamingValue.trim()) return;
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: renamingValue.trim() }),
            });
            if (!res.ok) throw new Error();
            renamingId = null;
            await fetchProjects();
        } catch {
            errorMsg = "Could not rename project";
        }
    }

    async function handleDelete(id: number) {
        try {
            const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            confirmDeleteId = null;
            await fetchProjects();
        } catch {
            errorMsg = "Could not delete project";
        }
    }

    function uniqueNewProjectName(): string {
        const taken = new Set([currentProjectName, ...projects.map((p) => p.name)]);
        if (!taken.has("Map")) return "Map";
        let i = 2;
        while (taken.has(`Map ${i}`)) i++;
        return `Map ${i}`;
    }

    async function handleCreateNewProject(name?: string) {
        const resolvedName = name?.trim() || uniqueNewProjectName();
        creatingProject = true;
        errorMsg = "";
        try {
            await saveCurrentProject();
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: resolvedName, project_json: getProjectJson() }),
            });
            if (!res.ok) {
                errorMsg = await getServerErrorMessage(res, "Could not create project");
                return;
            }
            const created = await res.json();
            currentProjectId = created.id;
            currentProjectName = created.name;
            showNewProjectInput = false;
            dropdown.hide();
        } catch {
            errorMsg = "Could not create project";
        } finally {
            creatingProject = false;
        }
    }

    function startRename(project: CloudProject) {
        renamingId = project.id;
        renamingValue = project.name;
        confirmDeleteId = null;
    }

    function formatDate(ts: number) {
        return new Date(ts).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
</script>

<div class="dropdown">
    <button
        bind:this={toggleEl}
        class="navbar-btn dropdown-toggle project-dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
    >
        {currentProjectName}
    </button>
    <ul class="dropdown-menu project-dropdown-menu" onclick={(e) => e.stopPropagation()}>
        <!-- Current project name (editable) -->
        <li class="px-2 py-1 border-bottom mb-1">
            {#if editingCurrentName}
                <div class="d-flex gap-1 align-items-center">
                    <input
                        class="form-control form-control-sm flex-grow-1"
                        type="text"
                        bind:value={currentNameInput}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleRenameCurrentProject();
                            if (e.key === "Escape") editingCurrentName = false;
                        }}
                    />
                    <button class="btn btn-sm btn-primary" type="button" onclick={handleRenameCurrentProject}>OK</button
                    >
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        type="button"
                        onclick={() => (editingCurrentName = false)}>✕</button
                    >
                </div>
            {:else if confirmReset}
                <div class="d-flex gap-1 align-items-center">
                    <span class="text-warning small flex-grow-1">Reset to default?</span>
                    <button
                        class="btn btn-sm btn-warning"
                        type="button"
                        onclick={async () => {
                            await applyState(defaultState);
                            confirmReset = false;
                            dropdown.hide();
                        }}>Reset</button
                    >
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        type="button"
                        onclick={() => (confirmReset = false)}>✕</button
                    >
                </div>
            {:else}
                <div class="d-flex align-items-center gap-1">
                    <span class="current-project-label fw-semibold flex-grow-1 text-truncate">{currentProjectName}</span
                    >
                    <div class="project-actions">
                        <button
                            class="icon-btn"
                            type="button"
                            title="Rename"
                            onclick={() => {
                                editingCurrentName = true;
                                confirmReset = false;
                                currentNameInput = currentProjectName;
                            }}><Icon svg={icons["pencil"]} width="0.85rem" height="0.85rem" marginRight="0" /></button
                        >
                        <button
                            class="icon-btn danger"
                            type="button"
                            title="Reset to default"
                            onclick={() => (confirmReset = true)}
                            ><Icon svg={icons["reset"]} width="0.85rem" height="0.85rem" marginRight="0" /></button
                        >
                    </div>
                </div>
            {/if}
        </li>

        {#if errorMsg}
            <li><span class="dropdown-item-text text-danger small">{errorMsg}</span></li>
        {/if}

        {#if loading}
            <li><span class="dropdown-item-text text-muted small">Loading…</span></li>
        {:else if projects.length === 0}
            <li><span class="dropdown-item-text text-muted small">No other projects.</span></li>
        {:else}
            {#each projects as project (project.id)}
                <li class="project-item px-2 py-1">
                    {#if renamingId === project.id}
                        <div class="d-flex gap-1 align-items-center w-100">
                            <input
                                class="form-control form-control-sm flex-grow-1"
                                type="text"
                                bind:value={renamingValue}
                                onclick={(e) => e.stopPropagation()}
                                onkeydown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === "Enter") handleRename(project.id);
                                    if (e.key === "Escape") renamingId = null;
                                }}
                            />
                            <button
                                class="btn btn-sm btn-primary"
                                type="button"
                                onclick={() => handleRename(project.id)}>OK</button
                            >
                            <button
                                class="btn btn-sm btn-outline-secondary"
                                type="button"
                                onclick={() => (renamingId = null)}>✕</button
                            >
                        </div>
                    {:else if confirmDeleteId === project.id}
                        <div class="d-flex gap-1 align-items-center w-100">
                            <span class="text-danger small flex-grow-1">Delete «{project.name}»?</span>
                            <button class="btn btn-sm btn-danger" type="button" onclick={() => handleDelete(project.id)}
                                >Delete</button
                            >
                            <button
                                class="btn btn-sm btn-outline-secondary"
                                type="button"
                                onclick={() => (confirmDeleteId = null)}>✕</button
                            >
                        </div>
                    {:else}
                        <div class="d-flex align-items-center gap-1 w-100">
                            <button
                                class="project-load-btn flex-grow-1 text-start"
                                type="button"
                                onclick={() => handleLoad(project.id)}
                                disabled={loadingProjectId !== null}
                                title={formatDate(project.updatedAt)}
                            >
                                {#if loadingProjectId === project.id}
                                    <span class="spinner-border spinner-border-sm me-1"></span>
                                {/if}
                                {project.name}
                            </button>
                            <div class="project-actions">
                                <button
                                    class="icon-btn"
                                    type="button"
                                    title="Rename"
                                    onclick={() => startRename(project)}
                                >
                                    <Icon svg={icons["pencil"]} width="0.85rem" height="0.85rem" marginRight="0" />
                                </button>
                                <button
                                    class="icon-btn danger"
                                    type="button"
                                    title="Delete"
                                    onclick={() => {
                                        confirmDeleteId = project.id;
                                        renamingId = null;
                                    }}
                                >
                                    <Icon svg={icons["trash"]} width="0.85rem" height="0.85rem" marginRight="0" />
                                </button>
                            </div>
                        </div>
                    {/if}
                </li>
            {/each}
        {/if}
        <li class="px-2 pt-1">
            {#if showNewProjectInput}
                <div class="d-flex gap-1 align-items-center">
                    <input
                        class="form-control form-control-sm flex-grow-1"
                        type="text"
                        placeholder={uniqueNewProjectName()}
                        bind:value={newProjectNameInput}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleCreateNewProject(newProjectNameInput);
                            if (e.key === "Escape") showNewProjectInput = false;
                        }}
                    />
                    <button
                        class="btn btn-sm btn-primary"
                        type="button"
                        onclick={() => handleCreateNewProject(newProjectNameInput)}
                        disabled={creatingProject}
                    >
                        {#if creatingProject}<span class="spinner-border spinner-border-sm me-1"></span>{/if}
                        OK
                    </button>
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        type="button"
                        onclick={() => (showNewProjectInput = false)}>✕</button
                    >
                </div>
            {:else if atProjectLimit}
                <span class="dropdown-item-text text-muted small">Maximum {MAX_PROJECTS} projects reached</span>
            {:else}
                <button
                    class="dropdown-item"
                    type="button"
                    onclick={() => {
                        newProjectNameInput = "";
                        showNewProjectInput = true;
                    }}
                >
                    + New project
                </button>
            {/if}
        </li>
    </ul>
</div>

<style>
    .project-dropdown-toggle {
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .project-dropdown-menu {
        min-width: 280px;
    }
    .current-project-label {
        font-size: 0.875rem;
        max-width: 200px;
    }
    .project-item {
        border-bottom: 1px solid #f0f0f0;
    }
    .project-item:last-of-type {
        border-bottom: none;
    }
    .project-load-btn {
        background: none;
        border: none;
        font-size: 0.875rem;
        color: #3a4a63;
        padding: 2px 4px;
        border-radius: 4px;
        cursor: pointer;
    }
    .project-load-btn:hover:not(:disabled) {
        background: #e8f0fe;
    }
    .project-load-btn:disabled {
        cursor: default;
        opacity: 0.7;
    }
    .project-actions {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
        width: 62px;
        justify-content: flex-end;
    }
    .icon-btn {
        background: none;
        border: none;
        padding: 2px;
        border-radius: 3px;
        cursor: pointer;
        color: #6c757d;
        display: flex;
        align-items: center;
    }
    .icon-btn:hover {
        background: #f0f0f0;
    }
    .icon-btn.danger {
        color: #dc3545;
    }
</style>
