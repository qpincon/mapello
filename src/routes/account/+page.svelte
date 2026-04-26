<script lang="ts">
    import { page } from '$app/state';
    import { invalidateAll } from '$app/navigation';
    import { FREE_EXPORT_LIMIT } from '$lib/billing-constants';

    const user = $derived(page.data.user!);
    const subscription = $derived(page.data.subscription);
    const exportsRemaining = $derived(page.data.exportsRemaining);

    let cancelLoading = $state(false);
    let cancelError = $state('');
    let cancelDone = $state(false);

    let deleteConfirm = $state(false);
    let deleteLoading = $state(false);
    let deleteError = $state('');

    function formatDate(d: Date | string | null | undefined) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    async function cancelSubscription() {
        cancelLoading = true;
        cancelError = '';
        try {
            const res = await fetch('/api/billing/cancel', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                cancelError = data.message || 'Could not cancel subscription.';
                return;
            }
            cancelDone = true;
            await invalidateAll();
        } catch {
            cancelError = 'Something went wrong. Please try again.';
        } finally {
            cancelLoading = false;
        }
    }

    async function deleteAccount() {
        deleteLoading = true;
        deleteError = '';
        try {
            const res = await fetch('/api/account/delete', { method: 'POST' });
            if (!res.ok) {
                deleteError = 'Could not delete account. Please try again.';
                return;
            }
            window.location.href = '/';
        } catch {
            deleteError = 'Something went wrong. Please try again.';
        } finally {
            deleteLoading = false;
        }
    }
</script>

<svelte:head>
    <title>My account — Mapello</title>
</svelte:head>

<div class="account-page">
    <div class="account-container">
        <a href="/app" class="back-link">&larr; Back to editor</a>
        <h1>My account</h1>

        <section class="card">
            <h2>Profile</h2>
            <div class="field">
                <span class="label">Email</span>
                <span class="value">{user.email}</span>
            </div>
            <div class="field">
                <span class="label">Member since</span>
                <span class="value">{formatDate(user.createdAt)}</span>
            </div>
        </section>

        <section class="card">
            <h2>Subscription</h2>

            {#if subscription}
                <div class="field">
                    <span class="label">Plan</span>
                    <span class="value"><span class="badge-pro">Pro</span></span>
                </div>
                <div class="field">
                    <span class="label">Active since</span>
                    <span class="value">{formatDate(subscription.createdAt)}</span>
                </div>
                <div class="field">
                    <span class="label">Current period ends</span>
                    <span class="value">{formatDate(subscription.currentPeriodEnd)}</span>
                </div>

                {#if subscription.cancelAtPeriodEnd || cancelDone}
                    <div class="info-box">
                        Cancellation scheduled. Your Pro access remains active until <strong>{formatDate(subscription.currentPeriodEnd)}</strong>, then your account reverts to the free plan. You will not be charged again.
                    </div>
                {:else}
                    <div class="cancel-area">
                        {#if cancelError}
                            <p class="error">{cancelError}</p>
                        {/if}
                        <button
                            class="btn-cancel"
                            onclick={cancelSubscription}
                            disabled={cancelLoading}
                        >
                            {cancelLoading ? 'Cancelling…' : 'Cancel subscription'}
                        </button>
                        <p class="hint">You keep Pro access until the end of the current billing period.</p>
                    </div>
                {/if}
            {:else}
                <div class="field">
                    <span class="label">Plan</span>
                    <span class="value">Free</span>
                </div>
                <div class="field">
                    <span class="label">Exports remaining</span>
                    <span class="value">
                        {exportsRemaining ?? 0} / {FREE_EXPORT_LIMIT}
                    </span>
                </div>
            {/if}
        </section>

        <section class="card danger-zone">
            <h2>Danger zone</h2>
            <p>Permanently delete your account and all your projects. This cannot be undone.</p>
            {#if deleteConfirm}
                <div class="confirm-row">
                    <span class="confirm-label">Are you sure?</span>
                    <button
                        class="btn-danger"
                        onclick={deleteAccount}
                        disabled={deleteLoading}
                    >
                        {deleteLoading ? 'Deleting…' : 'Yes, delete my account'}
                    </button>
                    <button
                        class="btn-secondary"
                        onclick={() => (deleteConfirm = false)}
                        disabled={deleteLoading}
                    >
                        Cancel
                    </button>
                </div>
                {#if deleteError}
                    <p class="error">{deleteError}</p>
                {/if}
            {:else}
                <button class="btn-danger-outline" onclick={() => (deleteConfirm = true)}>
                    Delete my account
                </button>
            {/if}
        </section>
    </div>
</div>

<style>
    .account-page {
        min-height: 100vh;
        background: #f8f9fa;
        padding: 3rem 1rem;
    }

    .account-container {
        max-width: 560px;
        margin: 0 auto;
    }

    .back-link {
        display: inline-block;
        color: #6c757d;
        text-decoration: none;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
    }

    .back-link:hover {
        color: #343a40;
    }

    h1 {
        font-size: 1.8rem;
        font-weight: 700;
        margin: 0 0 1.5rem;
    }

    .card {
        background: white;
        border-radius: 10px;
        border: 1px solid #e9ecef;
        padding: 1.5rem;
        margin-bottom: 1.25rem;
    }

    h2 {
        font-size: 1rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6c757d;
        margin: 0 0 1rem;
    }

    .field {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4rem 0;
        border-bottom: 1px solid #f0f0f0;
        font-size: 0.95rem;
    }

    .field:last-of-type {
        border-bottom: none;
    }

    .label {
        color: #6c757d;
    }

    .value {
        font-weight: 500;
    }

    .badge-pro {
        background: #0d6efd;
        color: white;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 2px 10px;
        border-radius: 999px;
    }

    .info-box {
        margin-top: 1rem;
        padding: 0.75rem 1rem;
        background: #fff8e1;
        border: 1px solid #ffe082;
        border-radius: 6px;
        font-size: 0.9rem;
        color: #5d4037;
    }

    .cancel-area {
        margin-top: 1rem;
    }

    .hint {
        margin: 0.4rem 0 0;
        font-size: 0.8rem;
        color: #6c757d;
    }

    .btn-cancel {
        background: none;
        border: 1px solid #dc3545;
        color: #dc3545;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .btn-cancel:hover:not(:disabled) {
        background: #dc3545;
        color: white;
    }

    .btn-cancel:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .danger-zone p {
        font-size: 0.9rem;
        color: #6c757d;
        margin: 0 0 1rem;
    }

    .confirm-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .confirm-label {
        font-weight: 600;
        font-size: 0.9rem;
    }

    .btn-danger {
        background: #dc3545;
        color: white;
        border: none;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.15s;
    }

    .btn-danger:hover:not(:disabled) {
        background: #b02a37;
    }

    .btn-danger:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: none;
        border: 1px solid #adb5bd;
        color: #495057;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #f8f9fa;
    }

    .btn-secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-danger-outline {
        background: none;
        border: 1px solid #dc3545;
        color: #dc3545;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .btn-danger-outline:hover {
        background: #dc3545;
        color: white;
    }

    .error {
        color: #dc3545;
        font-size: 0.875rem;
        margin: 0.5rem 0 0;
    }
</style>
