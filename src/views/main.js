const kernels = require("../kernels");
const presets = require('../presets');

const html = require("choo/html");


const kernelElement = (name, kernel, onclick) => {  
  return html`
   <div class="kernel" onclick=${onclick}>
     <strong>${name}</strong>
   </div>
`;
};

module.exports = (state, prev, send) => {
  const onKernelClick = function(kernelName) {
    return () => send("addKernel", {"name": kernelName, "kernel": kernels[kernelName]});
  };
  return html`
<div role="menu">
<h3>Presets</h3>
<select onchange=${(e) => send("setPreset", e.target.value)}>
${Object.keys(presets).map((preset) => html`<option selected=${preset === state.currentPreset} value=${preset}>${preset}</option>`)}
</select>
<h3>Available Kernels</h3>
  <ul>
    ${Object.keys(kernels).map(
      (kernelName) => kernelElement(kernelName, kernels[kernelName], onKernelClick(kernelName)))}
  </ul>
  <h3>Applied Kernels</h3>
  <ul class="applied-kernels">
   ${state.kernelsToApply.map((kernel, index) => html`
  <li onclick=${()=>send("removeKernel", index)}>${kernel.name}</li>
  `)}
  </ul>
  <button onclick=${() => send("reset")}>reset to noise</button>
  <button onclick=${() => send("setRunning", !state.isRunning)}>${state.isRunning ? "pause / snapshot" : "continue"}</button>
<div>
<a href="about/">About</a>
</div>
</div>
`;
};
