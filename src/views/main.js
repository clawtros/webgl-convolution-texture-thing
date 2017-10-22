const html = require("choo/html");

const kernelContents = (name, kernel) => {
  return html`<div><pre class="kernel-matrix">${kernel.map((e, i) => e.toFixed(2) + ((i + 1) % 3 == 0 ? '\n' : ' '))}</pre><strong>${name}</strong></div>`;
}

const kernelElement = (name, kernel, onclick) => {  
  return html`
    <div class="kernel" onclick=${onclick}>
      ${kernelContents(name, kernel)}
    </div>`;
};

module.exports = (state, prev, send) => {
  const onKernelClick = function(kernelName) {
    return () => send("addKernel", {"name": kernelName, "kernel": state.kernels[kernelName]});
  };
  return html`
    <div class="app">
      <div class="applied" style="position: fixed; top: 0; left: 0; background: white;">
        <h3>Applied Kernels</h3>
          <ul class="applied-kernels">
            ${state.kernelsToApply.map((kernel, index) => html`
  <li onclick=${()=>send("removeKernel", index)}>${kernel.name}</li>
  `)}
     </ul>
     </div>

    <div role="menu">
     <a role="top-nav" href="#/about/">About</a>
     <h3>Presets</h3>
     <select onchange=${(e) => send("setPreset", e.target.value)}>
       ${Object.keys(state.presets).map((preset) => html`<option selected=${preset === state.currentPreset} value=${preset}>${preset}</option>`)}
     </select>
     <h3>Available Kernels</h3>
     <ul>
       ${Object.keys(state.kernels).map(
       (kernelName) => kernelElement(kernelName, state.kernels[kernelName], onKernelClick(kernelName)))}
 <li>
<div class="wha" style="display:block; float:none; clear:both;">
   ${state.nthFrame}
  <input type="range" min="1" max="100" step="1" oninput=${e=>{send("setNthFrame", e.target.value)}} value=${state.nthFrame}>
</div>
</li>
     </ul>
     <button onclick=${_=>send("reset")}>reset to noise</button>

     <button onclick=${_=>send("setRunning", !state.isRunning)}>${state.isRunning ? "pause / snapshot" : "continue"}</button>

   </div>
</div>
`;
};
