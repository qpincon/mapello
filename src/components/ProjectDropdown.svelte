<script lang="ts">
    import { onMount } from 'svelte';
    import { Dropdown } from 'bootstrap';
    import type { GlobalState } from '../types';
    import { defaultState } from '../stateDefaults';

    interface CloudProject {
        id: string;
        name: string;
        createdAt: number;
        updatedAt: number;
    }

    interface Props {
        currentProjectName: string;
        currentProjectId: string | null;
        getProjectJson: () => string;
        applyState: (state: GlobalState) => Promise<void>;
    }

    let { currentProjectName = $bindable(), currentProjectId = $bindable(), getProjectJson, applyState }: Props = $props();

    let toggleEl: HTMLElement;
    let dropdown: Dropdown;
    let projects: CloudProject[] = $state([]);
    let loading = $state(false);
    let errorMsg = $state('');
    let renamingId = $state<string | null>(null);
    let renamingValue = $state('');
    let confirmDeleteId = $state<string | null>(null);
    let loadingProjectId = $state<string | null>(null);
    let newProjectMode = $state(false);
    let newProjectName = $state('');
    let creatingProject = $state(false);

    onMount(() => {
        dropdown = new Dropdown(toggleEl);
        toggleEl.addEventListener('show.bs.dropdown', fetchProjects);
    });

    async function fetchProjects() {
        loading = true;
        errorMsg = '';
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error();
            projects = await res.json();
        } catch {
            errorMsg = 'Could not load projects';
        } finally {
            loading = false;
        }
    }

    async function handleLoad(id: string) {
        loadingProjectId = id;
        errorMsg = '';
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error();
            const project = await res.json();
            const state: GlobalState = JSON.parse(project.projectJson);
            await applyState(state);
            currentProjectId = id;
            currentProjectName = project.name;
            dropdown.hide();
        } catch {
            errorMsg = 'Could not load project';
        } finally {
            loadingProjectId = null;
        }
    }

    async function handleRename(id: string) {
        if (!renamingValue.trim()) return;
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renamingValue.trim() }),
            });
            if (!res.ok) throw new Error();
            if (currentProjectId === id) currentProjectName = renamingValue.trim();
            renamingId = null;
            await fetchProjects();
        } catch {
            errorMsg = 'Could not rename project';
        }
    }

    async function handleDelete(id: string) {
        try {
            const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            if (currentProjectId === id) {
                currentProjectId = null;
                currentProjectName = 'Project 1';
            }
            confirmDeleteId = null;
            await fetchProjects();
        } catch {
            errorMsg = 'Could not delete project';
        }
    }

    function handleNewProject() {
        newProjectMode = true;
        renamingId = null;
        confirmDeleteId = null;
    }

    async function handleCreateNewProject() {
        if (!newProjectName.trim()) return;
        creatingProject = true;
        errorMsg = '';
        try {
            if (currentProjectId) {
                await fetch(`/api/projects/${currentProjectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_json: getProjectJson() }),
                });
            }
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName.trim(), project_json: JSON.stringify(defaultState) }),
            });
            if (!res.ok) throw new Error();
            const created = await res.json();
            await applyState(defaultState);
            currentProjectId = created.id;
            currentProjectName = created.name;
            newProjectName = '';
            newProjectMode = false;
            dropdown.hide();
        } catch {
            errorMsg = 'Could not create project';
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
            year: 'numeric', month: 'short', day: 'numeric',
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
        <li>
            {#if newProjectMode}
                <div class="d-flex gap-1 align-items-center px-2 py-1">
                    <input
                        class="form-control form-control-sm flex-grow-1"
                        type="text"
                        placeholder="Project name…"
                        bind:value={newProjectName}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleCreateNewProject();
                            if (e.key === 'Escape') { newProjectMode = false; newProjectName = ''; }
                        }}
                    />
                    <button class="btn btn-sm btn-primary" type="button"
                        onclick={handleCreateNewProject}
                        disabled={creatingProject || !newProjectName.trim()}>
                        {#if creatingProject}<span class="spinner-border spinner-border-sm"></span>{:else}Create{/if}
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" type="button"
                        onclick={() => { newProjectMode = false; newProjectName = ''; }}>✕</button>
                </div>
            {:else}
                <button class="dropdown-item" type="button" onclick={handleNewProject}>
                    + New project
                </button>
            {/if}
        </li>
        <li><hr class="dropdown-divider" /></li>

        {#if errorMsg}
            <li><span class="dropdown-item-text text-danger small">{errorMsg}</span></li>
        {/if}

        {#if loading}
            <li><span class="dropdown-item-text text-muted small">Loading…</span></li>
        {:else if projects.length === 0}
            <li><span class="dropdown-item-text text-muted small">No saved projects yet.</span></li>
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
                                    if (e.key === 'Enter') handleRename(project.id);
                                    if (e.key === 'Escape') renamingId = null;
                                }}
                            />
                            <button class="btn btn-sm btn-primary" type="button" onclick={() => handleRename(project.id)}>OK</button>
                            <button class="btn btn-sm btn-outline-secondary" type="button" onclick={() => (renamingId = null)}>✕</button>
                        </div>
                    {:else if confirmDeleteId === project.id}
                        <div class="d-flex gap-1 align-items-center w-100">
                            <span class="text-danger small flex-grow-1">Delete «{project.name}»?</span>
                            <button class="btn btn-sm btn-danger" type="button" onclick={() => handleDelete(project.id)}>Delete</button>
                            <button class="btn btn-sm btn-outline-secondary" type="button" onclick={() => (confirmDeleteId = null)}>✕</button>
                        </div>
                    {:else}
                        <div class="d-flex align-items-center gap-1 w-100">
                            <button
                                class="project-load-btn flex-grow-1 text-start"
                                class:fw-semibold={currentProjectId === project.id}
                                type="button"
                                onclick={() => handleLoad(project.id)}
                                disabled={loadingProjectId === project.id}
                                title={formatDate(project.updatedAt)}
                            >
                                {#if loadingProjectId === project.id}
                                    <span class="spinner-border spinner-border-sm me-1"></span>
                                {/if}
                                {project.name}
                            </button>
                            <button
                                class="btn btn-sm btn-link p-0 text-secondary"
                                type="button"
                                title="Rename"
                                onclick={() => startRename(project)}
                            >✏️</button>
                            <button
                                class="btn btn-sm btn-link p-0 text-danger"
                                type="button"
                                title="Delete"
                                onclick={() => { confirmDeleteId = project.id; renamingId = null; }}
                            >🗑️</button>
                        </div>
                    {/if}
                </li>
            {/each}
        {/if}

    </ul>
</div>

<style>
    .project-dropdown-toggle {
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .project-dropdown-menu {
        min-width: 280px;
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
</style>
