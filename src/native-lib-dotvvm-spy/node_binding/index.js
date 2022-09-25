try {
    module.exports = require("./build/Release/dotnet-analyzer-lib-node.node");
} catch (error1) {
    if (error1.code !== 'MODULE_NOT_FOUND') {
        throw error1;
    }
    try {
        module.exports = require("./build/Debug/dotnet-analyzer-lib-node.node");
    } catch (error2) {
        if (error2.code !== 'MODULE_NOT_FOUND') {
            throw error2;
        }
        throw error1
    }
  }
