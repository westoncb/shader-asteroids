const path = require("path")

module.exports = {
    mode: "development",
    entry: "./src/main.js",
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    devServer: {
        static: "./dist",
    },
    performance: {
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.(glsl|vs|fs|vert|frag)$/,
                type: "asset/source",
                use: ["glslify-loader"],
            },
        ],
    },
}
