const net = require("net");
const fs = require("fs");
const path = require('path');
const zlib = require('zlib');

const server = net.createServer((socket) => {
    socket.on('data', (data) => {
        const request = data.toString();
        console.log(request);

        // Handle root request
        if (request.startsWith('GET / ')) {
            sendResponse(socket, '200 OK', 'text/plain', 'Hello, world');
        


        // Handle user-agent request
        } else if (request.startsWith('GET /user-agent')) {
            const userAgentLine = request.split('\r\n').find(line => line.startsWith('User-Agent'));
            const userAgent = userAgentLine ? userAgentLine.substring(12).trim() : 'Unknown';
            sendResponse(socket, '200 OK', 'text/plain', userAgent);



        // Handle echo request
        } else if (request.startsWith('GET /echo/')) {
            const path = request.split(' ')[1];
            const echoContent = path.replace('/echo/', '');

            // check if encoded
            const scheme = checkCompressionScheme(request);
            if (scheme) {
                const encodedContent = zlib.gzipSync(echoContent);
                sendResponseEncoded(socket, '200 OK', scheme,'text/plain', encodedContent);

            // if not encoded
            } else {
                sendResponse(socket, '200 OK', 'text/plain', echoContent);
            }
            socket.end();


        
        // Handle file request
        } else if (request.startsWith('GET /files/')) {
            const directory = request.split(' ')[1];
            const fileName = directory.replace('/files/', '');
            const filePath = path.join(process.argv[3], fileName);
            
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    sendResponse(socket, '404 Not Found', 'text/plain', 'Resource not found');
                } else {
                    sendResponse(socket, '200 OK', 'application/octet-stream', content);
                }
                socket.end();
            });



        // Handle post requests
        } else if (request.startsWith('POST /files/')) {
            const directory = request.split(' ')[1];
            const fileName = directory.replace('/files/', '');
            const filePath = path.join(process.argv[3], fileName);

            const contentLengthHeader = request.split('\r\n').find(line => line.startsWith('Content-Length'));
            const contentLength = contentLengthHeader ? parseInt(contentLengthHeader.split(': ')[1], 10) : 0;
            const body = request.split('\r\n\r\n')[1];
            
            if (body.length >= contentLength) {
                fs.writeFile(filePath, body, (err) => {
                    if (err) {
                        sendResponse(socket, '500 Internal Server Error', 'text/plain', 'Error writing file');
                    } else {
                        sendResponse(socket, '201 Created');
                    }
                    socket.end();
                })
            } else {
                sendResponse(socket, '400 Bad Request', 'text/plain', 'Content length mismatch');
                socket.end();
            }

        // Handle not found (404)
        } else {
            sendResponse(socket, '404 Not Found', 'text/plain', 'Resource not found');
            socket.end();
        }

    })
});

function checkCompressionScheme(request) {
    const acceptedEncoders = ['gzip'];
    const compressionLine = request.split('\r\n').find(line => line.startsWith('Accept-Encoding'));
    if (compressionLine) {
        const compressionSchemes = compressionLine.replace('Accept-Encoding: ', '').split(',');
        for (item of compressionSchemes) {
            if (acceptedEncoders.includes(item.trim())) return item.trim();
        }
    }
    return false;
}

function sendResponse(socket, statusCode, contentType = '', body = '') {
    const contentLength = Buffer.byteLength(body);
    const response = 
        `HTTP/1.1 ${statusCode}\r\n` +
        `Content-Type: ${contentType}\r\n` +
        `Content-Length: ${contentLength}\r\n\r\n` +
        body;
    socket.write(response);
}

function sendResponseEncoded(socket, statusCode, compressionScheme, contentType, body) {
    const contentLength = body.length;
    const headers = 
        `HTTP/1.1 ${statusCode}\r\n` +
        `Content-Type: ${contentType}\r\n` +
        `Content-Length: ${contentLength}\r\n` +
        `Content-Encoding: ${compressionScheme}\r\n\r\n`;
    socket.write(headers);
    socket.write(body);
}

server.listen(4221, "localhost");