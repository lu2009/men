<template>
  <span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 44 44" role="presentation">
      <path class="brand-mark__frame" d="M6.5 5.5h31v33h-31z" />
      <path class="brand-mark__rail" d="M21.5 6v32M7 20.5h30" />
      <path class="brand-mark__opening" d="m22 21 10-8v25" />
      <circle class="brand-mark__handle" cx="29.5" cy="25.5" r="1" />
    </svg>
  </span>
</template>

<style scoped>
.brand-mark {
  display: inline-grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  border: var(--sd-border-width) solid var(--sd-border-glass-soft);
  border-radius: var(--sd-radius-control);
  color: var(--sd-color-text-on-action);
  background: var(--sd-color-action);
  box-shadow: var(--sd-shadow-brand-mark);
}

.brand-mark svg {
  display: block;
  width: 32px;
  height: 32px;
  overflow: visible;
}

.brand-mark__frame,
.brand-mark__rail,
.brand-mark__opening {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-mark__frame {
  stroke-width: 2.2;
}

.brand-mark__rail {
  opacity: 0.42;
  stroke-width: 1;
}

.brand-mark__opening {
  opacity: 0.95;
  stroke-width: 2;
}

.brand-mark__handle {
  fill: currentColor;
}
</style>
