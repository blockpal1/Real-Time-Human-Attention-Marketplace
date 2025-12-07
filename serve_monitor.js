const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8089;
const FILE_TO_SERVE = path.join(__dirname, 'monitor.html');

const server = http.createServer((req, res) => {
    console.log('Request:', req.url);

    // Serve monitor.html for root or /monitor.html
    if (req.url === '/' || req.url === '/monitor.html') {
        fs.readFile(FILE_TO_SERVE, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end(`Error loading file: ${err.message}`);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Serving: ${FILE_TO_SERVE}`);
});
