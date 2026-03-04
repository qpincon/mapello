<script lang="ts">
    import Modal from './Modal.svelte';
    import type { GlobalState } from '../types';

    interface CloudProject {
        id: string;
        name: string;
        createdAt: number;
        updatedAt: number;
    }

    interface Props {
        open: boolean;
        getProjectJson: () => string;
        applyState: (state: GlobalState) => Promise<void>;
    }

    let { open = $bindable(), getProjectJson, applyState }: Props = $props();

    let projects: CloudProject[] = $state([]);
    let loading = $state(false);
    let saving = $state(false);
    let newProjectName = $state('');
    let errorMsg = $state('');
    let renamingId = $state<string | null>(null);
    let renamingValue = $state('');
    let confirmDeleteId = $state<string | null>(null);
    let loadingProjectId = $state<string | null>(null);

    $effect(() => {
        if (open) fetchProjects();
    });

    function close() {
        open = false;
    }

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

    async function saveCurrentProject() {
        if (!newProjectName.trim()) return;
        saving = true;
        errorMsg = '';
        try {
            const project_json = getProjectJson();
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName.trim(), project_json }),
            });
            if (!res.ok) throw new Error();
            newProjectName = '';
            await fetchProjects();
        } catch {
            errorMsg = 'Could not save project';
        } finally {
            saving = false;
        }
    }

    async function overwriteProject(id: string) {
        saving = true;
        errorMsg = '';
        try {
            const project_json = getProjectJson();
            const res = await fetch(`/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_json }),
            });
            if (!res.ok) throw new Error();
            await fetchProjects();
        } catch {
            errorMsg = 'Could not overwrite project';
        } finally {
            saving = false;
        }
    }

    async function loadProject(id: string) {
        loadingProjectId = id;
        errorMsg = '';
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error();
            const project = await res.json();
            const state: GlobalState = JSON.parse(project.projectJson);
            await applyState(state);
            close();
        } catch {
            errorMsg = 'Could not load project';
        } finally {
            loadingProjectId = null;
        }
    }

    async function renameProject(id: string) {
        if (!renamingValue.trim()) return;
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renamingValue.trim() }),
            });
            if (!res.ok) throw new Error();
            renamingId = null;
            await fetchProjects();
        } catch {
            errorMsg = 'Could not rename project';
        }
    }

    async function deleteProject(id: string) {
        try {
            const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            confirmDeleteId = null;
            await fetchProjects();
        } catch {
            errorMsg = 'Could not delete project';
        }
    }

    function formatDate(ts: number) {
        return new Date(ts).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    }
</script>

<Modal {open} onClosed={close} modalWidth="520px">
    <div slot="header">
        <h5 class="modal-title">Cloud projects</h5>
    </div>

    <div slot="content" class="project-manager">
        {#if errorMsg}
            <div class="alert alert-danger py-2 px-3 mb-3">{errorMsg}</div>
        {/if}

        <div class="save-section mb-4">
            <label class="form-label fw-semibold">Save current project</label>
            <div class="d-flex gap-2">
                <input
                    class="form-control form-control-sm"
                    type="text"
                    placeholder="Project name…"
                    bind:value={newProjectName}
                    onkeydown={(e) => e.key === 'Enter' && saveCurrentProject()}
                />
                <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    onclick={saveCurrentProject}
                    disabled={saving || !newProjectName.trim()}
                >
                    {#if saving}
                        <span class="spinner-border spinner-border-sm"></span>
                    {:else}
                        Save
                    {/if}
                </button>
            </div>
        </div>

        <label class="form-label fw-semibold">Saved projects</label>

        {#if loading}
            <div class="text-center py-4">
                <span class="spinner-border spinner-border-sm"></span>
            </div>
        {:else if projects.length === 0}
            <p class="text-muted small">No saved projects yet.</p>
        {:else}
            <ul class="project-list">
                {#each projects as project (project.id)}
                    <li class="project-item">
                        {#if renamingId === project.id}
                            <div class="d-flex gap-2 flex-grow-1 align-items-center">
                                <input
                                    class="form-control form-control-sm"
                                    type="text"
                                    bind:value={renamingValue}
                                    onkeydown={(e) => {
                                        if (e.key === 'Enter') renameProject(project.id);
                                        if (e.key === 'Escape') renamingId = null;
                                    }}
                                />
                                <button class="btn btn-sm btn-primary" onclick={() => renameProject(project.id)}>OK</button>
                                <button class="btn btn-sm btn-outline-secondary" onclick={() => (renamingId = null)}>Cancel</button>
                            </div>
                        {:else if confirmDeleteId === project.id}
                            <div class="d-flex gap-2 flex-grow-1 align-items-center">
                                <span class="text-danger small flex-grow-1">Delete «{project.name}»?</span>
                                <button class="btn btn-sm btn-danger" onclick={() => deleteProject(project.id)}>Delete</button>
                                <button class="btn btn-sm btn-outline-secondary" onclick={() => (confirmDeleteId = null)}>Cancel</button>
                            </div>
                        {:else}
                            <div class="project-info flex-grow-1">
                                <span class="project-name">{project.name}</span>
                                <span class="project-date">{formatDate(project.updatedAt)}</span>
                            </div>
                            <div class="project-actions">
                                <button
                                    class="btn btn-sm btn-outline-primary"
                                    onclick={() => loadProject(project.id)}
                                    disabled={loadingProjectId === project.id}
                                    title="Load this project"
                                >
                                    {#if loadingProjectId === project.id}
                                        <span class="spinner-border spinner-border-sm"></span>
                                    {:else}
                                        Load
                                    {/if}
                                </button>
                                <button
                                    class="btn btn-sm btn-outline-secondary"
                                    onclick={() => overwriteProject(project.id)}
                                    title="Overwrite with current project"
                                >Save here</button>
                                <button
                                    class="btn btn-sm btn-outline-secondary"
                                    onclick={() => { renamingId = project.id; renamingValue = project.name; }}
                                    title="Rename"
                                >Rename</button>
                                <button
                                    class="btn btn-sm btn-outline-danger"
                                    onclick={() => (confirmDeleteId = project.id)}
                                    title="Delete"
                                >Delete</button>
                            </div>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>

    <div slot="footer"></div>
</Modal>

<style>
    .project-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .project-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e9ecef;
    }
    .project-info {
        display: flex;
        flex-direction: column;
    }
    .project-name {
        font-weight: 500;
        font-size: 0.9rem;
    }
    .project-date {
        font-size: 0.75rem;
        color: #6c757d;
    }
    .project-actions {
        display: flex;
        gap: 0.25rem;
        flex-shrink: 0;
    }
</style>
