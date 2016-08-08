const kernels = require("./kernels");
const presets = require('./presets');
const Generator = require("./generator");

const choo = require("choo");
const html = require("choo/html");

const app = choo();


const kernelView = (name, kernel, onclick) => {  
    return html`
   <div class="kernel" onclick=${onclick}>
     <strong>${name}</strong>
   </div>
`;
};


const aboutView = (state, prev, send) {
    
}


const mainView = (state, prev, send) => {
    const onKernelClick = function(kernelName) {
        return () => send("addKernel", {"name": kernelName, "kernel": kernels[kernelName]});
    };
    return html`<div role="menu">
<h3>Presets</h3>
<select onchange=${(e) => send("setPreset", e.target.value)}>
${Object.keys(presets).map((preset) => html`<option selected=${preset === state.currentPreset} value=${preset}>${preset}</option>`)}
</select>
<h3>Available Kernels</h3>
  <ul>
    ${Object.keys(kernels).map(
      (kernelName) => kernelView(kernelName, kernels[kernelName], onKernelClick(kernelName)))}
  </ul>
  <h3>Applied Kernels</h3>
  <ul class="applied-kernels">
   ${state.kernelsToApply.map((kernel, index) => html`
        <li onclick=${()=>send("removeKernel", index)}>${kernel.name}</li>
        `)}
  </ul>
  <button onclick=${() => send("reset")}>reset to noise</button>
  <button onclick=${() => send("setRunning", !state.isRunning)}>${state.isRunning ? "pause" : "continue"}</button>
</div>`;
};

const createGeneratorModel = function(textureGenerator) {
    return {
        state: {
            isTiled: true,
            currentPreset: "coral",
            kernelsToApply: presets["coral"],
            isRunning: true
        },
        subscriptions: [
            (send, done) => {
                let animate = function() {
                    requestAnimationFrame(animate);
                    send("update", undefined, done);
                    send("render", undefined, done);
                };
                animate();
                done();
            }
        ],
        effects: {
            update: (data, state, send, done) => {
                if (state.isRunning) {
                    for (let kernelToApply of state.kernelsToApply) {
                        let {_, kernel} = kernelToApply;
                        textureGenerator.drawWithKernel(kernel);
                    }
                }                
                if (state.isTiled && state.isRunning) {
                    textureGenerator.hide();
                } else {
                    textureGenerator.show();
                }
                done();
            },
            reset: (data, state, send, done) => {
                textureGenerator.reset();
                done();
            },
            render: (data, state, send, done) => {
                textureGenerator.render();        
                if (state.isTiled) {
                    var body = document.getElementsByTagName("body")[0];
                    body.setAttribute("style", "background-image: url(" + textureGenerator.canvas.toDataURL() + ")");
                }
                done();
            }
        },
        reducers: {
            setTiled: (data) => {
                return {isTiled: data};
            },
            setRunning: (data) => {
                return {isRunning: data};
            },
            removeKernel: function(index, state) {
                return {
                    kernelsToApply: state.kernelsToApply.slice(0, index).concat(state.kernelsToApply.slice(index + 1))
                };
            },
            addKernel: function(kernel, state) {
                return {kernelsToApply: state.kernelsToApply.concat([kernel])};
            },
            setPreset: function(preset)  {
                return {currentPreset: preset, kernelsToApply: presets[preset]};
            }
        }
    };
};

app.router((route) => [
    route('/', mainView)
]);

window.startApp = () => {
    var texGen = Generator({
        canvasId: "c",
        resolution: 256
    });
    app.model(createGeneratorModel(texGen));
    const tree = app.start();
    document.body.appendChild(tree);
};
