const path = require('path');
module.exports = {
    entry: './src/index.tsx', //入口文件
    output: {
        filename: 'bundle.js', //编译后的文件
        path: path.resolve(__dirname, '/dist')
    },
    mode: 'development',
    devtool: "source-map",
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".tsx", ".js", ".json"]
    },
    devServer: {
        contentBase: path.join(__dirname, "/dist"), //编译好的文件放在这里
        compress: true,
        port: 9000 //本地开发服务器端口
    },
    module: {  
        rules: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    }
}