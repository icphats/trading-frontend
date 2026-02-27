<script lang="ts">
  import { parseMessageForMemes, type Meme } from "$lib/domain/trollbox";

  let { content } = $props<{ content: string }>();

  // Parse the message content for memes
  const parsedContent = $derived(parseMessageForMemes(content));
</script>

<span class="message-content-wrapper">
  {#each parsedContent as segment}
    {#if segment.type === "text"}
      <span>{segment.value}</span>
    {:else if segment.type === "meme"}
      {@const meme = segment.value as Meme}
      <img src={meme.url} alt={meme.shortcode} title={meme.name} class="inline-meme" />
    {/if}
  {/each}
</span>

<style>
  .message-content-wrapper {
    word-wrap: break-word;
    line-height: 1.5;
  }

  .inline-meme {
    display: inline-block;
    width: 24px;
    height: 24px;
    margin: 0 0.25rem;
    vertical-align: text-bottom;
    object-fit: contain;
  }
</style>
