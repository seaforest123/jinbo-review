'use strict';

function createWxLearningStorage(wxApi) {
  if (!wxApi || typeof wxApi.getStorage !== 'function' || typeof wxApi.setStorage !== 'function') throw new TypeError('invalid wx storage api');
  return {
    get: (key) => new Promise((resolve) => wxApi.getStorage({ key, success: (result) => resolve(result.data), fail: () => resolve(undefined) })),
    set: (key, value) => new Promise((resolve) => wxApi.setStorage({ key, data: value, complete: resolve })),
  };
}

module.exports = { createWxLearningStorage };
