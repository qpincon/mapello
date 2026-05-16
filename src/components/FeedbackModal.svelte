<script lang="ts">
    import Modal from './Modal.svelte';
    import { track } from '../util/analytics';

    interface Props {
        open: boolean;
        projectId?: number | null;
        projectName?: string;
    }

    let { open = $bindable(), projectId = null, projectName = '' }: Props = $props();

    let category = $state('bug');
    let message = $state('');
    let loading = $state(false);
    let errorMsg = $state('');
    let sent = $state(false);

    function close() {
        open = false;
        category = 'bug';
        message = '';
        errorMsg = '';
        sent = false;
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();
        errorMsg = '';
        loading = true;
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, message, projectId, projectName }),
            });
            if (!res.ok) {
                const text = await res.text();
                errorMsg = text || 'Something went wrong. Please try again.';
                return;
            }
            track('feedback_submit', { category });
            sent = true;
            setTimeout(() => close(), 2000);
        } catch {
            errorMsg = 'Could not send feedback. Please check your connection.';
        } finally {
            loading = false;
        }
    }
</script>

<Modal {open} onClosed={close} modalWidth="460px">
    <div slot="header">
        <h5 class="modal-title">Send feedback</h5>
    </div>

    <div slot="content">
        {#if sent}
            <div class="alert alert-success py-2 px-3 mb-0">
                Thanks for your feedback! We'll get back to you shortly.
            </div>
        {:else}
            <form onsubmit={handleSubmit}>
                <div class="mb-3">
                    <label class="form-label" for="feedback-category">Category</label>
                    <select id="feedback-category" class="form-select" bind:value={category}>
                        <option value="bug">Bug report</option>
                        <option value="feature">Feature request</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label" for="feedback-message">Message</label>
                    <textarea
                        id="feedback-message"
                        class="form-control"
                        rows="5"
                        maxlength="5000"
                        placeholder="Describe the issue or your idea…"
                        bind:value={message}
                        required
                    ></textarea>
                    <div class="form-text text-end">{message.length}/5000</div>
                </div>

                {#if errorMsg}
                    <div class="alert alert-danger py-2 px-3 mb-3">{errorMsg}</div>
                {/if}

                <button class="btn btn-primary w-100" type="submit" disabled={loading || message.trim().length === 0}>
                    {#if loading}
                        <span class="spinner-border spinner-border-sm me-1"></span>
                    {/if}
                    Send
                </button>
            </form>
        {/if}
    </div>

    <div slot="footer"></div>
</Modal>
