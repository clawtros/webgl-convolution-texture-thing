const kernels = require("./kernels");
const getKernel = function(kernelName) {
  return {
    name: kernelName,
    kernel: kernels[kernelName]
  };
};

module.exports = {
  empty: [],
  coral: [
    "edge1",
    "smooth"
  ].map(getKernel),
  game_of_lifey_bugs: [
    "smooth",
    "sharpen"
  ].map(getKernel),    
  scritchy: [
    "emboss",
    "smooth",
    "gaussian",
    "edge"
  ].map(getKernel),    
  brownian: [
    "gaussian",
    "smooth",
    "edge",
    "gaussian"
  ].map(getKernel),

  space_invaders: [
    "normal",
    "smooth",
    "gradientV",
    "smooth",
    "smooth",
    "smooth",
    "smooth"
  ].map(getKernel),
  
  worm_matrix: [
    "gradientH",
    "gaussian",
    "gaussian",
    "gaussian",
    "gaussian",
    "gaussian",
    "edge",
    "smooth"
  ].map(getKernel),

  terraces: [
    "gaussian",
    "edge1",
    "edge2",
    "sharpen"
  ].map(getKernel)
};
