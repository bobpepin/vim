onmessage = function (e) {
    postMessage("Lower: " + e.data.toLowerCase());
}
