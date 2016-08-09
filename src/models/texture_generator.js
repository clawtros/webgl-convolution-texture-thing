module.exports = function(textureGenerator, presets, kernels) {
  return {
    state: {
      isTiled: true,
      currentPreset: "coral",
      kernelsToApply: presets["coral"],
      presets: presets,
      kernels: kernels,
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
      setTiled: (data) => ({
        isTiled: data
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
