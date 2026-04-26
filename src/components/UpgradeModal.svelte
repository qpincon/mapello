<script lang="ts">
    import Modal from './Modal.svelte';
    import { page } from '$app/state';
    import { invalidateAll } from '$app/navigation';
    import { loadPaddle, openCheckout } from '$lib/paddle-client';
    import { PUBLIC_PADDLE_PRICE_MONTHLY, PUBLIC_PADDLE_PRICE_YEARLY } from '$env/static/public';

    interface Props {
        open: boolean;
        onClosed?: () => void;
    }

    let { open, onClosed }: Props = $props();

    let loading: string | null = $state(null);
    let errorMsg = $state('');

    interface PriceInfo {
        monthly: string | null;
        yearly: string | null;
        yearlyMonthly: string | null; // yearly total divided by 12, formatted
    }
    let prices = $state<PriceInfo>({ monthly: null, yearly: null, yearlyMonthly: null });

    $effect(() => {
        if (open) fetchPrices();
    });

    async function fetchPrices() {
        try {
            const paddle = await loadPaddle();
            const result = await paddle.PricePreview({
                items: [
                    { priceId: PUBLIC_PADDLE_PRICE_MONTHLY, quantity: 1 },
                    { priceId: PUBLIC_PADDLE_PRICE_YEARLY, quantity: 1 },
                ],
            });
            const items = result.data.details.lineItems;
            const monthly = items.find((i) => i.price.id === PUBLIC_PADDLE_PRICE_MONTHLY);
            const yearly = items.find((i) => i.price.id === PUBLIC_PADDLE_PRICE_YEARLY);

            const monthlyTotal = monthly?.formattedTotals.total ?? null;
            const yearlyTotal = yearly?.formattedTotals.total ?? null;

            // Compute "per month" price for the yearly plan
            let yearlyMonthly: string | null = null;
            if (yearly) {
                const raw = yearly.unitTotals.total; // in smallest currency unit (e.g. cents)
                const currencyCode = result.data.currencyCode;
                const perMonth = Number(raw) / 12;
                yearlyMonthly = formatCurrency(perMonth, currencyCode);
            }

            prices = { monthly: monthlyTotal, yearly: yearlyTotal, yearlyMonthly };
        } catch {
            // Leave prices null — fall back to static display
        }
    }

    function formatCurrency(smallestUnit: number, currencyCode: string): string {
        // Paddle amounts are in the smallest unit (cents for EUR/USD, etc.)
        const majorUnit = smallestUnit / 100;
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(majorUnit);
        } catch {
            return `${majorUnit} ${currencyCode}`;
        }
    }

    async function subscribe(priceId: string) {
        loading = priceId;
        errorMsg = '';
        try {
            await openCheckout({
                priceId,
                userId: page.data.user!.id,
                userEmail: page.data.user!.email,
                onComplete: async () => {
                    await invalidateAll();
                    onClosed?.();
                },
            });
        } catch {
            errorMsg = 'Something went wrong. Please try again.';
        } finally {
            loading = null;
        }
    }
</script>

<Modal {open} modalWidth="380px" {onClosed}>
    <div slot="header"><strong>Upgrade to Pro</strong></div>
    <div slot="content">
        <p>Unlock unlimited SVG exports. Choose your billing period:</p>
        {#if errorMsg}
            <p class="error">{errorMsg}</p>
        {/if}
        <div class="plans">
            <button
                class="plan-btn"
                onclick={() => subscribe(PUBLIC_PADDLE_PRICE_MONTHLY)}
                disabled={!!loading}
            >
                <span class="plan-label">Monthly</span>
                <span class="plan-price">
                    {prices.monthly ?? '…'}<span class="plan-period"> / month</span>
                </span>
            </button>
            <button
                class="plan-btn plan-btn--featured"
                onclick={() => subscribe(PUBLIC_PADDLE_PRICE_YEARLY)}
                disabled={!!loading}
            >
                <span class="plan-label">Yearly <span class="save-badge">save 20%</span></span>
                <span class="plan-price">
                    {prices.yearlyMonthly ?? '…'}<span class="plan-period"> / month</span>
                </span>
                {#if prices.yearly}
                    <span class="plan-sub">{prices.yearly} billed once a year</span>
                {/if}
            </button>
        </div>
    </div>
</Modal>

<style>
    p {
        margin: 0 0 1rem;
        color: #495057;
        font-size: 0.95rem;
    }

    .error {
        color: #dc3545;
        font-size: 0.875rem;
    }

    .plans {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .plan-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        border: 2px solid #dee2e6;
        background: white;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, background 0.15s;
    }

    .plan-btn:hover:not(:disabled) {
        border-color: #0d6efd;
        background: #f0f5ff;
    }

    .plan-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .plan-btn--featured {
        border-color: #0d6efd;
    }

    .plan-label {
        font-weight: 600;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .plan-price {
        font-size: 1.1rem;
        font-weight: 700;
        color: #212529;
    }

    .plan-period {
        font-size: 0.85rem;
        font-weight: 400;
        color: #6c757d;
    }

    .plan-sub {
        font-size: 0.8rem;
        color: #6c757d;
    }

    .save-badge {
        background: #198754;
        color: white;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 1px 7px;
        border-radius: 999px;
    }
</style>
