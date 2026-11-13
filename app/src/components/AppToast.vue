<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { message, isError, isVisible } = useToast()
</script>

<template>
  <div
    class="toast"
    role="status"
    aria-live="polite"
    :class="{ 'is-visible': isVisible, 'is-error': isError }"
  >
    {{ message }}
  </div>
</template>
