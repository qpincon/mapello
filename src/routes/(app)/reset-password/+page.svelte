<script lang="ts">
    import { page } from '$app/state';
    import { resetPassword } from '$lib/auth-client';
    import { goto } from '$app/navigation';

    const token = $derived(page.url.searchParams.get('token') ?? '');
    let newPassword = $state('');
    let confirmPassword = $state('');
    let errorMsg = $state('');
    let loading = $state(false);
    let done = $state(false);

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            errorMsg = 'Passwords do not match';
            return;
        }
        loading = true;
        errorMsg = '';
        try {
            const result = await resetPassword({ newPassword, token });
            if (result.error) {
                errorMsg = result.error.message ?? 'Reset failed';
                return;
            }
            done = true;
            setTimeout(() => goto('/app'), 2000);
        } catch {
            errorMsg = 'An unexpected error occurred';
        } finally {
            loading = false;
        }
    }
</script>

<div class="reset-page">
    <div class="reset-card">
        <h4 class="mb-4">Set new password</h4>

        {#if !token}
            <div class="alert alert-danger">Invalid or missing reset token.</div>
            <a href="/app" class="btn btn-primary w-100">Back to app</a>
        {:else if done}
            <div class="alert alert-success">Password updated! Redirecting…</div>
        {:else}
            <form onsubmit={handleSubmit}>
                <div class="mb-3">
                    <label class="form-label" for="new-password">New password</label>
                    <input
                        id="new-password"
                        class="form-control"
                        type="password"
                        bind:value={newPassword}
                        required
                        autocomplete="new-password"
                        placeholder="••••••••"
                    />
                </div>
                <div class="mb-3">
                    <label class="form-label" for="confirm-password">Confirm password</label>
                    <input
                        id="confirm-password"
                        class="form-control"
                        type="password"
                        bind:value={confirmPassword}
                        required
                        autocomplete="new-password"
                        placeholder="••••••••"
                    />
                </div>

                {#if errorMsg}
                    <div class="alert alert-danger py-2 px-3 mb-3">{errorMsg}</div>
                {/if}

                <button class="btn btn-primary w-100" type="submit" disabled={loading}>
                    {#if loading}<span class="spinner-border spinner-border-sm me-1"></span>{/if}
                    Set new password
                </button>
            </form>
        {/if}
    </div>
</div>

<style>
    .reset-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f9fa;
    }
    .reset-card {
        background: white;
        border-radius: 8px;
        padding: 2rem;
        width: 100%;
        max-width: 420px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
</style>
