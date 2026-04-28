<script lang="ts">
    let activeTab = $state<"loader" | "inline">("loader");
    let copied = $state(false);

    const LOADER_SNIPPET = `<div id="container1"></div>
<script
  data-svg-path="./cartosvg-export.svg"
  data-target-container-id="container1"
  src="https://mapello.net/svg-loader.js"
><\/script>`;

    async function copySnippet() {
        await navigator.clipboard.writeText(LOADER_SNIPPET);
        copied = true;
        setTimeout(() => (copied = false), 2000);
    }
</script>

<div class="mode-tabs mb-3">
    <button
        class="tab-btn"
        class:active={activeTab === "loader"}
        type="button"
        onclick={() => (activeTab = "loader")}
    >
        With svg-loader.js <span class="recommended-badge">recommended</span>
    </button>
    <button
        class="tab-btn"
        class:active={activeTab === "inline"}
        type="button"
        onclick={() => (activeTab = "inline")}
    >
        Inline SVG
    </button>
</div>

{#if activeTab === "loader"}
    <ol class="steps-list">
        <li>Move the downloaded <code>cartosvg-export.svg</code> into your website's project folder (e.g. next to your HTML file).</li>
        <li>Add an empty <code>&lt;div&gt;</code> with an <code>id</code> where the map should appear.</li>
        <li>Drop in the loader script, pointing it at your file and that <code>id</code>.</li>
    </ol>
    <div class="snippet-wrapper">
        <pre class="code-block"><code>{LOADER_SNIPPET}</code></pre>
        <button class="copy-btn" type="button" onclick={copySnippet}>
            {copied ? "Copied!" : "Copy"}
        </button>
    </div>
    <p class="text-muted small mt-2 mb-0">
        The script keeps your HTML clean and lets you swap the map by replacing the SVG file.
    </p>
{:else}
    <ol class="steps-list">
        <li>Open the downloaded <code>cartosvg-export.svg</code> file in a text editor.</li>
        <li>Copy its full contents and paste them directly into your HTML where the map should appear.</li>
    </ol>
    <p class="text-muted small mt-2 mb-0">
        Less ergonomic — the SVG markup will live directly inside your HTML, and you'll need to repaste to update the map.
    </p>
{/if}

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
    .recommended-badge {
        font-size: 0.7em;
        background: #dbeafe;
        color: #1d4ed8;
        border-radius: 4px;
        padding: 0.1em 0.4em;
        vertical-align: middle;
        font-weight: 500;
        margin-left: 0.3em;
    }
    .steps-list {
        padding-left: 1.25rem;
        margin-bottom: 0.75rem;
        font-size: 0.9rem;
        line-height: 1.6;
    }
    .steps-list li {
        margin-bottom: 0.3rem;
    }
    .snippet-wrapper {
        position: relative;
    }
    .code-block {
        background: #f6f8fa;
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        padding: 0.85rem;
        font-size: 0.82rem;
        white-space: pre-wrap;
        word-break: break-all;
        margin: 0;
        padding-right: 4.5rem;
    }
    .copy-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        font-size: 0.75rem;
        padding: 0.2rem 0.6rem;
        border: 1px solid #d0d7de;
        border-radius: 4px;
        background: #fff;
        color: #24292f;
        cursor: pointer;
        transition: background 0.1s;
    }
    .copy-btn:hover {
        background: #f3f4f6;
    }
</style>
