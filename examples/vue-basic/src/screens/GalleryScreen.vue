<script setup lang="ts">
import { assets } from "../../assets.js";

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <section class="screen screen--panel">
    <div class="screen__inner panel-screen">
      <h1>Gallery</h1>
      <div class="gallery-grid">
        <figure v-for="background in assets.visual.backgrounds" :key="background.label" class="gallery-grid__item">
          <img :src="background.url" :alt="background.label" />
          <figcaption>{{ background.label }}</figcaption>
        </figure>
        <figure v-for="sprite in assets.visual.sprites" :key="sprite.label" class="gallery-grid__item">
          <img :src="sprite.url" :alt="sprite.label" />
          <figcaption>{{ sprite.label }}</figcaption>
        </figure>
      </div>
      <button type="button" @click="emit('back')">Back</button>
    </div>
  </section>
</template>
