module.exports = function(textureGenerator, presets, kernels) {
  kernels["hsv"] = [];
  kernels["rgb-hsv"] = [];
  let count = 0;
  return {
    state: {
      isTiled: false,
      currentPreset: "coral",
      kernelsToApply: [],
      presets: presets,
      kernels: kernels,
      isRunning: true,
      nthFrame: 1
      mixAmount: 0.7
    },
    subscriptions: [
      (send, done) => {
        let animate = function(dt) {
          requestAnimationFrame(animate);
          send("update", undefined, _=>
            send("render", undefined, done));
        };
        animate();
        done();
      }
    ],
    effects: {
      update: (data, state, send, done) => {
        if (state.isRunning) {
          for (let kernelToApply of state.kernelsToApply) {
            if (kernelToApply.name != "hsv" && kernelToApply.name != "rgb-hsv") {
              let {_, kernel} = kernelToApply;
              textureGenerator.drawWithKernel(kernel);
            } else {
              textureGenerator.drawWithProgram(kernelToApply.name);
            }
          }
        }                
        done();
      },
      reset: (data, state, send, done) => {
        textureGenerator.reset();
        done();
      },
      render: (data, state, send, done) => {
        count += 1;
        if (count % state.nthFrame == 0) textureGenerator.render();        
        done();
      }
    },
    reducers: {
      setNthFrame: (data) => ({
        nthFrame: data
      }),
      setMixAmount: (data) => ({
        mixAmount: data
      }),
      setRunning: (data) => ({
        isRunning: data
      }),
      removeKernel: (index, state) => ({
        kernelsToApply: state.kernelsToApply.slice(0, index)
                             .concat(state.kernelsToApply.slice(index + 1))
      }),
      addKernel: (kernel, state) => ({
        kernelsToApply: state.kernelsToApply.concat([kernel])
      }),
      setPreset: (preset) => ({
        currentPreset: preset,
        kernelsToApply: presets[preset]
      })
    }
  };
};
