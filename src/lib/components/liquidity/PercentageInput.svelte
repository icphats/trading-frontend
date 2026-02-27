<script lang="ts">
  interface Props {
    value: string;
    onInput: (value: string) => void;
    placeholder?: string;
  }

  let { value, onInput, placeholder = '0' }: Props = $props();

  let inputEl: HTMLInputElement;

  // Dynamic width based on content
  const inputWidth = $derived(
    value ? `${Math.max(1, value.length)}ch` : '2ch'
  );

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const newValue = target.value.replace(/[^0-9]/g, '');
    const num = Number(newValue);

    if (newValue === '' || (num >= 0 && num <= 100)) {
      onInput(newValue);
    }
  }
</script>

<input
  bind:this={inputEl}
  type="text"
  inputmode="numeric"
  class="percent-input"
  {value}
  oninput={handleInput}
  {placeholder}
  maxlength="3"
  style:width={inputWidth}
/>

<style>
  .percent-input {
    font-size: 3rem;
    font-weight: 500;
    font-family: var(--font-numeric);
    color: var(--foreground);
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    min-width: 2ch;
    max-width: 4ch;
    caret-color: var(--primary);
  }

  .percent-input::placeholder {
    color: var(--muted-foreground);
  }
</style>
