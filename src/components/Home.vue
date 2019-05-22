<template>
  <div class="home">
    <search-bar></search-bar>
  </div>
</template>

<script>
import SearchBar from "./SearchBar.vue";

// eslint-disable-next-line
import Router from "vue-router";

export default {
  name: "Home",
  components: {
    SearchBar
  },
  data() {
    return {
      title: "stacheQL",
      subtitle: ""
    };
  }
};
</script>

<!-- "scoped" attribute limits CSS to this component only -->
<style scoped>
h1,
h2 {
  font-weight: normal;
}
</style>
