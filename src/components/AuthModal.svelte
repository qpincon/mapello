<script lang="ts">
    import Modal from './Modal.svelte';
    import { signIn, signUp, requestPasswordReset } from '$lib/auth-client';
    import { invalidateAll } from '$app/navigation';

    interface Props {
        open: boolean;
        afterAuth?: () => void;
    }

    let { open = $bindable(), afterAuth }: Props = $props();

    type AuthMode = 'login' | 'register' | 'forgot';
    let mode: AuthMode = $state('login');
    let email = $state('');
    let password = $state('');
    let errorMsg = $state('');
    let loading = $state(false);
    let forgotSent = $state(false);

    // Google login button is always shown; if not configured server-side the request will fail gracefully

    function switchMode(m: AuthMode) {
        mode = m;
        errorMsg = '';
        forgotSent = false;
    }

    function close() {
        open = false;
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();
        errorMsg = '';
        loading = true;
        try {
            if (mode === 'register') {
                const result = await signUp.email({ name: email.split('@')[0], email, password });
                if (result.error) {
                    errorMsg = result.error.message ?? 'Registration failed';
                    return;
                }
            } else {
                const result = await signIn.email({ email, password });
                if (result.error) {
                    errorMsg = result.error.message ?? 'Login failed';
                    return;
                }
            }
            close();
            await invalidateAll();
            afterAuth?.();
        } catch {
            errorMsg = 'An unexpected error occurred';
        } finally {
            loading = false;
        }
    }

    async function handleGoogleSignIn() {
        loading = true;
        try {
            await signIn.social({ provider: 'google', callbackURL: '/app' });
        } catch {
            errorMsg = 'Google sign-in failed';
            loading = false;
        }
    }

    async function handleFacebookSignIn() {
        loading = true;
        try {
            await signIn.social({ provider: 'facebook', callbackURL: '/app' });
        } catch {
            errorMsg = 'Facebook sign-in failed';
            loading = false;
        }
    }

    async function handleForgotPassword(e: Event) {
        e.preventDefault();
        errorMsg = '';
        loading = true;
        try {
            await requestPasswordReset({ email, redirectTo: '/reset-password' });
            forgotSent = true;
        } catch {
            errorMsg = 'Could not send reset email';
        } finally {
            loading = false;
        }
    }
</script>

<Modal {open} onClosed={close} modalWidth="420px">
    <div slot="header">
        <h5 class="modal-title">{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}</h5>
    </div>

    <div slot="content" class="auth-modal">
        {#if mode !== 'forgot'}
            <div class="mode-tabs mb-3">
                <button
                    class="tab-btn"
                    class:active={mode === 'login'}
                    type="button"
                    onclick={() => switchMode('login')}
                >Sign in</button>
                <button
                    class="tab-btn"
                    class:active={mode === 'register'}
                    type="button"
                    onclick={() => switchMode('register')}
                >Create account</button>
            </div>

            <form onsubmit={handleSubmit}>
                <div class="mb-3">
                    <label class="form-label" for="auth-email">Email</label>
                    <input
                        id="auth-email"
                        class="form-control"
                        type="email"
                        bind:value={email}
                        required
                        autocomplete="email"
                        placeholder="you@example.com"
                    />
                </div>
                <div class="mb-3">
                    <label class="form-label" for="auth-password">Password</label>
                    <input
                        id="auth-password"
                        class="form-control"
                        type="password"
                        bind:value={password}
                        required
                        autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
                        placeholder="••••••••"
                    />
                </div>

                {#if mode === 'login'}
                    <div class="text-end mb-2">
                        <button type="button" class="btn btn-link p-0 small" onclick={() => switchMode('forgot')}>
                            Forgot password?
                        </button>
                    </div>
                {/if}

                {#if errorMsg}
                    <div class="alert alert-danger py-2 px-3 mb-3">{errorMsg}</div>
                {/if}

                <button class="btn btn-primary w-100" type="submit" disabled={loading}>
                    {#if loading}
                        <span class="spinner-border spinner-border-sm me-1"></span>
                    {/if}
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
            </form>

            <div class="divider my-3">or</div>

            <button
                class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
                type="button"
                onclick={handleGoogleSignIn}
                disabled={loading}
            >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2v6h7.7c4.5-4.2 7.1-10.3 7.1-17.2z"/>
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9H2.6v6.2C6.5 42.7 14.7 48 24 48z"/>
                    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.7-2.9-.7-4.6s.3-3.2.7-4.6v-6.2H2.6C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z"/>
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.7 0 6.5 5.3 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/>
                </svg>
                Continue with Google
            </button>

            <button
                class="btn btn-facebook w-100 d-flex align-items-center justify-content-center gap-2 mt-2"
                type="button"
                onclick={handleFacebookSignIn}
                disabled={loading}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.532-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Continue with Facebook
            </button>
        {:else}
            {#if forgotSent}
                <div class="alert alert-success py-2 px-3">
                    If that address is registered, a reset link has been sent.
                </div>
            {:else}
                <form onsubmit={handleForgotPassword}>
                    <div class="mb-3">
                        <label class="form-label" for="forgot-email">Email</label>
                        <input
                            id="forgot-email"
                            class="form-control"
                            type="email"
                            bind:value={email}
                            required
                            autocomplete="email"
                            placeholder="you@example.com"
                        />
                    </div>
                    {#if errorMsg}
                        <div class="alert alert-danger py-2 px-3 mb-3">{errorMsg}</div>
                    {/if}
                    <button class="btn btn-primary w-100" type="submit" disabled={loading}>
                        {#if loading}<span class="spinner-border spinner-border-sm me-1"></span>{/if}
                        Send reset link
                    </button>
                </form>
            {/if}
            <button type="button" class="btn btn-link w-100 mt-2" onclick={() => switchMode('login')}>
                Back to sign in
            </button>
        {/if}
    </div>

    <div slot="footer"></div>
</Modal>

<style>
    .mode-tabs {
        display: flex;
        border-bottom: 1px solid #dee2e6;
    }
    .tab-btn {
        flex: 1;
        padding: 0.5rem;
        border: none;
        background: none;
        color: #6c757d;
        font-size: 0.9rem;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.15s;
    }
    .tab-btn.active {
        color: #0d6efd;
        border-bottom-color: #0d6efd;
        font-weight: 500;
    }
    .divider {
        text-align: center;
        position: relative;
        color: #6c757d;
        font-size: 0.85rem;
    }
    .divider::before,
    .divider::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 45%;
        height: 1px;
        background: #dee2e6;
    }
    .divider::before { left: 0; }
    .divider::after { right: 0; }
    .btn-facebook {
        background-color: #1877F2;
        border-color: #1877F2;
        color: #fff;
    }
    .btn-facebook:hover:not(:disabled) {
        background-color: #166fe5;
        border-color: #166fe5;
        color: #fff;
    }
</style>
