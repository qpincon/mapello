<script lang="ts">
  import githubLogo from "../assets/img/github.svg?raw";
  interface Props {
    activeTitle?: string;
  }

  let { activeTitle = "index.html" }: Props = $props();
</script>

<div id="navbar">
  <slot></slot>
</div>
<slot name="bottom-left"></slot>
<a
  class="p-2 github"
  target="_blank"
  style="width:60px; height:auto; fill:#aaa;"
  href="https://github.com/qpincon/CartoSVG">{@html githubLogo}</a
>

<style lang="scss">
  #navbar {
    display: flex;
    width: 100%;
    background-color: #f4f7fb;
    border-bottom: 1px solid #e0e8f0;
    min-height: 50px;
    display: flex;
    align-items: center;
    > a {
      text-decoration: none;
      font-size: 14px;
      color: black;
      margin-right: 10px;
      font-weight: bold;
    }
  }
  .github {
    position: absolute;
    bottom: 0;
    right: 0;
  }
  :global(.github > svg) {
    fill: #5f5f5f;
    transition: fill 0.3s;
    max-width: 3rem;
  }
  :global(.github:hover > svg) {
    fill: black;
  }
</style>
